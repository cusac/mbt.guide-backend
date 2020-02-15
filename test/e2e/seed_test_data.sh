#!/bin/bash

source .env-tests
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend_tests

# Seed test data from seed script
docker-compose -f docker-compose.seed.yml build seed 
docker-compose -f docker-compose.seed.yml up seed

docker-compose -f docker-compose.seed.yml down
