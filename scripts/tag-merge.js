'use strict';

process.env.NODE_ENV = 'local';
const path = require('path');
const Mongoose = require('mongoose');
const RestHapi = require('rest-hapi');
const Config = require('../config');
const restHapiConfig = Config.get('/restHapiConfig');
const Manifest = require('../config/manifest.conf');
const Glue = require('@hapi/glue');
const _ = require('lodash');

(async function processTags() {
  RestHapi.config.loglevel = 'LOG';
  const Log = RestHapi.getLogger('tag-merge.js');
  try {
    Mongoose.connect(restHapiConfig.mongo.URI);
    RestHapi.config = restHapiConfig;
    RestHapi.config.absoluteModelPath = true;
    RestHapi.config.modelPath = path.join(__dirname, '/../server/models');
    let models = await RestHapi.generateModels(Mongoose);

    const Tag = Mongoose.model('tag');

    const USER_ROLES = Config.get('/constants/USER_ROLES');

    //DO WORK

    const videos = await RestHapi.list({
      model: 'video',
      query: { $embed: ['segments.tags'] },
    });

    const manifest = Manifest.get('/');
    const composeOptions = {
      relativeTo: path.join(__dirname, '/../'),
    };
    const server = await Glue.compose(manifest, composeOptions);
    await server.start();

    for (let i = 0; i < videos.docs.length; i++) {
      let video = videos.docs[i];
      Log.log('video: ', video.title);
      if (video.segments.length < 1) continue;
      let updatedSegments = [];
      let segmentsUpdated = false;
      for (let j = 0; j < video.segments.length; j++) {
        const segment = videos.docs[i].segments[j];
        Log.note('segment: ', segment.title);
        let updatedSegment = {
          segmentId: segment.segmentId,
          video: video._id.toString(),
          start: segment.start,
          end: segment.end,
          title: segment.title,
          description: segment.description,
          pristine: false,
        };
        let updatedTags = [];
        for (let k = 0; k < segment.tags.length; k++) {
          let tag = segment.tags[k];
          if (!tag.tag || tag.tag.isDeleted == true) continue;
          const oldTagName = tag.tag.name;
          const newTagName = Tag.standardizeTag(oldTagName);
          if (oldTagName != newTagName) {
            segmentsUpdated = true;
            Log.note('Old tagname: ', oldTagName);
            Log.note('New tagname: ', newTagName);
          }
          let updatedTag = {
            rank: tag.rank,
            tag: { name: newTagName },
          };
          updatedTags.push(updatedTag);
        } //tag
        Log.note('Pushing updated segments for: ', segment.title);
        updatedSegment.tags = updatedTags;
        updatedSegments.push(updatedSegment);
      } //segment

      if (segmentsUpdated) {
        let updatePayload = {
          videoId: video.ytId,
          segments: updatedSegments,
        };
        let request = {
          method: 'POST',
          url: '/update-video-segments',
          params: {},
          query: {},
          payload: updatePayload,
          credentials: { scope: ['root', USER_ROLES.SUPER_ADMIN] },
          headers: { authorization: 'Bearer' },
        };
        let injectOptions = RestHapi.testHelper.mockInjection(request);
        Log.log('Calling update-video-segments API');
        let result = await server.inject(injectOptions);
        Log.log('API call status code:', result.statusCode);
      } else {
        Log.note('No segments changed, skipping video.');
      }
    } //video

    Log.log('SCRIPT DONE!');
    process.exit(0);
  } catch (err) {
    Log.error(err);
    process.exit(1);
  }
})();
