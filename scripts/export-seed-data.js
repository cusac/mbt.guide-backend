'use strict';

/**
 * This script exports critical collections from the production database
 * to JSON files for use in seeding local/development databases.
 *
 * Usage:
 *   - Set MONGODB_URI to point to production database
 *   - Run: node scripts/export-seed-data.js
 *   - Output files will be created in seed-data/ directory
 */

const path = require('path');
const fs = require('fs');
const Mongoose = require('mongoose');
const Config = require('../config');
const RestHapi = require('rest-hapi');

// Limit export to most recent videos to keep file size manageable
const MAX_VIDEOS = 250;

async function exportSeedData() {
  const Log = RestHapi.getLogger('export-seed-data');
  
  try {
    const restHapiConfig = Config.get('/restHapiConfig');
    const mongoSSL = Config.get('/mongoSSL');
    
    // Configure MongoDB connection
    let mongoOptions = {};
    if (mongoSSL) {
      const mongoCertFile = Config.get('/mongoCertFile');
      const certFilePath = path.join(__dirname, `/../utilities/${mongoCertFile}`);
      
      if (fs.existsSync(certFilePath)) {
        mongoOptions = { ssl: true, sslValidate: true, sslCA: certFilePath };
        Log.log(`Using SSL with cert file: ${certFilePath}`);
      } else {
        Log.log('SSL enabled but cert file not found, proceeding without SSL');
      }
    }
    
    const mongoURI = restHapiConfig.mongo.URI;
    Log.log(`Connecting to: ${mongoURI}`);
    
    await Mongoose.connect(mongoURI, mongoOptions);
    Log.log('Connected to database');
    
    // Create seed-data directory if it doesn't exist
    const seedDataDir = path.join(__dirname, '../seed-data');
    if (!fs.existsSync(seedDataDir)) {
      fs.mkdirSync(seedDataDir, { recursive: true });
      Log.log(`Created directory: ${seedDataDir}`);
    }
    
    // Helper function to convert ObjectIds to strings
    const convertObjectIds = (obj) => {
      if (obj === null || obj === undefined) {
        return obj;
      }
      // First stringify/parse to convert Mongoose ObjectIds with toJSON()
      let cleaned = JSON.parse(JSON.stringify(obj));
      
      // Recursively convert any remaining ObjectId instances to strings
      const convertRecursive = (val) => {
        if (val === null || val === undefined) {
          return val;
        }
        // Check if it's an ObjectId instance
        if (val.constructor && val.constructor.name === 'ObjectID') {
          return val.toString();
        }
        if (Array.isArray(val)) {
          return val.map(item => convertRecursive(item));
        }
        if (typeof val === 'object' && val.constructor === Object) {
          const converted = {};
          Object.keys(val).forEach(key => {
            converted[key] = convertRecursive(val[key]);
          });
          return converted;
        }
        return val;
      };
      return convertRecursive(cleaned);
    };
    
    // Step 1: Get the most recent videos (sorted by _id, which typically indicates creation order)
    Log.log(`Fetching ${MAX_VIDEOS} most recent videos...`);
    const VideoModel = Mongoose.model('video', new Mongoose.Schema({}, { strict: false, collection: 'video' }));
    const videos = await VideoModel.find({})
      .sort({ _id: -1 })
      .limit(MAX_VIDEOS)
      .lean();
    
    Log.log(`Found ${videos.length} videos`);
    
    if (videos.length === 0) {
      Log.log('No videos found. Exiting.');
      await Mongoose.disconnect();
      process.exit(0);
    }
    
    const videoIds = videos.map(v => v._id);
    
    // Step 2: Get all segments associated with these videos
    Log.log('Fetching segments for these videos...');
    const SegmentModel = Mongoose.model('segment', new Mongoose.Schema({}, { strict: false, collection: 'segment' }));
    const segments = await SegmentModel.find({ video: { $in: videoIds } }).lean();
    Log.log(`Found ${segments.length} segments`);
    
    const segmentIds = segments.map(s => s._id);
    
    // Step 3: Get segment_tag associations for these segments
    // rest-hapi linking models use parentId/childId, but may also have segment/tag fields
    Log.log('Fetching segment-tag associations...');
    const SegmentTagModel = Mongoose.model('segment_tag', new Mongoose.Schema({}, { strict: false, collection: 'segment_tag' }));
    
    // Create a Set for quick lookup of segment IDs
    const segmentIdsSet = new Set(segmentIds.map(id => id.toString()));
    
    // Try both field naming conventions - get all associations where parentId or segment matches our segments
    const allSegmentTags = await SegmentTagModel.find({
      $or: [
        { segment: { $in: segmentIds } },
        { parentId: { $in: segmentIds } },
      ]
    }).lean();
    Log.log(`Found ${allSegmentTags.length} segment-tag associations`);
    
    // Helper to extract tag ID from segment_tag record (handles both naming conventions)
    const extractTagId = (st) => {
      // Try both naming conventions: childId (rest-hapi) and tag
      if (st.childId) {
        return typeof st.childId === 'object' && st.childId.toString ? st.childId.toString() : String(st.childId);
      }
      if (st.tag) {
        return typeof st.tag === 'object' && st.tag.toString ? st.tag.toString() : String(st.tag);
      }
      return null;
    };
    
    // Helper to extract segment ID from segment_tag record
    const extractSegmentId = (st) => {
      if (st.parentId) {
        return typeof st.parentId === 'object' && st.parentId.toString ? st.parentId.toString() : String(st.parentId);
      }
      if (st.segment) {
        return typeof st.segment === 'object' && st.segment.toString ? st.segment.toString() : String(st.segment);
      }
      return null;
    };
    
    // Extract all unique tag IDs referenced by these associations
    const tagIdsSet = new Set();
    const validSegmentTags = [];
    
    for (const st of allSegmentTags) {
      const segId = extractSegmentId(st);
      const tagId = extractTagId(st);
      
      // Only include associations where the segment is in our set (double-check)
      if (segId && segmentIdsSet.has(segId) && tagId) {
        tagIdsSet.add(tagId);
        validSegmentTags.push(st);
      }
    }
    
    const tagIds = Array.from(tagIdsSet);
    Log.log(`Extracted ${tagIds.length} unique tag IDs from associations`);
    Log.log(`Filtered to ${validSegmentTags.length} valid segment-tag associations (matching our segments)`);
    
    // Step 4: Get all tags referenced by these associations
    let tags;
    if (tagIds.length === 0) {
      Log.log('No tags found in associations, exporting empty tag array');
      tags = [];
    } else {
      Log.log(`Fetching ${tagIds.length} unique tags from database...`);
      const TagModel = Mongoose.model('tag', new Mongoose.Schema({}, { strict: false, collection: 'tag' }));
      
      // Convert tag IDs to ObjectIds, filtering out invalid ones
      const tagObjectIds = tagIds.map(id => {
        try {
          return new Mongoose.Types.ObjectId(id);
        } catch (e) {
          Log.log(`Warning: Invalid tag ID format: ${id}`);
          return null;
        }
      }).filter(Boolean);
      
      const tagsFromDb = await TagModel.find({ 
        _id: { $in: tagObjectIds }
      }).lean();
      
      Log.log(`Found ${tagsFromDb.length} tags in database`);
      
      // Verify we found all tags - warn if any are missing
      const foundTagIds = new Set(tagsFromDb.map(t => t._id.toString()));
      const missingTagIds = tagIds.filter(id => !foundTagIds.has(id));
      if (missingTagIds.length > 0) {
        Log.log(`Warning: ${missingTagIds.length} tag IDs from associations not found in database`);
      }
      
      tags = tagsFromDb;
    }
    
    // Use only the valid associations we filtered
    const segmentTagsBySegment = validSegmentTags;
    
    // Verify data consistency before export
    const tagsById = new Map(tags.map(t => [t._id.toString(), t]));
    const segmentsById = new Set(segments.map(s => s._id.toString()));
    
    // Final filter: only export segment_tag associations where both segment and tag exist
    const finalSegmentTags = segmentTagsBySegment.filter(st => {
      const segId = extractSegmentId(st);
      const tagId = extractTagId(st);
      const hasSegment = segId && segmentsById.has(segId);
      const hasTag = tagId && tagsById.has(tagId);
      
      if (!hasSegment || !hasTag) {
        return false;
      }
      return true;
    });
    
    if (finalSegmentTags.length !== segmentTagsBySegment.length) {
      Log.log(`Filtered ${segmentTagsBySegment.length - finalSegmentTags.length} invalid associations`);
    }
    
    Log.log(`Final export: ${finalSegmentTags.length} valid segment-tag associations`);
    
    // Convert and save each collection
    Log.log('Converting and saving data...');
    
    const cleanedVideos = videos.map(v => convertObjectIds(v));
    const cleanedSegments = segments.map(s => convertObjectIds(s));
    const cleanedTags = tags.map(t => convertObjectIds(t));
    const cleanedSegmentTags = finalSegmentTags.map(st => convertObjectIds(st));
    
    // Save to files
    fs.writeFileSync(
      path.join(seedDataDir, 'video.json'),
      JSON.stringify(cleanedVideos, null, 2),
      'utf8'
    );
    Log.log(`Saved ${cleanedVideos.length} videos to seed-data/video.json`);
    
    fs.writeFileSync(
      path.join(seedDataDir, 'segment.json'),
      JSON.stringify(cleanedSegments, null, 2),
      'utf8'
    );
    Log.log(`Saved ${cleanedSegments.length} segments to seed-data/segment.json`);
    
    fs.writeFileSync(
      path.join(seedDataDir, 'tag.json'),
      JSON.stringify(cleanedTags, null, 2),
      'utf8'
    );
    Log.log(`Saved ${cleanedTags.length} tags to seed-data/tag.json`);
    
    fs.writeFileSync(
      path.join(seedDataDir, 'segment_tag.json'),
      JSON.stringify(cleanedSegmentTags, null, 2),
      'utf8'
    );
    Log.log(`Saved ${cleanedSegmentTags.length} segment-tag associations to seed-data/segment_tag.json`);
    
    // Create a metadata file with export information
    const metadata = {
      exportedAt: new Date().toISOString(),
      maxVideos: MAX_VIDEOS,
      collections: [
        { name: 'video', count: cleanedVideos.length, file: 'seed-data/video.json' },
        { name: 'segment', count: cleanedSegments.length, file: 'seed-data/segment.json' },
        { name: 'tag', count: cleanedTags.length, file: 'seed-data/tag.json' },
        { name: 'segment_tag', count: cleanedSegmentTags.length, file: 'seed-data/segment_tag.json' },
      ]
    };
    
    const metadataFile = path.join(seedDataDir, 'metadata.json');
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
    Log.log(`Created metadata file: ${metadataFile}`);
    
    Log.log('Export complete!');
    Log.log(`Total documents exported: ${metadata.collections.reduce((sum, col) => sum + col.count, 0)}`);
    Log.log(`(Limited to ${MAX_VIDEOS} most recent videos)`);
    
    await Mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    Log.error('Export failed:', err);
    process.exit(1);
  }
}

exportSeedData();

