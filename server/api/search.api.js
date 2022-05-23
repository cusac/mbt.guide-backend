'use strict';

const Chalk = require('chalk');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const RestHapi = require('rest-hapi');
const fetch = require('node-fetch');
const elasticSearch = require('elasticsearch');
const errorHelper = require('../utilities/error-helper');
const path = require('path');
const Config = require('../../config');

const AWS = require('aws-sdk');

const esAws = Config.get('/esAws');
const esEndpoint = Config.get('/esEndpoint');

module.exports = function (server, mongoose, logger) {
  // Search Segments Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Search Segments'));

    const Segment = mongoose.model('segment');
    const Tag = mongoose.model('tag');
    Log.note('Generating Search Segments endpoint');

    const searchSegmentsHandler = async function (request, h) {
      try {
        let response;
        // TODO: Add pagination options
        const body = {
          size: 50,
          query: {
            multi_match: {
              query: request.query.term,
              type: 'cross_fields',
              fields: [
                'title^5',
                'captions^6',
                'high_tags^4',
                'description^3',
                'mid_tags^2',
                'low_tags',
              ],
            },
          },
        };

        if (esAws) {
          // TODO: Grab region from env-vars
          const region = 'us-east-2';
          var endpoint = new AWS.Endpoint(esEndpoint);
          var aws_request = new AWS.HttpRequest(endpoint, region);

          aws_request.method = 'POST';
          aws_request.path = path.join(aws_request.path, 'segment', '_search');
          aws_request.body = JSON.stringify(body);
          aws_request.headers['host'] = domain;
          aws_request.headers['Content-Type'] = 'application/json';
          // Content-Length is only needed for DELETE requests that include a request
          // body, but including it for all requests doesn't seem to hurt anything.
          aws_request.headers['Content-Length'] = Buffer.byteLength(aws_request.body);

          const credentials = new AWS.EnvironmentCredentials('AWS');
          const signer = new AWS.Signers.V4(aws_request, 'es');
          signer.addAuthorization(credentials, new Date());

          const client = new AWS.HttpClient();
          response = await new Promise((resolve, reject) => {
            client.handleRequest(
              aws_request,
              null,
              (response) => {
                const { statusCode, statusMessage, headers } = response;
                let body = '';
                response.on('data', (chunk) => {
                  body += chunk;
                });
                response.on('end', () => {
                  const data = {
                    statusCode,
                    statusMessage,
                    headers,
                  };
                  if (body) {
                    data.body = JSON.parse(body);
                  }
                  resolve(data);
                });
              },
              (err) => {
                reject(err);
              }
            );
          });
        } else {
          const elasticSearchClient = new elasticSearch.Client({
            host: esEndpoint,
          });

          response = await new Promise((resolve, reject) => {
            elasticSearchClient.search(
              {
                index: 'segment',
                type: '_doc',
                body,
              },
              function (error, res, status) {
                if (error) {
                  reject(error);
                } else {
                  resolve({ body: res });
                }
              }
            );
          });
        }

        const segmentIds = response.body.hits.hits.map((hit) => hit._id);

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

        // Record the search query stats

        const query = (
          await RestHapi.list({
            model: 'searchQuery',
            query: {
              term: request.query.term,
              $select: 'queryCount',
            },
          })
        ).docs[0];

        // Update the query count if the query exists
        if (query) {
          RestHapi.update({
            model: 'searchQuery',
            _id: query._id,
            payload: { queryCount: query.queryCount + 1 },
            Log,
          });
          // Create a new query record if this term hasn't been searched before
        } else {
          // Check if the query term matches a tag
          const tagName = Tag.standardizeTag(request.query.term);
          const tag = (
            await RestHapi.list({
              model: 'tag',
              query: {
                name: tagName,
              },
              Log,
            })
          ).docs[0];

          const payload = {
            term: request.query.term,
            queryCount: 1,
          };

          if (tag) {
            payload.tag = tag._id;
          }

          await RestHapi.create({
            model: 'searchQuery',
            payload,
            Log,
          });
        }

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
