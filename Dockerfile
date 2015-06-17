FROM ubuntu:14.04

# Install Dependancies
RUN apt-get update && apt-get install -y build-essential
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y ruby-full
RUN gem install compass

# Postfix
RUN apt-get install -y postfix

#
# Install GO
#

RUN apt-get update && apt-get install -y \
		gcc libc6-dev make git mercurial \
		--no-install-recommends \
	&& rm -rf /var/lib/apt/lists/*

ENV GOLANG_VERSION 1.4.2

RUN curl -sSL https://golang.org/dl/go$GOLANG_VERSION.src.tar.gz \
		| tar -v -C /usr/src -xz

RUN cd /usr/src/go/src && ./make.bash --no-clean 2>&1

ENV PATH /usr/src/go/bin:$PATH

RUN mkdir -p /go/src /go/bin && chmod -R 777 /go
ENV GOPATH /go
ENV PATH /go/bin:$PATH
WORKDIR /go

# ---------------------------------------------------------------------------------------------------------------------

#
# Install SQL
# 

ENV MYSQL_ROOT_PASSWORD=mostest
ENV MYSQL_USER=mmuser
ENV MYSQL_PASSWORD=mostest
ENV MYSQL_DATABASE=mattermost_test

RUN groupadd -r mysql && useradd -r -g mysql mysql

RUN apt-get update && apt-get install -y perl --no-install-recommends && rm -rf /var/lib/apt/lists/*

RUN apt-key adv --keyserver pool.sks-keyservers.net --recv-keys A4A9406876FCBD3C456770C88C718D3B5072E1F5

ENV MYSQL_MAJOR 5.6
ENV MYSQL_VERSION 5.6.25

RUN echo "deb http://repo.mysql.com/apt/debian/ wheezy mysql-${MYSQL_MAJOR}" > /etc/apt/sources.list.d/mysql.list

RUN apt-get update \
	&& export DEBIAN_FRONTEND=noninteractive \
	&& apt-get -y install mysql-server \ 
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -rf /var/lib/mysql && mkdir -p /var/lib/mysql

RUN sed -Ei 's/^(bind-address|log)/#&/' /etc/mysql/my.cnf

VOLUME /var/lib/mysql
# ---------------------------------------------------------------------------------------------------------------------

#
# Install Redis
#

RUN apt-get update && apt-get install -y wget
RUN wget http://download.redis.io/redis-stable.tar.gz; \
		tar xvzf redis-stable.tar.gz; \
		cd redis-stable; \
		make install

# ---------------------------------------------------------------------------------------------------------------------

# Copy over files
ADD . /go/src/github.com/mattermost/platform

# Insert postfix config
ADD ./config/main.cf /etc/postfix/

RUN go get github.com/tools/godep
RUN cd /go/src/github.com/mattermost/platform; godep restore 
RUN go install github.com/mattermost/platform
RUN cd /go/src/github.com/mattermost/platform/web/react; npm install 

RUN chmod +x /go/src/github.com/mattermost/platform/docker-entry.sh
ENTRYPOINT /go/src/github.com/mattermost/platform/docker-entry.sh

# Ports
EXPOSE 80
