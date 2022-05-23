const elasticSearch = require('elasticsearch');
const axios = require('axios');
const fs = require('fs');
const qs = require('querystring');

require('dotenv').config();

axios.defaults.baseURL = `http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`;

// Replace default serializer with one that works with Joi validation
axios.defaults.paramsSerializer = function (params) {
  return qs.stringify(params);
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const elasticSearchClient = new elasticSearch.Client({
  host: process.env.ES_ENDPOINT,
});

async function reindexSegments() {
  let config = {
    method: 'GET',
    url: '/',
  };

  let ready = false;

  while (!ready) {
    try {
      await axios(config);
      ready = true;
    } catch (err) {
      console.log('WAITING FOR SERVER');
      await sleep(1000);
    }
  }

  console.log('SERVER READY');

  ready = false;

  while (!ready) {
    try {
      ready = await elasticSearchClient.ping();
    } catch (err) {
      console.log('WAITING FOR ELASTICSEARCH');
      await sleep(1000);
    }
  }

  console.log('ELASTICSEARCH READY');

  let hasNext = true;
  let limit = 500;
  let page = 1;
  while (hasNext == true) {
    let response = await getSegments(limit, page);
    hasNext = response.pages.hasNext;
    page++;
    let segments = response.docs;
    await bulkIndexSegments(segments);
  }
}

async function getSegments(limit = 50, page = 1) {
  config = {
    method: 'GET',
    url: '/segment',
    params: {
      $select: [
        'segmentId',
        'title',
        'description',
        'videoTitle',
        'videoYtId',
        'videoDuration',
        'ownerEmail',
        'start',
        'end',
        'captions',
      ],
      $embed: ['tags'],
      isDeleted: false,
      $page: page,
      $limit: limit,
    },
  };

  response = await axios(config);

  return response.data;
}

async function bulkIndexSegments(segments) {
  const body = segments.flatMap((segment) => [
    { update: { _index: 'segment', _type: '_doc', _id: segment._id } },
    {
      doc: {
        title: segment.title,
        description: segment.description,
        start: segment.start,
        end: segment.end,
        low_tags: getEsTags(segment.tags, 1, 4),
        mid_tags: getEsTags(segment.tags, 5, 7),
        high_tags: getEsTags(segment.tags, 8, 11),
        videoYtId: segment.videoYtId,
        captions: segment.captions,
      },
      doc_as_upsert: true,
    },
  ]);

  const bulkResponse = await elasticSearchClient.bulk({ refresh: true, body });

  if (bulkResponse.errors) {
    const erroredDocuments = [];
    // The items array has the same order of the dataset we just indexed.
    // The presence of the `error` key indicates that the operation
    // that we did for the document has failed.
    bulkResponse.items.forEach((action, i) => {
      const operation = Object.keys(action)[0];
      if (action[operation].error) {
        erroredDocuments.push({
          // If the status is 429 it means that you can retry the document,
          // otherwise it's very likely a mapping error, and you should
          // fix the document before to try it again.
          status: action[operation].status,
          error: action[operation].error,
          operation: body[i * 2],
          document: body[i * 2 + 1],
        });
      }
    });
    console.log(erroredDocuments);
  } else {
    console.log('no bulk insert errors');
  }

  const countReponse = await elasticSearchClient.count({ index: 'segment' });
  console.log(`now have ${countReponse.count} segments`);
}

function getEsTags(tags, from, to) {
  let result = [];
  tags.forEach((tag) => {
    if (tag.tag && tag.tag.isDeleted == false && tag.rank >= from && tag.rank <= to) {
      result.push(tag.tag.name);
    }
  });
  return result;
}

reindexSegments();
