# Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
# See License.txt for license information.
FROM ubuntu:14.04

# Install Dependancies
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup | bash -


RUN mkdir -p /zbox
WORKDIR /zbox


# Copy over files
ADD ./dist/zbox/ /zbox/

ADD /docker/test/config_docker.json /zbox/config/config.json
ADD /docker/test/docker-entry.sh /

RUN chmod +x /docker-entry.sh
ENTRYPOINT /docker-entry.sh

# Create default storage directory
RUN mkdir -p /zbox/data/

# Ports
EXPOSE 80
