#!/bin/bash

# TODO: make sure mongo image is up to date/latest version

# This script is intended to be used to create a dump of a database specified in MONGODB_URI
export COMPOSE_PROJECT_NAME=mbt_guide_backend

# create env vars from the contents of the .env file
export $(cat .env-util | xargs)

# Start the mongo service
docker-compose up -d mongo

# Run mongodump in the container and pipe the result to the current local directory

# Uncomment the line below to connect to the prod db using a certificate
docker-compose exec -T mongo mongodump --archive --gzip --uri ${MONGODB_URI} --sslCAFile ${MONGO_CERT_FILE} > mbt_db_dump.gz


# Uncomment the line below to connect to a normal db
# docker-compose exec -T mongo mongodump --archive="mbt_db_dump.db" > mbt_db_dump.db


# Stop the services
# docker-compose down
