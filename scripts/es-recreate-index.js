const elasticSearch = require('elasticsearch');

require('dotenv').config();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const elasticSearchClient = new elasticSearch.Client({
  host: process.env.ES_ENDPOINT,
});

async function recreateIndex() {
  let ready = false;

  while (!ready) {
    try {
      ready = await elasticSearchClient.ping();
    } catch (err) {
      console.log('WAITING FOR ELASTICSEARCH');
      await sleep(1000);
    }
  }

  console.log('ELASTICSEARCH READY');

  await deleteIndex();
  await createIndex();
}

async function deleteIndex() {
  try {
    // Check if index exists first
    const exists = await elasticSearchClient.indices.exists({
      index: 'segment',
    });
    
    if (exists) {
      await elasticSearchClient.indices.delete({
        index: 'segment',
      });
      console.log('DELETED EXISTING INDEX');
    } else {
      console.log('INDEX DOES NOT EXIST, SKIPPING DELETE');
    }
  } catch (err) {
    console.log('ERROR DELETING INDEX:', err.message);
    // Continue anyway - we'll create a new index
  }
}

async function createIndex() {
  try {
    await elasticSearchClient.indices.create({
      index: 'segment',
    });
    console.log('CREATED INDEX');

    await elasticSearchClient.indices.putMapping({
      index: 'segment',
      body: {
        properties: {
          title: { type: 'text' },
          description: { type: 'text' },
          start: { type: 'integer' },
          end: { type: 'integer' },
          low_tags: { type: 'text' },
          mid_tags: { type: 'text' },
          high_tags: { type: 'text' },
          videoYtId: { type: 'text' },
          captions: { type: 'text' },
          createdAt: { type: 'date' },
          views: { type: 'integer' },
        },
      },
    });
    console.log('CREATED MAPPING');
    console.log('INDEX RECREATION COMPLETE');
  } catch (err) {
    console.log('ERROR CREATING INDEX:', err.message);
    throw err;
  }
}

recreateIndex();
