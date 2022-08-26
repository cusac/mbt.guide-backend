'use strict';

const Joi = require('joi');
const Chalk = require('chalk');
const RestHapi = require('rest-hapi');
const stringSimilarity = require('string-similarity');
const errorHelper = require('../utilities/error-helper');

module.exports = function (server, mongoose, logger) {
  // Tag Match Endpoint
  (function () {
    const Tag = mongoose.model('tag');
    const Log = logger.bind(Chalk.magenta('Tagmatch'));

    Log.note('Generating Tag Match endpoint');

    const tagMatchHandler = async function (request, h) {
      try {
        //Parse passed query parameters
        let tagText = request.query.tagtext;
        let maxMatches = request.query.maxmatches ? parseInt(request.query.maxmatches) : 30;

        //Get a list of all tags in database
        const allTags = (await RestHapi.list(Tag, { isDeleted: false }, Log)).docs;

        //Determine match rating for each database tag compared to passed tag
        let tagarray = allTags.map(function (item) {
          return item.name;
        });
        let tagRatings = stringSimilarity.findBestMatch(tagText, tagarray).ratings;

        //Sort results by rating (highest first)
        let sortedTagRatings = tagRatings.sort((a, b) =>
          a.rating < b.rating ? 1 : b.rating < a.rating ? -1 : 0
        );

        //Take only as many matches as requested
        let matches = sortedTagRatings.slice(0, maxMatches);

        //Get segmentCount for each match from original tag record
        matches.forEach((match) => {
          let matchingTagRecord = allTags.filter((tag) => tag.name == match.target)[0];
          let segmentCount = matchingTagRecord.segmentCount;
          match.segmentCount = segmentCount;
        });

        return matches;
      } catch (err) {
        errorHelper.handleError(err, Log);
      }
    };

    server.route({
      method: 'GET',
      path: '/tagmatch',
      config: {
        handler: tagMatchHandler,
        auth: null,
        description: 'Seach for matching tags.',
        tags: ['api', 'Tags', 'search'],
        validate: {
          query: {
            tagtext: Joi.string().required(),
            maxmatches: Joi.number(),
          },
        },
        plugins: {
          'hapi-swagger': {
            responseMessages: [
              { code: 200, message: 'Success' },
              { code: 400, message: 'Bad Request' },
              { code: 404, message: 'Not Found' },
              { code: 500, message: 'Internal Server Error' },
            ],
          },
        },
      },
    });
  })();
};
