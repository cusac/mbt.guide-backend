'use strict';

process.env.NODE_ENV = 'local';
const path = require('path');
const Mongoose = require('mongoose');
const RestHapi = require('rest-hapi');
const Config = require('../config');
const restHapiConfig = Config.get('/restHapiConfig');

require('dotenv').config();

(async function processTags() {
  RestHapi.config.loglevel = 'ERROR';
  const Log = RestHapi.getLogger('delete-old-logs.js');
  try {
    Mongoose.connect(restHapiConfig.mongo.URI);
    RestHapi.config = restHapiConfig;
    RestHapi.config.absoluteModelPath = true;
    RestHapi.config.modelPath = path.join(__dirname, '/../server/models');
    let models = await RestHapi.generateModels(Mongoose);

    //DO WORK
    const AuditLog = Mongoose.model('auditLog');
    const days = 30;

    let day = 1;

    // This will delete all the logs going back a year (keeping those that are less than 30 days old), one day at a time
    while (day < 360) {
      const deleteStartDate = new Date();
      const deleteEndDate = new Date();
      deleteStartDate.setDate(deleteStartDate.getDate() - days);
      deleteEndDate.setDate(deleteEndDate.getDate() - (days + day));

      const logs = await RestHapi.list(
        AuditLog,
        { $where: { date: { $lte: deleteStartDate, $gte: deleteEndDate } }, $select: '_id' },
        Log
      );

      Log.error('Deleting old logs....');

      Log.error('LOGS:', logs.docs.length);

      const payload = logs.docs.map((l) => ({ _id: l._id, hardDelete: true }));

      const resp = await RestHapi.deleteMany({ model: AuditLog, payload, Log });

      Log.error('resp:', resp);

      day += 1;
    }

    Log.error('SCRIPT DONE!');
    process.exit(0);
  } catch (err) {
    Log.error(err);
    process.exit(1);
  }
})();
