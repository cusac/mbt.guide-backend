'use strict';

const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const Chalk = require('chalk');
const RestHapi = require('rest-hapi');

const _ = require('lodash');

const errorHelper = require('../utilities/error-helper');

const Config = require('../../config');

module.exports = function (server, mongoose, logger) {
  // Increment segment view count endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Increment Segment View Count'));

    Log.note('Generating Increment Segment View Count Endpoint');

    const incrementSegmentViewsHandler = async function (request, h) {
      try {
        const segment = await RestHapi.find({
          model: 'segment',
          _id: request.params._id,
          $select: 'views',
          Log,
        });

        await RestHapi.update({
          model: 'segment',
          _id: segment._id,
          payload: { views: (segment.views || 0) + 1 },
          Log,
        });

        return true;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'PUT',
      path: '/segment/{_id}/increment-view-count',
      config: {
        handler: incrementSegmentViewsHandler,
        auth: null,
        description: `Increment the view count for a segment.`,
        tags: ['api', 'Segments'],
        validate: {
          params: {
            _id: Joi.objectId().required(),
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
