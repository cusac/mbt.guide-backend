'use strict';

const Chalk = require('chalk');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const RestHapi = require('rest-hapi');
const fetch = require('node-fetch');
const errorHelper = require('../utilities/error-helper');

module.exports = function (server, mongoose, logger) {
  // Search Segments Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Search Segments'));

    const Segment = mongoose.model('segment');
    Log.note('Generating Search Segments endpoint');

    const searchSegmentsHandler = async function (request, h) {
      try {
        let url = `https://search-mbt-dev-f4f7vbrpf7v77zoekzjl53veou.us-east-2.es.amazonaws.com/segment/_search`;

        const body = {
          query: {
            multi_match: {
              query: request.query.term,
              type: 'most_fields',
              fields: ['title^5', 'high_tags^4', 'description^3', 'mid_tags^2', 'low_tags'],
            },
          },
        };

        const response = await (
          await fetch(url, {
            method: 'post',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
          })
        ).json();
        if (response.error) {
          throw Boom.badRequest(response.error.message);
        }

        const segmentIds = response.hits.hits.map((hit) => hit._id);

        const matchingSegments = await RestHapi.list(
          Segment,
          {
            _id: segmentIds,
            $embed: ['video', 'tags'],
          },
          Log
        );

        // Make sure we keep the order of the original search results
        const segments = segmentIds.map((id) =>
          matchingSegments.docs.find((s) => s._id.toString() === id.toString())
        );

        return segments;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'GET',
      path: '/search/segments',
      config: {
        handler: searchSegmentsHandler,
        auth: null,
        description: 'Search for segments.',
        tags: ['api', 'Search', 'Segments'],
        validate: {
          query: {
            term: Joi.string().required(),
          },
        },
        plugins: {
          'hapi-swagger': {
            responseMessages: [
              { code: 200, message: 'Success' },
              { code: 400, message: 'Bad Request' },
              { code: 404, message: 'Not Found' },
              { code: 500, message: 'Internal Server Error' },
            ],
          },
        },
      },
    });
  })();
};
