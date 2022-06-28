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
    const Segment = Mongoose.model('segment');
    let segments = await RestHapi.list(Segment, { $embed: 'tags', isDeleted: false }, Log);

    const segmentTags = segments.docs.map((s) => {
      const tagNames = s.tags.map((t) => (t.tag ? t.tag.name : ''));
      return {
        segmentTitle: s.title,
        segmentId: s.segmentId,
        tags: tagNames,
      };
    });

    stringify(
      segmentTags,
      {
        header: true,
      },
      function (err, output) {
        console.log('ERR:', err);
        fs.writeFileSync(__dirname + '/mbt-segment-tags.csv', output);

        Log.log('SCRIPT DONE!');
        process.exit(0);
      }
    );
  } catch (err) {
    Log.error(err);
    process.exit(1);
  }
})();
