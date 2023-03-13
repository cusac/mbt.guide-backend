#!/bin/bash

# This script is intended to be used to create a dump of a database specified in MONGODB_URI
source .env-util
export COMPOSE_PROJECT_NAME=mbt_guide_backend_util

# Start the mongo service
docker-compose -f docker-compose.util.yml up -d mongo

# Run mongodump in the container and pipe the result to the current local directory

# Uncomment the line below to connect to the prod db using a certificate
# docker-compose -f docker-compose.util.yml exec -T mongo mongodump --archive --gzip --uri ${MONGODB_URI} --sslCAFile "usr/src/mbt-mongo.pem" > mbt_db_dump.gz

# Uncomment the line below to connect to a normal db
docker-compose -f docker-compose.util.yml exec -T mongo mongodump --archive --db mbt > mbt_db_dump_nozip


# Stop the services
docker-compose -f docker-compose.util.yml down
