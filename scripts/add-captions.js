'use strict';

process.env.NODE_ENV = 'local';
const path = require('path');
const Mongoose = require('mongoose');
const RestHapi = require('rest-hapi');
const Glue = require('@hapi/glue');
const Manifest = require('../config/manifest.conf');
const Config = require('../config');
const restHapiConfig = Config.get('/restHapiConfig');
const getSubtitles = require('youtube-captions-scraper').getSubtitles;

require('dotenv').config();

(async function processTags() {
  RestHapi.config.loglevel = 'DEBUG';
  const Log = RestHapi.getLogger('add-captions.js');
  try {
    Log.debug('URI:', restHapiConfig.mongo.URI);
    Mongoose.connect(restHapiConfig.mongo.URI);
    RestHapi.config = restHapiConfig;
    RestHapi.config.absoluteModelPath = true;
    RestHapi.config.modelPath = path.join(__dirname, '/../server/models');
    let models = await RestHapi.generateModels(Mongoose);
    const composeOptions = {
      relativeTo: path.join(__dirname, '/../'),
    };
    const manifest = Manifest.get('/');
    // const server = await Glue.compose(manifest, composeOptions);
    // await server.start();

    //DO WORK
    const Video = Mongoose.model('video');
    const Segment = Mongoose.model('segment');
    let videos = await RestHapi.list(Video, { isDeleted: false, $embed: ['segments'] }, Log);

    for (const video of videos.docs) {
      Log.log('Processing video: ', video.title);
      let captions = [];
      try {
        const captions = await getSubtitles({
          videoID: video.ytId, // youtube video id
          lang: 'en', // default: `en`
        });
      } catch (err) {
        Log.debug(err);
        continue;
      }

      for (const seg of video.segments) {
        if (seg.captions) {
          continue;
        }
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

        await RestHapi.update(Segment, seg._id, { captions: segCaptions }, Log);
      }
    }

    Log.log('SCRIPT DONE!');
    process.exit(0);
  } catch (err) {
    Log.error(err);
    process.exit(1);
  }
})();
