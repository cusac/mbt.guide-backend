#!/bin/bash

source .env-tests
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend_tests

# Start the mongo service
docker-compose -f docker-compose.e2e.test.yml up -d mongo
