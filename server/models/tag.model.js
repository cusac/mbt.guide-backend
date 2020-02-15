'use strict';

module.exports = function(mongoose) {
  var modelName = 'tag';
  var Types = mongoose.Schema.Types;
  var Schema = new mongoose.Schema(
    {
      name: {
        type: Types.String,
        required: true,
        unique: true,
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
      },
    },
  };

  return Schema;
};
