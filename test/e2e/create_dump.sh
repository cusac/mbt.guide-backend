#!/bin/bash

source .env-tests
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend_tests

# Start the mongo service
docker-compose -f docker-compose.e2e.test.yml up -d mongo

# Run mongodump in the container and pipe the result to the current local directory
docker-compose -f docker-compose.e2e.test.yml exec -T mongo mongodump --archive --gzip --db mbt-test > mbt_db_tests.gz
# docker-compose -f docker-compose.e2e.test.yml exec -T mongo mongodump > mbt_db_tests.bson

# Stop the services
docker-compose -f docker-compose.e2e.test.yml down
