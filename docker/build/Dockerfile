# Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
# See License.txt for license information.
FROM ubuntu:14.04

# Install Dependancies
RUN apt-get update \
    && apt-get install -y curl \
    && curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash - \
    && apt-get install -y build-essential git nodejs ruby-full \
    && rm -rf /var/lib/apt/lists/*
# RUN npm update npm -g
RUN gem install compass

#
# Install GO
#

ENV GOLANG_VERSION 1.5.1
ENV GOLANG_DOWNLOAD_URL https://golang.org/dl/go$GOLANG_VERSION.linux-amd64.tar.gz
ENV GOLANG_DOWNLOAD_SHA1 46eecd290d8803887dec718c691cc243f2175fe0

RUN curl -fsSL "$GOLANG_DOWNLOAD_URL" -o golang.tar.gz \
    && echo "$GOLANG_DOWNLOAD_SHA1  golang.tar.gz" | sha1sum -c - \
    && tar -C /usr/local -xzf golang.tar.gz \
    && rm golang.tar.gz

ENV GOPATH /go
ENV PATH $GOPATH/bin:/usr/local/go/bin:$PATH

RUN mkdir -p "$GOPATH/src" "$GOPATH/bin" && chmod -R 777 "$GOPATH"
RUN go get github.com/tools/godep

# Define volume
VOLUME /go/src/github.com/mattermost/platform
WORKDIR /go/src/github.com/mattermost/platform
ENTRYPOINT bash