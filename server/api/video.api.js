'use strict';

const Joi = require('joi');
const Boom = require('@hapi/boom');
const Chalk = require('chalk');
const RestHapi = require('rest-hapi');
const auditLog = require('../policies/audit-log.policy');

const _ = require('lodash');

const errorHelper = require('../utilities/error-helper');

const Config = require('../../config');
const authStrategy = Config.get('/restHapiConfig/authStrategy');

const getSubtitles = require('../../utilities/get-subtitles.utility');

const headersValidation = Joi.object({
  authorization: Joi.string().required(),
}).options({ allowUnknown: true });

module.exports = function (server, mongoose, logger) {
  // Update Video Segments Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Update Video Segments'));

    Log.note('Generating Update Video Segments Endpoint');

    const updateVideoSegmentsHandler = async function (request, h) {
      try {
        const Segment = mongoose.model('segment');
        const Tag = mongoose.model('tag');

        const { videoId, segments } = request.payload;

        for (let i = 0; i < segments.length; i++) {
          for (let j = 0; j < segments[i].tags.length; j++) {
            segments[i].tags[j].tag.name = Tag.standardizeTag(segments[i].tags[j].tag.name);
          }
        }

        const video = (
          await RestHapi.list({
            model: 'video',
            query: { ytId: videoId, $embed: ['segments.tags'] },
          })
        ).docs[0];

        if (!video) {
          throw Boom.badRequest('Video not found.');
        }

        const deletedSegments = _.differenceBy(video.segments, segments, 'segmentId');

        const newSegments = _.differenceBy(segments, video.segments, 'segmentId')
          .filter((s) => s.pristine === false)
          .map((s) => ({
            segmentId: s.segmentId,
            video: s.video,
            start: s.start,
            end: s.end,
            title: s.title,
            description: s.description,
          }));

        const oldSegments = _.differenceBy(segments, newSegments, 'segmentId');

        const updatedSegments = oldSegments
          .filter((s) => s.pristine === false)
          .map((s) => ({
            // We have to grab the _id from the existing segment since the payload segment
            // might not have one
            _id: video.segments.filter((vs) => vs.segmentId === s.segmentId)[0]._id,
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
              payload: deletedSegments.map((s) => s._id.toString()),
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
            throw Boom.forbidden(
              'You are not authorized to edit one or more of the submitted segments'
            );
          }
        }

        const savedSegments = (
          await RestHapi.list({
            model: 'video',
            query: { ytId: videoId, $embed: ['segments.tags'] },
          })
        ).docs[0].segments;

        // Update tags for each segment
        for (const segment of savedSegments) {
          const { tags } = segments.find((s) => s.segmentId === segment.segmentId);

          await Segment.updateTags({
            _id: segment._id,
            oldTags: segment.tags,
            currentTags: tags,
            logger: Log,
          });
        }

        await Promise.all(promises);

        // Add captions if available
        let captions;
        try {
          captions = await getSubtitles({
            videoID: video.ytId, // youtube video id
            lang: 'en', // default: `en`
          });
        } catch (err) {
          logger.log('Error getting captions.');
          logger.log(err);
        }

        if (captions) {
          for (const segment of savedSegments) {
            // TODO: skip adding captions if segment start and end haven't changed
            await Segment.addCaptions({
              seg: segment,
              captions,
              logger: Log,
            });
          }
        }

        return (
          await RestHapi.list({
            model: 'video',
            query: { ytId: videoId, $embed: ['segments.tags'] },
          })
        ).docs[0].segments;
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

  // Find Video Segments by Timestamp Range Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Find Video Segments'));

    Log.note('Generating Find Video Segments by Timestamp Range Endpoint');

    const findVideoSegmentsByTimestampRangeHandler = async function (request, h) {
      try {
        const Segment = mongoose.model('segment');

        const { videoId, start, end } = request.query;

        const video = (
          await RestHapi.list({
            model: 'video',
            query: { ytId: videoId, $embed: ['segments'] },
          })
        ).docs[0];

        if (!video) {
          throw Boom.badRequest('Video not found.');
        }
        if (!start && !end) {
          throw Boom.badRequest('One of start or end timestamps required.');
        }

        let segmentsInRange;

        if (!start && end) {
          // Find segments that overlap with the end timestamp
          segmentsInRange = video.segments.filter(
            (segment) => segment.start <= end && segment.end >= end
          );
        } else if (!end && start) {
          // Find segments that overlap with the start timestamp
          segmentsInRange = video.segments.filter(
            (segment) => segment.start <= start && segment.end >= start
          );
        } else {
          segmentsInRange = video.segments.filter(
            (segment) => segment.start <= end && segment.end >= start
          );
        }

        const segmentsInfoInRange = segmentsInRange.map((segment) => ({
          videoId: video.ytId,
          segmentId: segment.segmentId,
          title: segment.title,
          description: segment.description,
          start: segment.start,
          end: segment.end,
        }));

        return segmentsInfoInRange;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'GET',
      path: '/video/segments/timestamp-range',
      config: {
        handler: findVideoSegmentsByTimestampRangeHandler,
        auth: null,
        description: `Find video segments by a timestamp range. This endpoint returns a list of
        segmentIds, titles, and descriptions for the video that overlap (or intersect) the start to end time range.`,
        tags: ['api', 'Video', 'Segments'],
        validate: {
          query: {
            videoId: Joi.string().required(),
            start: Joi.number(),
            end: Joi.number(),
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
          policies: [],
        },
      },
    });
  })();

  // Update Whisper Doc For Video Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Update Whisper Doc'));

    Log.note('Generating Update Whisper Doc Endpoint');

    const updateWhisperDocHandler = async function (request, h) {
      try {
        const { videoId, whisperDoc } = request.payload;

        const video = (
          await RestHapi.list({
            model: 'video',
            query: { ytId: videoId, $select: ['title'] },
          })
        ).docs[0];

        if (!video) {
          throw Boom.badRequest('Video not found.');
        }

        await RestHapi.update({
          model: 'video',
          _id: video._id,
          payload: {
            whisperDoc,
          },
          Log,
        });

        return true;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'PUT',
      path: '/update-video-whisper',
      config: {
        handler: updateWhisperDocHandler,
        auth: {
          strategy: authStrategy,
          scope: ['Super Admin'],
        },
        // auth: null,
        description: `Update the whisper doc name for a video.`,
        tags: ['api', 'Video', 'Whisper'],
        validate: {
          headers: headersValidation,
          payload: {
            videoId: Joi.string().required(),
            whisperDoc: Joi.string().required(),
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
          policies: [],
        },
      },
    });
  })();

  // Find Video Id by Whipser Doc Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Find Video Id by Whipser Doc'));

    Log.note('Find Video Id by Whipser Doc Endpoint');

    const findVideoIdHandler = async function (request, h) {
      try {
        const { whisperDoc } = request.query;

        const video = (
          await RestHapi.list({
            model: 'video',
            query: { whisperDoc, $select: ['title', 'ytId'] },
          })
        ).docs[0];

        if (!video) {
          throw Boom.badRequest('Video not found.');
        }

        return { videoId: video.ytId };
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'GET',
      path: '/find-videoid-by-whisper',
      config: {
        handler: findVideoIdHandler,
        auth: null,
        description: `Find a videoId given a whisper doc name.`,
        tags: ['api', 'Video', 'Whisper'],
        validate: {
          query: {
            whisperDoc: Joi.string().required(),
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
          policies: [],
        },
      },
    });
  })();

  // List Videos Missing Whipser Doc Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('List Videos Missing Whipser Doc'));

    Log.note('List Videos Missing Whipser Doc Endpoint');

    const listVideosMissingWhisperDocHandler = async function (request, h) {
      try {
        // Use mongoose to find all videos that don't have a 'whisperDoc' field. Only select the 'ytId' and 'title' fields.
        const videos = await mongoose
          .model('video')
          .find({ whisperDoc: { $exists: false } }, { ytId: 1, title: 1, whisperDoc: 1, _id: 0 })
          .lean()
          .exec();

        if (!videos) {
          throw Boom.badRequest('No videos found.');
        }

        return videos;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'GET',
      path: '/list-videos-missing-whisper',
      config: {
        handler: listVideosMissingWhisperDocHandler,
        auth: null,
        description: `List all videos that don't have a whipser doc name.`,
        tags: ['api', 'Video', 'Whisper'],
        validate: {},
        plugins: {
          'hapi-swagger': {
            responseMessages: [
              { code: 200, message: 'Success' },
              { code: 400, message: 'Bad Request' },
              { code: 404, message: 'Not Found' },
              { code: 500, message: 'Internal Server Error' },
            ],
          },
          policies: [],
        },
      },
    });
  })();
};
