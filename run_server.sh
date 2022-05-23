#!/bin/bash

source .env-docker
export SERVER_PORT=${SERVER_PORT}
export COMPOSE_PROJECT_NAME=mbt_guide_backend
docker-compose up