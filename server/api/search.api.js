'use strict';

const Chalk = require('chalk');
const Joi = require('joi');
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

    // Build search body based on sort preferences
    const buildSearchBody = ({ term, sortBy, sortOrder, page, limit, dateFrom, dateTo }) => {
      const from = (page - 1) * limit;
      let query;
      let sort = [];

      // Build date filter if provided
      const dateFilter = [];
      if (dateFrom || dateTo) {
        const range = {};
        if (dateFrom) range.gte = dateFrom;
        if (dateTo) range.lte = dateTo;
        dateFilter.push({ range: { createdAt: range } });
      }

      // Build query based on sort type
      if (sortBy === 'relevance') {
        // Use function_score for relevance with recency boost
        query = {
          function_score: {
            query: {
              bool: {
                must: {
                  multi_match: {
                    query: term,
                    type: 'cross_fields',
                    fields: [
                      'title^6',
                      'captions^8',
                      'high_tags^5',
                      'description^4',
                      'mid_tags^3',
                      'low_tags^2',
                    ],
                  },
                },
                filter: dateFilter,
              },
            },
            functions: [
              {
                gauss: {
                  createdAt: {
                    origin: 'now',
                    scale: '365d',
                    decay: 0.7,
                  },
                },
              },
            ],
            score_mode: 'sum',
            boost_mode: 'multiply',
          },
        };
      } else {
        // For upload_date and view_count, use simple bool query
        query = {
          bool: {
            must: {
              multi_match: {
                query: term,
                type: 'cross_fields',
                fields: [
                  'title^6',
                  'captions^8',
                  'high_tags^5',
                  'description^4',
                  'mid_tags^3',
                  'low_tags^2',
                ],
              },
            },
            filter: dateFilter,
          },
        };

        // Add explicit sort
        if (sortBy === 'upload_date') {
          sort.push({ createdAt: { order: sortOrder } });
        } else if (sortBy === 'view_count') {
          sort.push({ views: { order: sortOrder } });
        }
        
        // Add relevance as secondary sort
        sort.push({ _score: { order: 'desc' } });
      }

      const body = {
        from,
        size: limit,
        query,
        sort: sort.length > 0 ? sort : undefined,
      };

      return body;
    };

    const searchSegmentsHandler = async function (request, h) {
      try {
        let response;
        const { term, sortBy, sortOrder, page, limit, dateFrom, dateTo } = request.query;

        Log.note(`Searching for segments with term: ${term}`);
        Log.note(`Sorting by: ${sortBy}`);
        Log.note(`Sort order: ${sortOrder}`);
        Log.note(`Page: ${page}`);
        Log.note(`Limit: ${limit}`);
        Log.note(`Date from: ${dateFrom}`);
        Log.note(`Date to: ${dateTo}`);
        
        // Build the search body based on sort preference
        const body = buildSearchBody({
          term,
          sortBy,
          sortOrder,
          page,
          limit,
          dateFrom,
          dateTo,
        });

        Log.note(`Search body: ${JSON.stringify(body)}`);

        if (esAws) {
          Log.note('Using AWS Elasticsearch');
          // TODO: Grab region from env-vars
          const region = 'us-east-2';
          var endpoint = new AWS.Endpoint(esEndpoint);
          var aws_request = new AWS.HttpRequest(endpoint, region);

          aws_request.method = 'POST';
          aws_request.path = path.join(aws_request.path, 'segment', '_search');
          aws_request.body = JSON.stringify(body);
          aws_request.headers['host'] = esEndpoint;
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
          Log.note('Using local Elasticsearch');
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

        Log.note(`Response: ${JSON.stringify(response)}`);  

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
              term: term,
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
          const tagName = Tag.standardizeTag(term);
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
            term: term,
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

        // Build response with pagination metadata
        const totalHits = response.body.hits.total.value || response.body.hits.total;
        const totalPages = Math.ceil(totalHits / limit);
        
        return {
          segments,
          pagination: {
            page,
            limit,
            totalResults: totalHits,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          searchParams: {
            term,
            sortBy,
            sortOrder,
            dateFrom,
            dateTo,
          },
        };
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
        description: 'Search for segments with YouTube-style filtering and sorting options.',
        tags: ['api', 'Search', 'Segments'],
        validate: {
          query: {
            term: Joi.string().required(),
            sortBy: Joi.string().valid('relevance', 'upload_date', 'view_count').default('relevance'),
            sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(20),
            dateFrom: Joi.date().iso(),
            dateTo: Joi.date().iso(),
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
