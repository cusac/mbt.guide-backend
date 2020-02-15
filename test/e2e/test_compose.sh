#!/bin/bash

# This script provides an easy way to run docker-compose test commands 

source .env-tests
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend_tests

# Example command
# docker-compose -f docker-compose.e2e.test.yml up seed

# docker-compose -f docker-compose.e2e.test.yml run mongo mongod --repair
# docker-compose -f docker-compose.e2e.test.yml run mongo rm /data/db/mongod.lock
# docker-compose -f docker-compose.e2e.test.yml up mongo
# docker-compose -f docker-compose.e2e.test.yml rm -v mongo


docker-compose -f docker-compose.e2e.test.yml up -d mongo
# docker-compose -f docker-compose.e2e.test.yml up -d api