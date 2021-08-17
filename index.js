'use strict';
const Glue = require('@hapi/glue');
const RestHapi = require('rest-hapi');
const Manifest = require('./config/manifest.conf');
const Sentry = require('@sentry/node');
const Config = require('./config');
const composeOptions = {
  relativeTo: __dirname,
};

const startServer = async function () {
  try {
    const manifest = Manifest.get('/');
    const server = await Glue.compose(manifest, composeOptions);

    await server.start();

    RestHapi.logUtil.logActionComplete(RestHapi.logger, 'Server Initialized', server.info);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

const sentryDSN = Config.get('/sentryDSN');
//This initializes Sentry for error logging, even for errors we do not catch specifically
Sentry.init({ dsn: sentryDSN });

startServer();
