'use strict';

const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const Chalk = require('../../node_modules/chalk');
const RestHapi = require('../../node_modules/rest-hapi');
const auditLog = require('../policies/audit-log.policy');

const _ = require('lodash');

const errorHelper = require('../utilities/error-helper');

const Config = require('../../config');
const authStrategy = Config.get('/restHapiConfig/authStrategy');

const headersValidation = Joi.object({
  authorization: Joi.string().required(),
}).options({ allowUnknown: true });

module.exports = function(server, mongoose, logger) {
  // Update Video Segments Endpoint
  (function() {
    const Log = logger.bind(Chalk.magenta('Update Video Segments'));

    Log.note('Generating Update Video Segments Endpoint');

    const updateVideoSegmentsHandler = async function(request, h) {
      try {
        const Segment = mongoose.model('segment');

        const { videoId, segments } = request.payload;
        const video = (await RestHapi.list({
          model: 'video',
          query: { ytId: videoId, $embed: ['segments.tags'] },
        })).docs[0];

        if (!video) {
          throw Boom.badRequest('Video not found.');
        }

        const deletedSegments = _.differenceBy(video.segments, segments, 'segmentId');

        const newSegments = _.differenceBy(segments, video.segments, 'segmentId')
          .filter(s => s.pristine === false)
          .map(s => ({
            segmentId: s.segmentId,
            video: s.video,
            start: s.start,
            end: s.end,
            title: s.title,
            description: s.description,
          }));

        const oldSegments = _.differenceBy(segments, newSegments, 'segmentId');

        const updatedSegments = oldSegments
          .filter(s => s.pristine === false)
          .map(s => ({
            // We have to grab the _id from the existing segment since the payload segment
            // might not have one
            _id: video.segments.filter(vs => vs.segmentId === s.segmentId)[0]._id,
            start: s.start,
            end: s.end,
            title: s.title,
            description: s.description,
          }));

        let promises = [];

        // Delete removed segments
        !_.isEmpty(deletedSegments) &&
          promises.push(
            RestHapi.deleteMany({
              model: 'segment',
              payload: deletedSegments.map(s => s._id.toString()),
              restCall: true,
              credentials: request.auth.credentials,
            })
          );

        // Add new segments
        !_.isEmpty(newSegments) &&
          promises.push(
            RestHapi.create({
              model: 'segment',
              payload: newSegments,
              restCall: true,
              credentials: request.auth.credentials,
            })
          );

        // Update changed segments
        for (const segment of updatedSegments) {
          promises.push(
            RestHapi.update({
              model: 'segment',
              _id: segment._id,
              payload: segment,
              restCall: true,
              credentials: request.auth.credentials,
            })
          );
        }

        const results = await Promise.all(promises);

        for (const result of results) {
          if (result && result.error && result.statusCode === 403) {
            throw Boom.unauthorized(
              'You are not authorized to edit one or more of the submitted segments'
            );
          }
        }

        const savedSegments = (await RestHapi.list({
          model: 'video',
          query: { ytId: videoId, $embed: ['segments.tags'] },
        })).docs[0].segments;

        // Update tags for each segment
        for (const segment of savedSegments) {
          const { tags } = segments.find(s => s.segmentId === segment.segmentId);

          await Segment.updateTags({
            _id: segment._id,
            oldTags: segment.tags,
            currentTags: tags,
            logger: Log,
          });
        }

        await Promise.all(promises);

        return (await RestHapi.list({
          model: 'video',
          query: { ytId: videoId, $embed: ['segments.tags'] },
        })).docs[0].segments;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'POST',
      path: '/update-video-segments',
      config: {
        handler: updateVideoSegmentsHandler,
        auth: {
          strategy: authStrategy,
        },
        description: `Update the segments of a video. This endpoint is meant to take as payload 
        the desired state of a video's segments. It will then perform the CRUD operations required
        to update the database to match the desired state.`,
        tags: ['api', 'Video', 'Segments'],
        validate: {
          headers: headersValidation,
          payload: {
            videoId: Joi.string().required(),
            segments: Joi.array()
              .items(
                Joi.object({
                  segmentId: Joi.string().required(),
                  video: Joi.any().required(),
                  start: Joi.number().required(),
                  end: Joi.number().required(),
                  title: Joi.string().required(),
                  description: Joi.string().allow(''),
                  pristine: Joi.boolean().required(),
                  tags: Joi.array().items(
                    Joi.object({
                      rank: Joi.number(),
                      tag: Joi.object({
                        name: Joi.string(),
                      }),
                    })
                  ),
                })
              )
              .required(),
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
          policies: [auditLog(mongoose, {}, Log)],
        },
      },
    });
  })();
};
