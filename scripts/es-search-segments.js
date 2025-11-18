const elasticSearch = require('elasticsearch');

const elasticSearchClient = new elasticSearch.Client({
  host: process.env.ES_ENDPOINT,
});

// Search for specific segment title
const query = 'Sugars effects on consciousness';

async function test() {
  const res = await elasticSearchClient.ping();
  console.log(res);
}

async function search() {
  const body = {
    size: 50,
    query: {
      function_score: {
        query: {
          multi_match: {
            query,
            type: 'cross_fields',
            fields: ['title^6', 'high_tags^5', 'description^4', 'captions^3', 'mid_tags^2', 'low_tags^1'],
          },
        },
        functions: [
          {
            gauss: {
              createdAt: {
                origin: 'now',
                scale: '365d',  // 1 year
                decay: 0.7,     // Score decays to 0.7 after 1 year
              },
            },
          },
        ],
        score_mode: 'sum',
        boost_mode: 'multiply',
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

search();
