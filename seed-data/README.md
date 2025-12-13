# Seed Data Directory

This directory contains exported production data used for seeding local and development databases.

## Collections Exported

- `video.json` - Video records
- `segment.json` - Segment records  
- `tag.json` - Tag records
- `segment_tag.json` - Segment-Tag linking records
- `metadata.json` - Export metadata (timestamp, counts, etc.)

## Usage

### Exporting Seed Data from Production

To update the seed data with the latest production data:

1. Ensure your `.env` file is configured to connect to production database
2. Set `MONGO_SSL=true` and `MONGO_CERT_FILE` if using SSL
3. Run the export script:

```bash
npm run export-seed-data
```

This will:
- Connect to the production database
- Export the 100 most recent videos and all their associated segments, tags, and associations
- Create JSON files in this directory
- Create a metadata file with export information

**Note**: To keep file sizes manageable, only the 100 most recent videos are exported. This typically results in several thousand segments, which should be sufficient for local development and testing.

### Using Seed Data

The seed script (`scripts/seed.js`) automatically loads data from these files when available:

```bash
npm run seed
# or
npm run seed-docker
```

If seed data files exist, they will be imported. If not, the seed script will skip seeding video/segment/tag data.

## Important Notes

- **Data Size**: Limited to 100 most recent videos and their segments/tags to keep file sizes manageable (typically < 5 MB)
- **User Data**: User records are NOT included (use test users from seed script)
- **Owner References**: Segment owner references are removed during seeding to avoid linking to production users
- **ObjectId Preservation**: Original MongoDB ObjectIds are preserved when possible to maintain relationships
- **Regular Updates**: Update these files regularly to keep local dev environments in sync with production structure

## File Structure

Each JSON file contains an array of documents, with ObjectIds stored as strings for portability:

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Example Video",
    "ytId": "dQw4w9WgXcQ",
    ...
  }
]
```

