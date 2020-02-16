'use strict';

const RestHapi = require('../../node_modules/rest-hapi');
const _ = require('lodash');
const errorHelper = require('../utilities/error-helper');

module.exports = function(mongoose) {
  var modelName = 'segment';
  var Types = mongoose.Schema.Types;
  var Schema = new mongoose.Schema(
    {
      segmentId: {
        type: Types.String,
        required: true,
        unique: true,
      },
      title: {
        type: Types.String,
        required: true,
      },
      description: {
        type: Types.String,
      },
      video: {
        type: Types.ObjectId,
        ref: 'video',
      },
      start: {
        type: Types.Number,
        required: true,
      },
      end: {
        type: Types.Number,
        required: true,
      },
      owner: {
        type: Types.ObjectId,
        ref: 'user',
        allowOnUpdate: false,
        allowOnCreate: false,
      },
    },
    { collection: modelName }
  );

  Schema.statics = {
    collectionName: modelName,
    routeOptions: {
      readAuth: false,
      documentScope: {
        rootScope: ['root', 'Admin'],
      },
      authorizeDocumentCreator: true,
      associations: {
        video: {
          type: 'MANY_ONE',
          model: 'video',
          duplicate: ['title', 'ytId', 'duration'],
        },
        owner: {
          type: 'MANY_ONE',
          model: 'user',
          duplicate: ['email'],
        },
        tags: {
          type: 'MANY_MANY',
          alias: 'tag',
          model: 'tag',
          embedAssociation: false,
          linkingModel: 'segment_tag',
        },
      },
      create: {
        pre: async function(payload, request, logger) {
          const Log = logger.bind();
          try {
            payload.owner = request.auth.credentials.user._id;
            payload.ownerEmail = request.auth.credentials.user.email;
            return payload;
          } catch (err) {
            errorHelper.handleError(err, Log);
          }
        },
      },
    },

    updateTags: async function({ _id, oldTags, currentTags, logger }) {
      const nameAndRank = (a, b) => {
        return a.tag.name === b.tag.name && a.rank === b.rank;
      };

      const deletedTags = _.differenceBy(oldTags, currentTags, 'tag.name');
      const newTags = _.differenceWith(currentTags, oldTags, nameAndRank);

      const existingTagsToAdd = (await RestHapi.list({
        model: 'tag',
        query: {
          name: newTags.map(t => t.tag.name),
        },
      })).docs;

      const tagsToCreateAndAdd = _.differenceBy(
        newTags.map(t => ({ name: t.tag.name })),
        existingTagsToAdd,
        'name'
      );

      const newTagsToAdd = _.isEmpty(tagsToCreateAndAdd)
        ? []
        : await RestHapi.create({
            model: 'tag',
            payload: tagsToCreateAndAdd,
          });

      const tagsToAdd = [...newTagsToAdd, ...existingTagsToAdd].map(t => ({
        childId: t._id,
        rank: currentTags.find(tt => tt.tag.name === t.name).rank,
      }));
      const tagsToRemove = deletedTags.map(t => t._id);

      // Add tags
      !_.isEmpty(tagsToAdd) &&
        (await RestHapi.addMany({
          ownerModel: 'segment',
          ownerId: _id,
          childModel: 'tag',
          associationName: 'tags',
          payload: tagsToAdd,
        }));
      // Remove tags
      !_.isEmpty(tagsToRemove) &&
        (await RestHapi.removeMany({
          ownerModel: 'segment',
          ownerId: _id,
          childModel: 'tag',
          associationName: 'tags',
          payload: tagsToRemove,
        }));
    },
  };

  return Schema;
};
