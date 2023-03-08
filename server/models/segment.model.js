'use strict';

const RestHapi = require('../../node_modules/rest-hapi');
const _ = require('lodash');
const errorHelper = require('../utilities/error-helper');

module.exports = function (mongoose) {
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
      views: {
        description: 'How many times this segment has been viewed.',
        type: Types.Number,
        default: 0,
      },
      captions: {
        type: Types.String,
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
        pre: async function (payload, request, logger) {
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

    updateTags: async function ({ _id, oldTags, currentTags, logger }) {
      const nameAndRank = (a, b) => {
        return a.tag.name === b.tag.name && a.rank === b.rank;
      };

      // Filter out "ghost" tags (not sure how this occurs)
      oldTags = oldTags.filter((t) => t.tag !== null);
      currentTags = currentTags.filter((t) => t.tag !== null);

      const deletedTags = _.differenceBy(oldTags, currentTags, 'tag.name');
      const newTags = _.differenceWith(currentTags, oldTags, nameAndRank);

      const existingTagsToAdd = (
        await RestHapi.list({
          model: 'tag',
          query: {
            name: newTags.map((t) => t.tag.name),
          },
        })
      ).docs;

      const tagsToCreateAndAdd = _.differenceBy(
        newTags.map((t) => ({ name: t.tag.name })),
        existingTagsToAdd,
        'name'
      );

      const newTagsToAdd = _.isEmpty(tagsToCreateAndAdd)
        ? []
        : await RestHapi.create({
            model: 'tag',
            payload: tagsToCreateAndAdd,
          });

      const tagsToAdd = [...newTagsToAdd, ...existingTagsToAdd].map((t) => ({
        childId: t._id,
        rank: currentTags.find((tt) => tt.tag.name === t.name).rank,
      }));
      const tagsToRemove = deletedTags.map((t) => t.tag._id);

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

      //Update segmentCount for current and old tags.
      const oldTagsToCountSegmentsFor = (
        await RestHapi.list({
          model: 'tag',
          query: {
            name: oldTags.map((t) => t.tag.name),
            isDeleted: false,
          },
        })
      ).docs;
      const oldTagsPromises = [];
      for (let i = 0; i < oldTagsToCountSegmentsFor.length; i++) {
        oldTagsPromises.push(
          Promise.all([
            oldTagsToCountSegmentsFor[i]._id,
            RestHapi.getAll({
              ownerModel: 'tag',
              ownerId: oldTagsToCountSegmentsFor[i]._id.toString(),
              childModel: 'segment',
              associationName: 'segments',
              query: {
                $count: true,
                isDeleted: false,
              },
            }),
          ]).then((res) => {
            const tagId = res[0];
            const segmentCount = res[1];
            const tagForSegments = oldTagsToCountSegmentsFor.find(
              (t) => t._id.toString() === tagId.toString()
            );
            tagForSegments.newSegmentCount =
              segmentCount === tagForSegments.segmentCount ? null : segmentCount;
          })
        );
      }

      const currentTagsToCountSegmentsFor = (
        await RestHapi.list({
          model: 'tag',
          query: {
            name: currentTags.map((t) => t.tag.name),
            isDeleted: false,
          },
        })
      ).docs;
      const currentTagsPromises = [];
      for (let i = 0; i < currentTagsToCountSegmentsFor.length; i++) {
        currentTagsPromises.push(
          Promise.all([
            currentTagsToCountSegmentsFor[i]._id,
            RestHapi.getAll({
              ownerModel: 'tag',
              ownerId: currentTagsToCountSegmentsFor[i]._id.toString(),
              childModel: 'segment',
              associationName: 'segments',
              query: {
                $count: true,
                isDeleted: false,
              },
            }),
          ]).then((res) => {
            const tagId = res[0];
            const segmentCount = res[1];
            const tagForSegments = currentTagsToCountSegmentsFor.find(
              (t) => t._id.toString() === tagId.toString()
            );
            tagForSegments.newSegmentCount =
              segmentCount === tagForSegments.segmentCount ? null : segmentCount;
          })
        );
      }

      await Promise.all(oldTagsPromises);
      await Promise.all(currentTagsPromises);

      const allTagsToCountSegmentsFor = oldTagsToCountSegmentsFor.concat(
        currentTagsToCountSegmentsFor
      );
      for (let i = 0; i < allTagsToCountSegmentsFor.length; i++) {
        if (!allTagsToCountSegmentsFor[i].newSegmentCount) continue;
        let tag = await RestHapi.update({
          model: 'tag',
          _id: allTagsToCountSegmentsFor[i]._id.toString(),
          payload: { segmentCount: allTagsToCountSegmentsFor[i].newSegmentCount },
        });
      }
      //Delete orphan tags
      const possibleOrphanTags = (
        await RestHapi.list({
          model: 'tag',
          query: {
            _id: tagsToRemove.map((t) => t.toString()),
            isDeleted: false,
            $embed: ['segments'],
          },
        })
      ).docs;
      for (let i = 0; i < possibleOrphanTags.length; i++) {
        if (possibleOrphanTags[i].segments.length < 1) {
          await RestHapi.deleteOne({
            model: 'tag',
            _id: possibleOrphanTags[i]._id.toString(),
            hardDelete: true,
          });
        }
      }
    },

    addCaptions: async function ({ seg, captions, logger }) {
      let segCaptions = '';
      let foundSegment = false;

      for (const cap of captions) {
        if (cap.start > seg.start && cap.start < seg.end) {
          if (!foundSegment) {
            foundSegment = true;
            if (captions.indexOf(cap) !== 0) {
              segCaptions = captions[captions.indexOf(cap) - 1].text;
            }
          }
          segCaptions = `${segCaptions} ${cap.text}`;
        }
        if (cap.start > seg.end) {
          break;
        }
      }

      await RestHapi.update('segment', seg._id, { captions: segCaptions }, logger);
    },
  };

  // Need index for stats
  Schema.index({ views: -1 });

  return Schema;
};
