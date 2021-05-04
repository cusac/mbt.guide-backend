'use strict';

module.exports = function (mongoose) {
  var modelName = 'searchQuery';
  var Types = mongoose.Schema.Types;
  var Schema = new mongoose.Schema(
    {
      term: {
        type: Types.String,
        required: true,
        unique: true,
      },
      tag: {
        type: Types.ObjectId,
        ref: 'tag',
      },
      queryCount: {
        type: Types.Number,
      },
    },
    { collection: modelName }
  );

  Schema.statics = {
    collectionName: modelName,
    routeOptions: {
      readAuth: false,
      allowCreate: false,
      allowUpdate: false,
      allowDelete: false,
      associations: {
        tag: {
          type: 'MANY_ONE',
          model: 'tag',
          allowAdd: false,
          allowRemove: false,
        },
      },
    },
  };

  return Schema;
};
