'use strict';

process.env.NODE_ENV = 'local';

const path = require('path');
const Mongoose = require('mongoose');
const RestHapi = require('rest-hapi');
const faker = require('faker');
const iplocation = require('iplocation');
const Glue = require('@hapi/glue');
const updatePermissions = require('../utilities/update-permissions.utility');
const dropCollections = require('../utilities/drop-collections.utility');
const Manifest = require('../config/manifest.conf');

const Config = require('../config');

const restHapiConfig = Config.get('/restHapiConfig');
const USER_ROLES = Config.get('/constants/USER_ROLES');
const PERMISSION_STATES = Config.get('/constants/PERMISSION_STATES');
(async function seed() {
  RestHapi.config.loglevel = 'DEBUG';
  const Log = RestHapi.getLogger('seed');
  try {
    RestHapi.config = restHapiConfig;
    RestHapi.config.absoluteModelPath = true;
    RestHapi.config.modelPath = path.join(__dirname, '/../server/models');

    let models = await RestHapi.generateModels(Mongoose);

    const composeOptions = {
      relativeTo: path.join(__dirname, '/../'),
    };

    const manifest = Manifest.get('/');
    const server = await Glue.compose(
      manifest,
      composeOptions
    );

    await server.start();

    faker.seed(4997);

    const pin = '1234';

    let roles = [];
    let users = [];
    let groups = [];
    let permissions = [];
    let adminPermissions = [];

    let permissionNames = [];

    let request = {};
    let promises = [];
    let injectOptions = {};

    await dropCollections(models);
    models = await updatePermissions(models);
    Log.log('seeding roles');
    roles = [
      {
        name: USER_ROLES.USER,
        rank: 2,
        description: 'A standard user account.',
      },
      {
        name: USER_ROLES.ADMIN,
        rank: 1,
        description: 'A user with advanced permissions.',
      },
      {
        name: USER_ROLES.SUPER_ADMIN,
        rank: 0,
        description: 'A user with full permissions.',
      },
    ];
    roles = await RestHapi.create(models.role, roles, Log);

    Log.log('seeding permissions');
    permissions = [
      {
        name: 'root',
        description: 'Access to all endpoints',
        assignScope: [USER_ROLES.SUPER_ADMIN],
      },
      {
        name: 'create',
        description: 'Access to all create endpoints',
        assignScope: [USER_ROLES.SUPER_ADMIN],
      },
      {
        name: 'read',
        description: 'Access to all read endpoints',
        assignScope: [USER_ROLES.SUPER_ADMIN],
      },
      {
        name: 'update',
        description: 'Access to all update endpoints',
        assignScope: [USER_ROLES.SUPER_ADMIN],
      },
      {
        name: 'delete',
        description: 'Access to all delete endpoints',
        assignScope: [USER_ROLES.SUPER_ADMIN],
      },
      {
        name: 'associate',
        description: 'Access to all association endpoints',
        assignScope: [USER_ROLES.SUPER_ADMIN],
      },
      {
        name: 'enableUser',
        description: "Can enable a user's account",
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'disableUser',
        description: "Can disable a user's account",
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'activateUser',
        description: "Can activate a user's account",
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'deactivateUser',
        description: "Can deactivateUser a user's account",
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'readUserScope',
        description: "Can read a user's scope",
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'readUserConnectionStats',
        description: "Can read a user's connection stats",
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'receiveChatMessages',
        description: 'Can receive chat messages in real time',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'markConversationAsRead',
        description: 'Can mark a conversation as read',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'markConversationAsUnread',
        description: 'Can mark a conversation as unread',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'readMyConversations',
        description: "Can read the current user's chat conversations",
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'postChatMessage',
        description: 'Can post a chat message to a conversation',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'uploadImage',
        description: 'Can upload an image to the cloud',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'uploadProfileImage',
        description: 'Can upload a profile image to the cloud',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'receiveNotifications',
        description: 'Can receive notifications in real time',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
      {
        name: 'readAvailableNotifications',
        description: 'Can get the permissions available for the current user to assign',
        assignScope: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      },
    ];
    permissions = await RestHapi.create(models.permission, permissions, Log);

    Log.log('seeding groups');
    groups = [
      {
        name: 'Read Only',
        description: 'Group that excludes all permissions except for Admin level read permissions.',
      },
      {
        name: 'Editor',
        description: 'Group that forbids all creating.',
      },
      {
        name: 'Super User',
        description: 'Group with full permissions except root. Role restrictions remain.',
      },
    ];
    groups = await RestHapi.create(models.group, groups, Log);

    Log.log('seeding users');
    users = [
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: 'test@user.com',
        // profileImageUrl: 'https://www.gravatar.com/avatar/' + Mongoose.Types.ObjectId().toString() + '?r=PG&d=robohash',
        profileImageUrl: faker.image.avatar(),
        role: roles[0]._id,
        isActive: true,
      },
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: 'test@readonlyuser.com',
        // profileImageUrl: 'https://www.gravatar.com/avatar/' + Mongoose.Types.ObjectId().toString() + '?r=PG&d=robohash',
        profileImageUrl: faker.image.avatar(),
        role: roles[0]._id,
        isActive: true,
      },
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: 'test@admin.com',
        // profileImageUrl: 'https://www.gravatar.com/avatar/' + Mongoose.Types.ObjectId().toString() + '?r=PG&d=robohash',
        profileImageUrl: faker.image.avatar(),
        role: roles[1]._id,
        isActive: true,
      },
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: 'test@readonlyadmin.com',
        // profileImageUrl: 'https://www.gravatar.com/avatar/' + Mongoose.Types.ObjectId().toString() + '?r=PG&d=robohash',
        profileImageUrl: faker.image.avatar(),
        role: roles[1]._id,
        isActive: true,
      },
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: 'test@editoradmin.com',
        // profileImageUrl: 'https://www.gravatar.com/avatar/' + Mongoose.Types.ObjectId().toString() + '?r=PG&d=robohash',
        profileImageUrl: faker.image.avatar(),
        role: roles[1]._id,
        isActive: true,
      },
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: 'test@superuseradmin.com',
        // profileImageUrl: 'https://www.gravatar.com/avatar/' + Mongoose.Types.ObjectId().toString() + '?r=PG&d=robohash',
        profileImageUrl: faker.image.avatar(),
        role: roles[1]._id,
        isActive: true,
      },
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: 'test@superadmin.com',
        // profileImageUrl: 'https://www.gravatar.com/avatar/' + Mongoose.Types.ObjectId().toString() + '?r=PG&d=robohash',
        profileImageUrl: faker.image.avatar(),
        role: roles[2]._id,
        isActive: true,
      },
    ];

    request = {
      method: 'POST',
      url: '/user',
      params: {},
      query: {},
      payload: users,
      credentials: { scope: ['root', USER_ROLES.SUPER_ADMIN] },
      headers: { authorization: 'Bearer' },
    };

    injectOptions = RestHapi.testHelper.mockInjection(request);

    let result = await server.inject(injectOptions);
    users = result.result;

    Log.log('setting associations');

    result = await RestHapi.list(models.permission, {}, Log);
    permissions = result.docs;
    permissionNames = permissions.map(function(p) {
      return p.name;
    });

    promises = [];

    let userBasePermissionNames = [
      'readUser',
      'readVisitor',
      'createConnection',
      'readConnection',
      'updateConnection',
      'readUserConnectionStats',
      'receiveChatMessages',
      'markConversationAsRead',
      'markConversationAsUnread',
      'readMyConversations',
      'postChatMessage',
      'uploadImage',
      'uploadProfileImage',
      'receiveNotifications',
      'updateNotification',
      'createSegment',
      'updateSegment',
      'deleteSegment',
      'createVideo',
    ];

    let userDocumentPermissions = permissions
      .filter(function(p) {
        // We start with permissions Admins can assign so that they can edit the user permissions
        return p.assignScope.indexOf(USER_ROLES.ADMIN) > -1;
      })
      .filter(function(p) {
        return p.name.includes('Document');
      })
      .map(function(p) {
        return {
          state: PERMISSION_STATES.INCLUDED,
          childId: p._id,
        };
      });

    let userImagePermissions = permissions
      .filter(function(p) {
        // We start with permissions Admins can assign so that they can edit the user permissions
        return p.assignScope.indexOf(USER_ROLES.ADMIN) > -1;
      })
      .filter(function(p) {
        return p.name.includes('Image');
      })
      .map(function(p) {
        return {
          state: PERMISSION_STATES.INCLUDED,
          childId: p._id,
        };
      });

    let userPermissions = userBasePermissionNames
      .map(function(permissionName) {
        return {
          state: PERMISSION_STATES.INCLUDED,
          childId: permissions.find(function(p) {
            return p.name === permissionName;
          })._id,
        };
      })
      .concat(userDocumentPermissions)
      .concat(userImagePermissions);

    // initial User role permissions
    promises.push(
      RestHapi.addMany(
        models.role,
        roles[0]._id,
        models.permission,
        'permissions',
        userPermissions,
        Log
      )
    );

    await Promise.all(promises);
    promises = [];

    // Admins have access to any permission they can assign.
    adminPermissions = permissions
      .filter(function(p) {
        return p.assignScope.indexOf(USER_ROLES.ADMIN) > -1;
      })
      .map(function(p) {
        return {
          state: PERMISSION_STATES.INCLUDED,
          childId: p._id,
        };
      });

    // Initial Admin role permissions
    promises.push(
      RestHapi.addMany(
        models.role,
        roles[1]._id,
        models.permission,
        'permissions',
        adminPermissions,
        Log
      )
    );

    await Promise.all(promises);
    promises = [];

    // Initial Super Admin role permissions
    promises.push(
      RestHapi.addMany(
        models.role,
        roles[2]._id,
        models.permission,
        'permissions',
        [
          {
            state: PERMISSION_STATES.INCLUDED,
            childId: permissions.find(function(p) {
              return p.name === 'root';
            })._id,
          },
        ],
        Log
      )
    );

    await Promise.all(promises);

    promises = [];

    // Read Only group permissions
    let readOnlyExcludedPermissions = permissions
      .filter(function(p) {
        // We start with permissions Admins can assign so that they will also be able to assign the group
        return p.assignScope.indexOf(USER_ROLES.ADMIN) > -1;
      })
      .filter(function(p) {
        return !(p.name.includes('read') || p.name.includes('get'));
      })
      .map(function(p) {
        return {
          state: PERMISSION_STATES.EXCLUDED,
          childId: p._id,
        };
      });

    promises.push(
      RestHapi.addMany(
        models.group,
        groups[0]._id,
        models.permission,
        'permissions',
        readOnlyExcludedPermissions,
        Log
      )
    );

    await Promise.all(promises);
    promises = [];

    // Editor group permissions
    let createForbiddenPermission = permissions
      .filter(function(p) {
        // We start with permissions Admins can assign so that they will also be able to assign the group
        return p.assignScope.indexOf(USER_ROLES.ADMIN) > -1;
      })
      .filter(function(p) {
        return p.name.includes('create');
      })
      .map(function(p) {
        return {
          state: PERMISSION_STATES.FORBIDDEN,
          childId: p._id,
        };
      });

    promises.push(
      RestHapi.addMany(
        models.group,
        groups[1]._id,
        models.permission,
        'permissions',
        createForbiddenPermission,
        Log
      )
    );

    await Promise.all(promises);
    promises = [];

    // Super User group permissions
    let includedPermissions = permissionNames
      .filter(function(permissionName) {
        return permissionName !== 'root';
      })
      .map(function(permissionName) {
        return {
          state: PERMISSION_STATES.INCLUDED,
          childId: permissions.find(function(p) {
            return p.name === permissionName;
          })._id,
        };
      });

    promises.push(
      RestHapi.addMany(
        models.group,
        groups[2]._id,
        models.permission,
        'permissions',
        includedPermissions,
        Log
      )
    );

    await Promise.all(promises);
    promises = [];

    // Assign groups to users
    promises.push(
      RestHapi.addMany(models.user, users[1]._id, models.group, 'groups', [groups[0]._id], Log)
    );
    promises.push(
      RestHapi.addMany(models.user, users[3]._id, models.group, 'groups', [groups[0]._id], Log)
    );
    promises.push(
      RestHapi.addMany(models.user, users[4]._id, models.group, 'groups', [groups[1]._id], Log)
    );
    promises.push(
      RestHapi.addMany(models.user, users[5]._id, models.group, 'groups', [groups[2]._id], Log)
    );

    await Promise.all(promises);

    Log.log('seeding video, segment, tag, and segment_tag data from seed-data files');
    
    const fs = require('fs');
    const seedDataDir = path.join(__dirname, '../seed-data');
    
    // Load seed data from JSON files if they exist
    let videos = [];
    let tags = [];
    let segments = [];
    let segmentTags = [];
    
    const loadSeedData = (collectionName) => {
      const filePath = path.join(seedDataDir, `${collectionName}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        Log.log(`Loaded ${data.length} ${collectionName} documents from seed-data/${collectionName}.json`);
        return data;
      } else {
        Log.log(`Warning: seed-data/${collectionName}.json not found. Skipping ${collectionName}.`);
        return [];
      }
    };
    
    // Load seed data files
    videos = loadSeedData('video');
    tags = loadSeedData('tag');
    segments = loadSeedData('segment');
    segmentTags = loadSeedData('segment_tag');
    
    // If we have seed data, clear existing video/segment/tag collections for a clean seed
    if (videos.length > 0 || tags.length > 0 || segments.length > 0) {
      Log.log('Clearing existing video, segment, tag, and segment_tag collections...');
      await models.video.deleteMany({});
      await models.segment.deleteMany({});
      await models.tag.deleteMany({});
      // Delete segment_tag linking collection directly
      try {
        await Mongoose.connection.db.collection('segment_tag').deleteMany({});
      } catch (err) {
        Log.log(`Note: Could not clear segment_tag collection (may not exist yet): ${err.message}`);
      }
      
      // Fix: Drop non-sparse whisperDoc unique index that causes duplicate null errors
      // The video model has unique: true on whisperDoc but not all videos have this field
      try {
        const videoCollection = Mongoose.connection.db.collection('video');
        const indexes = await videoCollection.indexes();
        const whisperDocIndex = indexes.find(idx => idx.key && idx.key.whisperDoc);
        if (whisperDocIndex && !whisperDocIndex.sparse) {
          Log.log('Dropping non-sparse whisperDoc index...');
          await videoCollection.dropIndex(whisperDocIndex.name);
          Log.log('Creating sparse whisperDoc index...');
          await videoCollection.createIndex({ whisperDoc: 1 }, { unique: true, sparse: true });
        }
      } catch (err) {
        Log.log(`Note: whisperDoc index handling: ${err.message}`);
      }
      
      Log.log('Cleared existing collections');
    }
    
    // Create videos if we have seed data
    if (videos.length > 0) {
      Log.log(`Creating ${videos.length} videos`);
      // Convert string _id back to ObjectId for MongoDB
      const videosToCreate = videos.map(v => {
        const video = { ...v };
        if (video._id) {
          video._id = new Mongoose.Types.ObjectId(video._id);
        }
        // Convert video references in segments will be handled separately
        return video;
      });
      
      // Use insertMany to preserve _ids from production
      try {
        const result = await models.video.insertMany(videosToCreate, { ordered: false });
        Log.log(`Successfully created ${result.length} videos`);
      } catch (err) {
        // insertMany with ordered: false will partially insert before failing
        if (err.writeErrors) {
          const insertedCount = err.result?.insertedCount || videosToCreate.length - err.writeErrors.length;
          Log.log(`Inserted ${insertedCount} videos, ${err.writeErrors.length} failed`);
          // Log first few errors for debugging
          const sampleErrors = err.writeErrors.slice(0, 3);
          sampleErrors.forEach((writeErr, i) => {
            Log.log(`  Error ${i + 1}: ${writeErr.errmsg || JSON.stringify(writeErr)}`);
          });
        } else if (err.code === 11000) {
          Log.log('Some videos already exist, skipping duplicates');
        } else {
          Log.error(`Video insert error: ${err.message}`);
          throw err;
        }
      }
      
      // Fetch created videos to get proper ObjectIds
      videos = await RestHapi.list(models.video, {}, Log);
      videos = videos.docs;
      Log.log(`Total videos in database: ${videos.length}`);
    }
    
    // Create tags if we have seed data
    if (tags.length > 0) {
      Log.log(`Creating ${tags.length} tags`);
      const tagsToCreate = tags.map(t => {
        const tag = { ...t };
        if (tag._id) {
          tag._id = new Mongoose.Types.ObjectId(tag._id);
        }
        return tag;
      });
      
      try {
        const result = await models.tag.insertMany(tagsToCreate, { ordered: false });
        Log.log(`Successfully created ${result.length} tags`);
      } catch (err) {
        if (err.writeErrors) {
          const insertedCount = err.result?.insertedCount || tagsToCreate.length - err.writeErrors.length;
          Log.log(`Inserted ${insertedCount} tags, ${err.writeErrors.length} failed (likely duplicates)`);
        } else if (err.code === 11000) {
          Log.log('Some tags already exist, skipping duplicates');
        } else {
          throw err;
        }
      }
      
      tags = await RestHapi.list(models.tag, {}, Log);
      tags = tags.docs;
      Log.log(`Total tags in database: ${tags.length}`);
    }
    
    // Create segments if we have seed data
    if (segments.length > 0) {
      Log.log(`Creating ${segments.length} segments`);
      const segmentsToCreate = segments.map(s => {
        const segment = { ...s };
        if (segment._id) {
          segment._id = new Mongoose.Types.ObjectId(segment._id);
        }
        // Convert video ObjectId reference from string
        if (segment.video && typeof segment.video === 'string') {
          segment.video = new Mongoose.Types.ObjectId(segment.video);
        }
        // Remove owner if present (we don't want to link to prod users)
        if (segment.owner) {
          delete segment.owner;
        }
        return segment;
      });
      
      try {
        const result = await models.segment.insertMany(segmentsToCreate, { ordered: false });
        Log.log(`Successfully created ${result.length} segments`);
      } catch (err) {
        if (err.writeErrors) {
          const insertedCount = err.result?.insertedCount || segmentsToCreate.length - err.writeErrors.length;
          Log.log(`Inserted ${insertedCount} segments, ${err.writeErrors.length} failed (likely duplicates)`);
        } else if (err.code === 11000) {
          Log.log('Some segments already exist, skipping duplicates');
        } else {
          throw err;
        }
      }
      
      // Verify segments were created
      const segmentsResult = await RestHapi.list(models.segment, {}, Log);
      Log.log(`Total segments in database: ${segmentsResult.docs.length}`);
    }
    
    // Create segment_tag associations if we have seed data
    if (segmentTags.length > 0 && tags.length > 0 && segments.length > 0) {
      Log.log(`Creating segment-tag associations from ${segmentTags.length} association records`);
      promises = [];
      
      // Create a Set of valid tag IDs and segment IDs for quick lookup
      const validTagIds = new Set(tags.map(t => t._id.toString()));
      const validSegmentIds = new Set(segments.map(s => s._id.toString()));
      
      // Group associations by segment, filtering out invalid references
      const associationsBySegment = {};
      let skippedAssociations = 0;
      
      segmentTags.forEach(st => {
        // Handle both naming conventions: segment/parentId and tag/childId
        const segmentId = st.segment ? (typeof st.segment === 'string' ? st.segment : st.segment.toString()) 
                      : (st.parentId ? (typeof st.parentId === 'string' ? st.parentId : st.parentId.toString()) : null);
        const tagId = st.tag ? (typeof st.tag === 'string' ? st.tag : st.tag.toString())
                    : (st.childId ? (typeof st.childId === 'string' ? st.childId : st.childId.toString()) : null);
        
        // Only include associations where both segment and tag exist in our imported data
        if (segmentId && tagId && validSegmentIds.has(segmentId) && validTagIds.has(tagId)) {
          if (!associationsBySegment[segmentId]) {
            associationsBySegment[segmentId] = [];
          }
          associationsBySegment[segmentId].push({
            childId: new Mongoose.Types.ObjectId(tagId),
            rank: st.rank || 0,
          });
        } else {
          skippedAssociations++;
        }
      });
      
      if (skippedAssociations > 0) {
        Log.log(`Skipped ${skippedAssociations} associations referencing tags or segments not in seed data`);
      }
      
      Log.log(`Creating associations for ${Object.keys(associationsBySegment).length} segments`);
      
      // Create associations for each segment
      for (const [segmentId, tagAssociations] of Object.entries(associationsBySegment)) {
        if (tagAssociations.length === 0) continue;
        
        try {
          promises.push(
            RestHapi.addMany(
              models.segment,
              new Mongoose.Types.ObjectId(segmentId),
              models.tag,
              'tags',
              tagAssociations,
              Log
            ).catch(err => {
              Log.log(`Warning: Could not create associations for segment ${segmentId}: ${err.message}`);
              return null; // Continue with other associations
            })
          );
        } catch (err) {
          Log.log(`Warning: Error preparing associations for segment ${segmentId}: ${err.message}`);
        }
      }
      
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r !== null).length;
      Log.log(`Successfully created segment-tag associations for ${successCount} segments`);
    } else if (segments.length > 0 || tags.length > 0) {
      Log.log('No segment_tag associations found in seed data');
    }
    
    if (videos.length === 0 && tags.length === 0 && segments.length === 0) {
      Log.log('No seed data files found. Run "npm run export-seed-data" to export data from production.');
    }

    Log.log('SEEDING DONE!');

    process.exit(0);
  } catch (err) {
    Log.error(err);

    process.exit(1);
  }
})();
