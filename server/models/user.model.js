'use strict';

const Bcrypt = require('bcryptjs');
const RestHapi = require('rest-hapi');
const Boom = require('@hapi/boom');
const errorHelper = require('../utilities/error-helper');

const permissionAuth = require('../policies/permission-auth.policy');
const groupAuth = require('../policies/group-auth.policy');
const rankAuth = require('../policies/role-auth.policy').rankAuth;
const promoteAuth = require('../policies/role-auth.policy').promoteAuth;

const Config = require('../../config');

const enableDemoAuth = Config.get('/enableDemoAuth');
const demoAuth = enableDemoAuth ? 'demoAuth' : null;

const USER_ROLES = Config.get('/constants/USER_ROLES');

const awsAccessKeyId = Config.get('/awsAccessKeyId');
const awsSecretAccessKey = Config.get('/awsSecretAccessKey');

const firebase = require('firebase/app');
require('firebase/auth');
require('firebase/firestore');
const admin = require('firebase-admin');
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
});
const s3 = new AWS.S3();
s3.getObject({ Bucket: 'mbt-guide-private-keys', Key: 'mbt-guide-b41e8f3aa8b4.json' }, function(
  error,
  data
) {
  if (error != null) {
    console.error('Error loading firebase admin cert:', error);
  } else {
    const serviceAccount = JSON.parse(data.Body.toString());
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://mbt-guide-d9b1b.firebaseio.com',
    });
  }
});

const firebaseConfig = require('../../config/firebaseConfig');
const firebaseApp = firebase.initializeApp(firebaseConfig);

//TODO: Import test users
const testUsers = ['test@superadmin.com', 'test@admin.com'];

