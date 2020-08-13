'use strict';
let Boom = require('@hapi/boom');

function handleError(err, Log) {
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
    throw Boom.badImplementation(err);
  }
}

module.exports = {
  handleError,
};
