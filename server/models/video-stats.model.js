'use strict';

module.exports = function (mongoose) {
  var modelName = 'videoStats';
  var Types = mongoose.Schema.Types;
  var Schema = new mongoose.Schema(
    {
      tagsCreated: {
        type: Types.Number,
        required: true,
      },
      videosStarted: {
        type: Types.Number,
        required: true,
      },
      videosCompleted: {
        type: Types.Number,
        required: true,
      },
      segmentsCreated: {
        type: Types.Number,
        required: true,
      },
      hoursProcessed: {
        type: Types.Number,
        required: true,
      },
      mostUsedTags: {
        type: [Types.Object],
        required: true,
      },
      topContributers: {
        type: [Types.Object],
        required: true,
      },
      totalVideos: {
        type: Types.Number,
        required: true,
      },
      totalSegmentViews: {
        type: Types.Number,
        required: true,
      },
      topViewedSegments: {
        type: [Types.Object],
        required: true,
      },
      totalSearches: {
        type: Types.Number,
        required: true,
      },
      topSearchTerms: {
        type: [Types.Object],
        required: true,
      },
    },
    { collection: modelName }
  );

  Schema.statics = {
    collectionName: modelName,
    routeOptions: {
      alias: 'video-stats',
      readAuth: false,
      allowCreate: false,
      allowUpdate: false,
      allowAssociate: false,
      routeScope: {
        rootScope: 'root',
      },
    },
  };

  return Schema;
};
