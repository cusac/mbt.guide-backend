#!/bin/bash

source ./test/e2e/.env-tests
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend_tests

# Start the mongo and api services
docker-compose -f ./test/e2e/docker-compose.e2e.test.yml up -d --build

# Drop the mbt test database
docker-compose -f ./test/e2e/docker-compose.e2e.test.yml exec -T mongo mongo mbt-test --eval "db.dropDatabase()"
# Restore the mbt test database from the local dump file
docker-compose -f ./test/e2e/docker-compose.e2e.test.yml exec -T mongo mongorestore --archive --gzip < ./test/e2e/mbt_db_tests.gz

# Run the tests
jest ./test/e2e/end-to-end.test.js

# Bring down the containers
docker-compose -f ./test/e2e/docker-compose.e2e.test.yml down