module.exports = function(mongoose) {
  const modelName = 'user';
  const Types = mongoose.Schema.Types;
  const Schema = new mongoose.Schema(
    {
      firstName: {
        type: Types.String,
        required: true,
      },
      lastName: {
        type: Types.String,
        required: true,
      },
      email: {
        unique: true,
        type: Types.String,
        required: true,
        stringType: 'email',
      },
      profileImageUrl: {
        type: Types.String,
        stringType: 'uri',
      },
      role: {
        type: Types.ObjectId,
        ref: 'role',
      },
      isActive: {
        type: Types.Boolean,
        allowOnUpdate: false,
        default: false,
      },
      isEnabled: {
        type: Types.Boolean,
        allowOnUpdate: false,
        default: true,
      },
    },
    { collection: modelName }
  );

  Schema.statics = {
    collectionName: modelName,
    routeOptions: {
      authorizeDocumentCreator: false,
      policies: {
        associatePolicies: [
          rankAuth(mongoose, 'ownerId'),
          permissionAuth(mongoose, false),
          groupAuth(mongoose, false),
          demoAuth,
        ],
        updatePolicies: [rankAuth(mongoose, '_id'), promoteAuth(mongoose), demoAuth],
        deletePolicies: [rankAuth(mongoose, '_id'), demoAuth],
      },
      routeScope: {
        // Users can access their own Notifications
        getUserNotificationsScope: 'user-{params.ownerId}',
        // Users can access their own Connections
        getUserConnectionsScope: 'user-{params.ownerId}',
        // Users can access their own Documents
        getUserDocumentsScope: 'user-{params.ownerId}',
        // Users can access their own Shared Documents
        getUserSharedDocumentsScope: 'user-{params.ownerId}',
        // Users can access their own Images
        getUserImagesScope: 'user-{params.ownerId}',
      },
      associations: {
        role: {
          type: 'MANY_ONE',
          model: 'role',
          duplicate: [
            {
              field: 'name',
            },
            {
              field: 'rank',
            },
          ],
        },
        groups: {
          type: 'MANY_MANY',
          alias: 'group',
          model: 'group',
        },
        permissions: {
          type: 'MANY_MANY',
          alias: 'permission',
          model: 'permission',
          linkingModel: 'user_permission',
        },
        connections: {
          type: 'ONE_MANY',
          alias: 'connection',
          foreignField: 'primaryUser',
          model: 'connection',
        },
        conversations: {
          type: 'MANY_MANY',
          alias: 'conversation',
          model: 'conversation',
          linkingModel: 'user_conversation',
        },
        documents: {
          type: 'ONE_MANY',
          alias: 'document',
          foreignField: 'owner',
          model: 'document',
        },
        segments: {
          type: 'ONE_MANY',
          alias: 'segment',
          foreignField: 'owner',
          model: 'segment',
        },
        sharedDocuments: {
          type: 'MANY_MANY',
          alias: 'shared-document',
          model: 'document',
          linkingModel: 'user_document',
        },
        images: {
          type: 'ONE_MANY',
          alias: 'image',
          foreignField: 'owner',
          model: 'image',
        },
        notifications: {
          type: 'ONE_MANY',
          alias: 'notification',
          foreignField: 'primaryUser',
          model: 'notification',
        },
      },
      create: {
        post: async function(document, request, result, logger) {
          const Log = logger.bind();
          try {
            const User = mongoose.model('user');
            if (!document.profileImageUrl) {
              let profileImageUrl =
                'https://www.gravatar.com/avatar/' + document._id + '?r=PG&d=robohash';
              return await RestHapi.update(User, document._id, { profileImageUrl }, Log);
            } else {
              return document;
            }
          } catch (err) {
            errorHelper.handleError(err, Log);
          }
        },
      },
    },

    generateHash: async function(key, logger) {
      const Log = logger.bind();
      try {
        let salt = await Bcrypt.genSalt(10);
        let hash = await Bcrypt.hash(key, salt);
        return { key, hash };
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    },
    findByToken: async function(payload, server, logger) {
      const Log = logger.bind();

      const Role = mongoose.model('role');
      try {
        let { idToken, email, password, displayName } = payload;

        if (!idToken && (!email || !password)) {
          throw Boom.badRequest('Either idToken or email and password required');
        }

        let firebaseUser;

        try {
          firebaseUser = idToken ? await admin.auth().verifyIdToken(idToken) : { email, password };
        } catch (err) {
          throw Boom.unauthorized('Invalid idToken');
        }

        console.log('PAYLOAD:', payload);
        console.log('FIRE USER:', firebaseUser);
        console.log('FIRE:', firebaseUser.firebase);

        const self = this;
        let user;

        const query = {
          email: firebaseUser.email,
        };

        let mongooseQuery = self.findOne(query);

        user = await mongooseQuery.lean();

        // If user doesn't exist, create one
        if (!user) {
          if (!firebaseUser.name && !displayName) {
            throw Boom.badRequest('Display name required.');
          }

          const userRole = (await RestHapi.list(Role, { name: USER_ROLES.USER }, Log)).docs[0];

          const [firstName, lastName] = (firebaseUser.name || displayName).split(' ');

          user = {
            firstName,
            lastName,
            email: firebaseUser.email,
            profileImageUrl: firebaseUser.picture,
            isActive: firebaseUser.email_verified,
            role: userRole._id,
          };

          user = await RestHapi.create({
            model: 'user',
            payload: user,
            restCall: true,
          });
        }

        user = await this.updateActive({ firebaseUser, user });

        return user;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    },
    findByCredentials: async function(payload, server, logger) {
      const Log = logger.bind();
      try {
        const self = this;
        const { email, password } = payload;

        if (!email || !password) {
          throw Boom.badRequest('Either idToken or email and password required');
        }

        let result;

        try {
          result = await firebaseApp.auth().signInWithEmailAndPassword(email, password);
        } catch (err) {
          //TODO: If test user, check if error is because user doesn't exist and if so, create the user (in firebase)
          Log.error(err);
          return false;
        }

        const query = {
          email: result.user.email.toLowerCase(),
          isDeleted: false,
        };

        let mongooseQuery = self.findOne(query);

        let user = await mongooseQuery.lean();

        user = await this.updateActive({ firebaseUser: result.user, user });

        return user ? user : false;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    },
    updateActive: async function({ firebaseUser, user }) {
      if (
        user &&
        user.isActive !== firebaseUser.email_verified &&
        !testUsers.includes(user.email)
      ) {
        user = await RestHapi.update({
          model: 'user',
          _id: user._id,
          payload: {
            isActive: firebaseUser.email_verified,
          },
        });
      }
      return user;
    },
  };

  return Schema;
};
