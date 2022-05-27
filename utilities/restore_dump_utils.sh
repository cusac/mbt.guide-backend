#!/bin/bash

# This script is intended to be used to restore a database from a dump file
source .env-util
export COMPOSE_PROJECT_NAME=mbt_guide_backend_util

# Start the mongo service
docker-compose -f docker-compose.util.yml up -d mongo

# Restore the mbt utils database from the local dump file
docker-compose -f docker-compose.util.yml exec -T mongo mongorestore --archive --gzip < mbt_db_dump.gz

# Stop the services
docker-compose -f docker-compose.util.test.yml down
