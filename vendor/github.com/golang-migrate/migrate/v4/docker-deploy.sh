#!/bin/bash

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin && \
docker build --build-arg VERSION="$TRAVIS_TAG" . -t migrate/migrate -t migrate/migrate:"$TRAVIS_TAG" && \
docker push migrate/migrate:"$TRAVIS_TAG" && docker push migrate/migrate
