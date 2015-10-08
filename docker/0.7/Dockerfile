# Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
# See License.txt for license information.
FROM ubuntu:14.04

#
# Install SQL
#

ENV MYSQL_ROOT_PASSWORD=mostest
ENV MYSQL_USER=mmuser
ENV MYSQL_PASSWORD=mostest
ENV MYSQL_DATABASE=mattermost_test

RUN groupadd -r mysql && useradd -r -g mysql mysql

RUN apt-key adv --keyserver pool.sks-keyservers.net --recv-keys A4A9406876FCBD3C456770C88C718D3B5072E1F5

ENV MYSQL_MAJOR 5.6
ENV MYSQL_VERSION 5.6.25

RUN echo "deb http://repo.mysql.com/apt/debian/ wheezy mysql-${MYSQL_MAJOR}" > /etc/apt/sources.list.d/mysql.list

RUN apt-get update \
	&& export DEBIAN_FRONTEND=noninteractive \
	&& apt-get -y install perl wget mysql-server \
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -rf /var/lib/mysql && mkdir -p /var/lib/mysql

RUN sed -Ei 's/^(bind-address|log)/#&/' /etc/mysql/my.cnf

VOLUME /var/lib/mysql
# ---------------------------------------------------------------------------------------------------------------------

WORKDIR /mattermost

# Copy over files
ADD https://github.com/mattermost/platform/releases/download/v0.7.1/mattermost.tar.gz /
RUN tar -zxvf /mattermost.tar.gz --strip-components=1 && rm /mattermost.tar.gz
ADD config_docker.json /
ADD docker-entry.sh /

RUN chmod +x /docker-entry.sh
ENTRYPOINT /docker-entry.sh

# Create default storage directory
RUN mkdir /mattermost-data/

# Ports
EXPOSE 80
