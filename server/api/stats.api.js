'use strict';

const Chalk = require('chalk');
const RestHapi = require('rest-hapi');
const errorHelper = require('../utilities/error-helper');
const fetch = require('node-fetch');

const Config = require('../../config');

module.exports = function (server, mongoose, logger) {
  async function getCurrentStats() {
    const Log = logger.bind(Chalk.magenta('Video Stats'));
    const Video = mongoose.model('video');
    const Segment = mongoose.model('segment');
    const Tag = mongoose.model('tag');
    const User = mongoose.model('user');
    const SearchQuery = mongoose.model('searchQuery');

    const key = Config.get('/youtubeApiKey');

    const channelId = 'UCYwlraEwuFB4ZqASowjoM0g';

    const ytStatsQuery = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${key}`;

    let stats = {};
    let promises = [];
    promises.push(RestHapi.list(Video, { isDeleted: false, $embed: ['segments'] }, Log));
    promises.push(
      RestHapi.list(
        Segment,
        {
          isDeleted: false,
          $select: ['title', 'segmentId', 'views', 'start', 'end'],
          $sort: ['-views'],
        },
        Log
      )
    );
    promises.push(RestHapi.list(Tag, { isDeleted: false, $embed: ['segments'] }, Log));
    promises.push(RestHapi.list(User, { isDeleted: false, $embed: ['segments'] }, Log));
    promises.push((await fetch(ytStatsQuery)).json());
    promises.push(RestHapi.list(SearchQuery, { isDeleted: false, $sort: ['-queryCount'] }, Log));

    let result = await Promise.all(promises);

    const videos = result[0].docs;
    const segments = result[1].docs;
    const tags = result[2].docs;
    const users = result[3].docs;
    const ytStats = result[4];
    const searchQueries = result[5].docs;

    tags.sort((a, b) => b.segments.length - a.segments.length);
    users.sort((a, b) => b.segments.length - a.segments.length);

    const tagsCreated = tags.length;
    const videosStarted = videos.filter((v) => v.segments.length >= 1).length;
    const videosCompleted = videos.filter((v) => v.segments.length >= 3).length;
    const segmentsCreated = segments.length;
    const hoursProcessed =
      segments.reduce((total, seg, index) => total + seg.end - seg.start, 0) / 60 / 60;
    const totalSegmentViews = segments.reduce((total, seg, index) => total + (seg.views || 0), 0);
    const totalSearches = searchQueries.reduce(
      (total, query, index) => total + (query.queryCount || 0),
      0
    );

    const mostUsedTags = [];
    for (let i = 0; i < 10 && i < tags.length; i++) {
      mostUsedTags.push({ tag: tags[i].name, segmentCount: tags[i].segments.length });
    }

    const topContributers = [];
    for (let i = 0; i < 10 && i < users.length; i++) {
      const hoursProcessed =
        users[i].segments.reduce((total, seg, index) => total + seg.end - seg.start, 0) / 60 / 60;
      topContributers.push({
        firstName: users[i].firstName,
        lastName: users[i].lastName,
        email: users[i].email,
        segmentCount: users[i].segments.length,
        hoursProcessed,
      });
    }

    const topViewedSegments = [];
    for (let i = 0; i < 10 && i < segments.length; i++) {
      topViewedSegments.push({
        title: segments[i].title,
        segmentId: segments[i].segmentId,
        views: segments[i].views,
      });
    }

    const topSearchTerms = [];
    for (let i = 0; i < 10 && i < searchQueries.length; i++) {
      topSearchTerms.push({
        term: searchQueries[i].term,
        queryCount: searchQueries[i].queryCount,
        isTag: !!searchQueries[i].tag,
      });
    }

    const totalVideos = ytStats.items[0].statistics.videoCount;

    stats = {
      tagsCreated,
      videosStarted,
      videosCompleted,
      segmentsCreated,
      hoursProcessed,
      mostUsedTags,
      topContributers,
      totalVideos,
      totalSegmentViews,
      topViewedSegments,
      totalSearches,
      topSearchTerms,
    };

    return stats;
  }
  // Dashboard Stats Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Dashboard Stats'));
    const User = mongoose.model('user');
    const Document = mongoose.model('document');
    const Image = mongoose.model('image');
    const Message = mongoose.model('message');
    const Visitor = mongoose.model('visitor');

    Log.note('Generating Dashboard Stats endpoint');

    const dashboardStatsHandler = async function (request, h) {
      try {
        let promises = [];
        let stats = {};
        promises.push(RestHapi.list(User, { isDeleted: false, $count: true }, Log));
        promises.push(RestHapi.list(Document, { isDeleted: false, $count: true }, Log));
        promises.push(RestHapi.list(Image, { isDeleted: false, $count: true }, Log));
        promises.push(RestHapi.list(Message, { isDeleted: false, $count: true }, Log));
        promises.push(
          RestHapi.list(
            User,
            {
              isDeleted: false,
              $where: { facebookId: { $exists: true } },
              $count: true,
            },
            Log
          )
        );
        promises.push(
          RestHapi.list(
            User,
            {
              isDeleted: false,
              $where: { googleId: { $exists: true } },
              $count: true,
            },
            Log
          )
        );
        promises.push(
          RestHapi.list(
            User,
            {
              isDeleted: false,
              $where: { githubId: { $exists: true } },
              $count: true,
            },
            Log
          )
        );
        promises.push(RestHapi.list(Visitor, { isDeleted: false, $count: true }, Log));

        let result = await Promise.all(promises);

        stats = {
          userCount: result[0],
          documentCount: result[1],
          imageCount: result[2],
          messageCount: result[3],
          facebookUserCount: result[4],
          googleUserCount: result[5],
          githubUserCount: result[6],
          visitorCount: result[7],
        };

        promises = [];
        let step = {};

        // MONGO AGGREGATION PIPELINE EXAMPLE

        // region BUILD TOTAL VISITORS PER COUNTRY QUERY

        const visitorsPerCountryQuery = [];

        // Group and count visitors from each country
        step = {};

        step.$group = {
          _id: '$country_code',
          visitorCount: { $sum: 1 },
        };

        visitorsPerCountryQuery.push(step);

        // Format the data for the next step
        step = {};

        step.$group = {
          _id: null,
          totalVisitorsPerCountry: {
            $push: { k: '$_id', v: '$visitorCount' },
          },
        };

        visitorsPerCountryQuery.push(step);

        // Remove null values since they cause errors in the next step
        step = {};

        step.$project = {
          totalVisitorsPerCountry: {
            $filter: {
              input: '$totalVisitorsPerCountry',
              as: 'data',
              cond: { $ne: ['$$data.k', null] },
            },
          },
        };

        visitorsPerCountryQuery.push(step);

        // Transform data from array to object
        step = {};

        step.$project = {
          _id: 0,
          totalVisitorsPerCountry: {
            $arrayToObject: '$totalVisitorsPerCountry',
          },
        };

        visitorsPerCountryQuery.push(step);

        promises.push(Visitor.aggregate(visitorsPerCountryQuery));

        // endregion

        // region BUILD TOTAL VISITORS PER BROWSER QUERY

        const visitorsPerBrowserQuery = [];

        // Group and count each browser
        step = {};

        step.$group = {
          _id: '$browser',
          visitorCount: { $sum: 1 },
        };

        visitorsPerBrowserQuery.push(step);

        // Format the data for the next step
        step = {};

        step.$group = {
          _id: null,
          totalVisitorsPerBrowser: {
            $push: { k: '$_id', v: '$visitorCount' },
          },
        };

        visitorsPerBrowserQuery.push(step);

        // Remove null values since they cause errors in the next step
        step = {};

        step.$project = {
          totalVisitorsPerCountry: {
            $filter: {
              input: '$totalVisitorsPerCountry',
              as: 'data',
              cond: { $ne: ['$$data.k', null] },
            },
          },
        };

        visitorsPerCountryQuery.push(step);

        // Transform data from array to object
        step = {};

        step.$project = {
          _id: 0,
          totalVisitorsPerBrowser: {
            $arrayToObject: '$totalVisitorsPerBrowser',
          },
        };

        visitorsPerBrowserQuery.push(step);

        promises.push(Visitor.aggregate(visitorsPerBrowserQuery));

        // endregion

        result = await Promise.all(promises);

        stats.totalVisitorsPerCountry = (result[0][0] || {}).totalVisitorsPerCountry || 0;
        stats.totalVisitorsPerBrowser = (result[1][0] || {}).totalVisitorsPerBrowser || 0;

        return { stats };
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'GET',
      path: '/stats/dashboard',
      config: {
        handler: dashboardStatsHandler,
        auth: null,
        description: 'Get stats for the dashboard.',
        tags: ['api', 'Stats', 'Dashboard'],
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
        },
      },
    });
  })();

  // Get Video Stats Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Video Stats'));

    Log.note('Generating Get Video Stats endpoint');

    const videoStatsHandler = async function (request, h) {
      try {
        return getCurrentStats();
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'GET',
      path: '/stats/video',
      config: {
        handler: videoStatsHandler,
        auth: null,
        description: 'Get stats for the videos and segments.',
        tags: ['api', 'Stats', 'Video'],
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
        },
      },
    });
  })();

  // Log Video Stats Endpoint
  (function () {
    const Log = logger.bind(Chalk.magenta('Video Stats'));
    const VideoStats = mongoose.model('videoStats');

    Log.note('Generating Log Video Stats endpoint');

    const logVideoStatsHandler = async function (request, h) {
      try {
        let stats = false;
        const currentStats = await RestHapi.list(
          VideoStats,
          { isDeleted: false, $sort: ['-createdAt'], $limit: 1 },
          Log
        );

        const lastStat = currentStats.docs[0];

        if (lastStat) {
          const lastDate = new Date(lastStat.createdAt);
          const lastDateHour = new Date(
            lastDate.getFullYear(),
            lastDate.getMonth(),
            lastDate.getDate(),
            lastDate.getHours()
          );
          const today = new Date();
          const todayHour = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            today.getHours()
          );

          // We only save stats that are unique to an hour
          if (lastDateHour.getTime() !== todayHour.getTime()) {
            stats = await getCurrentStats();
            await RestHapi.create(VideoStats, stats, Log);
          }
        }

        return stats;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'POST',
      path: '/stats/video',
      config: {
        handler: logVideoStatsHandler,
        auth: null,
        description: 'Log stats for the videos and segments.',
        tags: ['api', 'Stats', 'Video'],
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
        },
      },
    });
  })();
};
