'use strict';

module.exports = function (mongoose) {
  var modelName = 'tag';
  var Types = mongoose.Schema.Types;
  var Schema = new mongoose.Schema(
    {
      name: {
        type: Types.String,
        required: true,
        unique: true,
      },
      segmentCount: {
        type: Types.Number,
        unique: false,
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
          type: 'MANY_MANY',
          alias: 'segments',
          model: 'segment',
          embedAssociation: false,
          linkingModel: 'segment_tag',
        },
        queries: {
          type: 'ONE_MANY',
          alias: 'queries',
          foreignField: 'tag',
          model: 'searchQuery',
        },
      },
    },

    standardizeTag: function (name) {
      //Eliminate leading and trailing spaces
      name = name.trim();

      //Eliminate junk characters at beginning
      if (name.startsWith('#') || name.startsWith('$') || name.startsWith('.'))
        name = name.substr(1);

      //Convert everything to lower case
      name = name.toLowerCase();

      return name;
    },
  };

  return Schema;
};
