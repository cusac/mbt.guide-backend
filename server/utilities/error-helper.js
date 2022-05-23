'use strict';
let Boom = require('@hapi/boom');
const Sentry = require('@sentry/node');

function handleError(err, Log) {
  //This logs the exception, including any appended fields such as data and sensitiveData
  Sentry.captureException(err);

  if (err.isBoom) {
    Log.error(err);
    if (err.data) {
      Log.error('Additional data: ', err.data);
      err.output.payload.data = err.data;
    }
    if (err.sensitiveData) {
      Log.error('Sensitive data: ', err.sensitiveData);
    }
    throw err;
  } else {
    Log.error(err);
    console.trace();
    throw Boom.badImplementation(err);
  }
}

module.exports = {
  handleError,
};
