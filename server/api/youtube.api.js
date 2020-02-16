'use strict';

const Chalk = require('chalk');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const fetch = require('node-fetch');
const errorHelper = require('../utilities/error-helper');

const Config = require('../../config');

module.exports = function(server, mongoose, logger) {
  // Youtube API Endpoint
  (function() {
    const Log = logger.bind(Chalk.magenta('Youtube'));

    Log.note('Generating Youtube API endpoint');

    const key = Config.get('/youtubeApiKey');
    // We restrict api calls to Tom's youtube channel
    const channelId = 'UCYwlraEwuFB4ZqASowjoM0g';

    const youtubeAPIHandler = async function(request, h) {
      try {
        let { endpoint, params } = request.payload;
        let url = `https://www.googleapis.com/youtube/v3/${endpoint}`;
        params = Object.assign(
          {
            part: 'snippet',
            maxResults: 50,
            key,
            channelId,
          },
          params
        );

        let first = true;

        for (const paramKey in params) {
          if (params[paramKey]) {
            url = first
              ? `${url}?${paramKey}=${params[paramKey]}`
              : `${url}&${paramKey}=${params[paramKey]}`;
            first = false;
          }
        }
        const response = await (await fetch(url)).json();
        if (response.error) {
          throw Boom.badRequest(response.error.message);
        }
        return response;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'POST',
      path: '/youtube',
      config: {
        handler: youtubeAPIHandler,
        auth: null,
        description: 'Make a youtube API call.',
        tags: ['api', 'Youtube'],
        validate: {
          payload: {
            endpoint: Joi.string().required(),
            params: Joi.any().required(),
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
