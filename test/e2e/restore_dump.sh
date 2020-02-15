#!/bin/bash

source .env-tests
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend_tests

# Start the mongo service
docker-compose -f docker-compose.e2e.test.yml up -d mongo

# Restore the mbt test database from the local dump file
docker-compose -f docker-compose.e2e.test.yml exec -T mongo mongorestore --archive --gzip < mbt_db_tests.gz
# docker-compose -f docker-compose.e2e.test.yml exec -T mongo mongorestore < 

# Stop the services
docker-compose -f docker-compose.e2e.test.yml down
