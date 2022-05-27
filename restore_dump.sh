#!/bin/bash

# This script is intended to be used to restore a database from a dump file
source .env-docker
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend

# Start the mongo service
docker-compose up -d mongo

# Restore the mbt utils database from the local dump file
docker-compose exec -T mongo mongorestore --archive --gzip < utilities/mbt_db_dump.gz
