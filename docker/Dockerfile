FROM ubuntu:xenial

RUN apt-get update && apt-get dist-upgrade -y
RUN apt-get install -y git golang build-essential npm nodejs nodejs-legacy libsass-dev libsass0
# fix build issue for windows
RUN chmod 777 /usr/lib/go-1.6/pkg
ENV HOME=/opt/platform
