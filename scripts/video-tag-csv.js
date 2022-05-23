'use strict';

process.env.NODE_ENV = 'local';
const path = require('path');
const Mongoose = require('mongoose');
const RestHapi = require('rest-hapi');
const Glue = require('@hapi/glue');
const Manifest = require('../config/manifest.conf');
const Config = require('../config');
const restHapiConfig = Config.get('/restHapiConfig');
const fs = require('fs');
const stringify = require('csv-stringify');

require('dotenv').config();

(async function processTags() {
  RestHapi.config.loglevel = 'DEBUG';
  const Log = RestHapi.getLogger('test.js');
  try {
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
    let videos = await RestHapi.list(Video, { $embed: 'segments.tags', isDeleted: false }, Log);

    const videoTags = videos.docs.map((v) => {
      const tags = v.segments.reduce((prev, curr, i) => {
        const tagNames = curr.tags.map((t) => (t.tag ? t.tag.name : ''));
        return prev.concat(tagNames);
      }, []);
      let uniqueTags = [...new Set(tags)].sort();

      return {
        videoTitle: v.youtube.snippet.title,
        videoId: v.youtube.id,
        tags: uniqueTags,
      };
    });

    stringify(
      videoTags,
      {
        header: true,
      },
      function (err, output) {
        console.log('ERR:', err);
        fs.writeFileSync(__dirname + '/mbt-video-tags.csv', output);

        Log.log('SCRIPT DONE!');
        process.exit(0);
      }
    );
  } catch (err) {
    Log.error(err);
    process.exit(1);
  }
})();
