const elasticSearch = require('elasticsearch');

const elasticSearchClient = new elasticSearch.Client({
  host: process.env.ES_ENDPOINT,
});

// any query
const query = 'test';

async function test() {
  const res = await elasticSearchClient.ping();
  console.log(res);
}

async function search() {
  const body = {
    size: 50,
    query: {
      multi_match: {
        query,
        type: 'cross_fields',
        fields: ['title^5', 'captions^6', 'high_tags^4', 'description^3', 'mid_tags^2', 'low_tags'],
      },
    },
  };

  elasticSearchClient.search(
    {
      index: 'segment',
      type: '_doc',
      body,
    },
    function (error, response, status) {
      if (error) {
        console.log('search error: ' + error);
      } else {
        console.log('--- Response ---');
        console.log(response);
        console.log('--- Hits ---');
        response.hits.hits.forEach(function (hit) {
          console.log(hit);
        });
      }
    }
  );
}

test();
