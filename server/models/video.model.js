'use strict';

module.exports = function(mongoose) {
  var modelName = 'video';
  var Types = mongoose.Schema.Types;
  var Schema = new mongoose.Schema(
    {
      title: {
        type: Types.String,
        allowOnCreate: false,
        allowOnUpdate: false,
        description: 'Video title from YouTube',
      },
      ytId: {
        type: Types.String,
        required: true,
        unique: true,
      },
      duration: {
        type: Types.Number,
        required: true,
        description: 'Video length in seconds',
      },
      youtube: {
        type: Types.Object,
        required: true,
        description: 'Cached information about the video from YouTube',
      },
      whisperDoc:  {
        type: Types.String,
        unique: true,
        description: 'Name of file containing the Whisper transcript',
      },
    },
    { collection: modelName }
  );

  Schema.statics = {
    collectionName: modelName,
    routeOptions: {
      readAuth: false,
      associations: {
        segments: {
          type: 'ONE_MANY',
          alias: 'segment',
          foreignField: 'video',
          model: 'segment',
        },
      },
      create: {
        pre: (payload, request, Log) => {
          payload.title = payload.youtube.snippet.title;
          return payload;
        },
      },
    },
  };

  return Schema;
};
