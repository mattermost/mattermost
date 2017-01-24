#!/bin/bash -x

set -e

PREV_DIR=$(pwd)

### prereqs
PACKAGES="nodejs npm ruby2.1 ruby2.1-dev rubygems"

apt-get update
apt-get install -y ${PACKAGES}
npm install -g n
n 5.1.1
gem install compass

### build
cd $SRC_DIR/web/react/
/usr/bin/npm install
/usr/bin/npm run build-libs
/usr/bin/npm run build
cd ../sass-files
compass compile -e production --force

### cleanup
/usr/bin/npm rm n
gem uninstall -x compass
apt-get remove -y ${PACKAGES}
apt-get autoremove -y
apt-get clean

rm -rf /usr/local/include/node/
rm -f /usr/local/bin/node
rm -f /usr/local/bin/npm
rm -f /usr/local/bin/n
rm -f /usr/local/bin/compass
rm -f /usr/local/bin/sass*
rm -f /usr/local/bin/scss
rm -rf /usr/local/n/
rm -rf /usr/local/lib/node_modules/

rm -rf /tmp/* /var/tmp/*
rm -rf /var/lib/apt/lists/*

cd "${PREV_DIR}"
