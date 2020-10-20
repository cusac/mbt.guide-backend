'use strict';

process.env.NODE_ENV = 'local';
const path = require('path');
const Mongoose = require('mongoose');
const RestHapi = require('rest-hapi');
const Glue = require('@hapi/glue');
const Manifest = require('../config/manifest.conf');
const Config = require('../config');
const restHapiConfig = Config.get('/restHapiConfig');

require('dotenv').config();

(async function processTags() {
  RestHapi.config.loglevel = 'DEBUG';
  const Log = RestHapi.getLogger('orphan-tags.js');
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
    const server = await Glue.compose(manifest, composeOptions);
    await server.start();

    //DO WORK
    const Tag = Mongoose.model('tag');
    const tags = await RestHapi.list(Tag, { isDeleted: false, $embed: ['segments'] }, Log);
    //console.log(tags);
    const orphaned_tags = tags.docs.filter((t) => t.segments.length === 0);
    //console.log(orphaned_tags);

    console.log('Deleting orphan tags....');
    await RestHapi.deleteMany({
      model: 'tag',
      payload: orphaned_tags.map((t) => t._id.toString()),
      hardDelete: true,
      Log: Log,
    });

    Log.log('SCRIPT DONE!');
    process.exit(0);
  } catch (err) {
    Log.error(err);
    process.exit(1);
  }
})();
