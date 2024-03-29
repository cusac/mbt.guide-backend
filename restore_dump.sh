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
# docker-compose exec -T mongo mongorestore --archive --gzip --uri ${MONGODB_URI} --sslCAFile ${MONGO_CERT_FILE} < mbt_db_dump.gz
docker-compose exec -T mongo mongorestore --archive --gzip -u ${MONGODB_USER} -p ${MONGODB_PASSWORD} --host ${MONGODB_HOST} --authenticationDatabase=admin --ssl --sslCAFile ${MONGO_CERT_FILE} < mbt_db_dump.gz


# Restore the mbt utils database from the local dump file
# docker-compose exec -T mongo mongorestore --archive --gzip < mbt_db_dump.gz


# Stop the services
# docker-compose down
