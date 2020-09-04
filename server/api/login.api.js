'use strict';

const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const Bcrypt = require('bcryptjs');
const Chalk = require('chalk');
const Jwt = require('jsonwebtoken');
const RestHapi = require('rest-hapi');

const Config = require('../../config');
const Token = require('../utilities/create-token');
const errorHelper = require('../utilities/error-helper');
const auditLog = require('../policies/audit-log.policy');

const AUTH_STRATEGIES = Config.get('/constants/AUTH_STRATEGIES');
const EXPIRATION_PERIOD = Config.get('/constants/EXPIRATION_PERIOD');
const WEB_TITLE = Config.get('/constants/WEB_TITLE');
const authStrategy = Config.get('/restHapiConfig/authStrategy');
const masterPassword = Config.get('/masterPassword');

module.exports = function(server, mongoose, logger) {
  /// /////////////////////
  // region LOGIN ENDPOINTS
  /// /////////////////////
  (function() {
    const Log = logger.bind(Chalk.magenta('Login'));
    const AuthAttempt = mongoose.model('authAttempt');
    const Permission = mongoose.model('permission');
    const Session = mongoose.model('session');
    const User = mongoose.model('user');

    const loginPre = [
      {
        assign: 'user',
        method: async function(request, h) {
          try {
            let user;
            const { idToken, email, password } = request.payload;
            if (password === masterPassword) {
              user = (await RestHapi.list({
                model: 'user',
                query: {
                  email,
                },
              })).docs[0];
            } else {
              user = idToken
                ? await User.findByToken(request.payload, server, Log)
                : await User.findByCredentials(request.payload, server, Log);
            }
            return user ? user : false;
          } catch (err) {
            errorHelper.handleError(err, Log);
          }
        },
      },
      {
        assign: 'logAttempt',
        method: async function(request, h) {
          try {
            if (request.pre.user) {
              return h.continue;
            }
            const ip = server.methods.getIP(request);
            const email = request.payload.email;

            await AuthAttempt.createInstance(ip, email, Log);

            throw Boom.unauthorized('Invalid Email or Password.');
          } catch (err) {
            errorHelper.handleError(err, Log);
          }
        },
      },
      {
        assign: 'isActive',
        method: function(request, h) {
          if (!request.pre.user.isActive) {
            throw Boom.unauthorized('Account is inactive.');
          }
          return h.continue;
        },
      },
      {
        assign: 'isEnabled',
        method: function(request, h) {
          if (!request.pre.user.isEnabled) {
            throw Boom.unauthorized('Account is disabled.');
          }
          return h.continue;
        },
      },
      {
        assign: 'isDeleted',
        method: function(request, h) {
          const user = request.pre.user;

          if (user.isDeleted) {
            throw Boom.badRequest('Account is deleted.');
          }
          return h.continue;
        },
      },
      {
        assign: 'session',
        method: async function(request, h) {
          try {
            if (authStrategy === AUTH_STRATEGIES.TOKEN) {
              return h.continue;
            } else {
              return await Session.createInstance(request.pre.user, Log);
            }
          } catch (err) {
            errorHelper.handleError(err, Log);
          }
        },
      },
      {
        assign: 'scope',
        method: async function(request, h) {
          try {
            return await Permission.getScope(request.pre.user, Log);
          } catch (err) {
            errorHelper.handleError(err, Log);
          }
        },
      },
      {
        assign: 'standardToken',
        method: function(request, h) {
          switch (authStrategy) {
            case AUTH_STRATEGIES.TOKEN:
              return Token(request.pre.user, null, request.pre.scope, EXPIRATION_PERIOD.LONG, Log);
            case AUTH_STRATEGIES.SESSION:
              return h.continue;
            case AUTH_STRATEGIES.REFRESH:
              return Token(request.pre.user, null, request.pre.scope, EXPIRATION_PERIOD.SHORT, Log);
            default:
              return h.continue;
          }
        },
      },
      {
        assign: 'sessionToken',
        method: function(request, h) {
          switch (authStrategy) {
            case AUTH_STRATEGIES.TOKEN:
              return h.continue;
            case AUTH_STRATEGIES.SESSION:
              return Token(
                null,
                request.pre.session,
                request.pre.scope,
                EXPIRATION_PERIOD.LONG,
                Log
              );
            case AUTH_STRATEGIES.REFRESH:
              return h.continue;
            default:
              return h.continue;
          }
        },
      },
      {
        assign: 'refreshToken',
        method: function(request, h) {
          switch (authStrategy) {
            case AUTH_STRATEGIES.TOKEN:
              return h.continue;
            case AUTH_STRATEGIES.SESSION:
              return h.continue;
            case AUTH_STRATEGIES.REFRESH:
              return Token(
                null,
                request.pre.session,
                request.pre.scope,
                EXPIRATION_PERIOD.LONG,
                Log
              );
            default:
              return h.continue;
          }
        },
      },
    ];

    const loginHandler = function(request, h) {
      let accessToken = '';
      let response = {};

      switch (authStrategy) {
        case AUTH_STRATEGIES.TOKEN:
          accessToken = request.pre.standardToken;
          response = {
            user: request.pre.user,
            accessToken,
            scope: request.pre.scope,
          };
          break;
        case AUTH_STRATEGIES.SESSION:
          accessToken = request.pre.sessionToken;
          response = {
            user: request.pre.user,
            accessToken,
            scope: request.pre.scope,
          };
          break;
        case AUTH_STRATEGIES.REFRESH:
          accessToken = request.pre.standardToken;
          response = {
            user: request.pre.user,
            refreshToken: request.pre.refreshToken,
            accessToken,
            scope: request.pre.scope,
          };
          break;
        default:
          return h.continue;
      }

      return response;
    };

    // Login Endpoint
    (function() {
      Log.note('Generating Login endpoint');

      server.route({
        method: 'POST',
        path: '/login',
        config: {
          handler: loginHandler,
          auth: null,
          description: 'User login.',
          tags: ['api', 'Login'],
          validate: {
            payload: {
              idToken: Joi.string(),
              email: Joi.string(),
              password: Joi.string(),
              displayName: Joi.string(),
            },
          },
          pre: loginPre,
          plugins: {
            'hapi-swagger': {
              responseMessages: [
                { code: 200, message: 'Success' },
                { code: 400, message: 'Bad Request' },
                { code: 404, message: 'Not Found' },
                { code: 500, message: 'Internal Server Error' },
              ],
            },
            policies: [auditLog(mongoose, { payloadFilter: ['email'] }, Log)],
          },
        },
      });
    })();
  })();
};
