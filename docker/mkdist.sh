#!/bin/bash -x

set -e

DIST_PATH="/opt/mattermost"
BUILD_NUMBER="foobar"

mkdir -p ${DIST_PATH}/bin
cp /go/bin/platform ${DIST_PATH}/bin

cp -RL config ${DIST_PATH}/config
touch ${DIST_PATH}/config/build.txt
echo ${BUILD_NUMBER} | tee -a ${DIST_PATH}/config/build.txt

mkdir -p ${DIST_PATH}/logs

mkdir -p ${DIST_PATH}/web/static/js
cp -L web/static/js/*.min.js ${DIST_PATH}/web/static/js/
cp -L web/static/js/*.min.js.map ${DIST_PATH}/web/static/js/
cp -RL web/static/config ${DIST_PATH}/web/static
cp -RL web/static/css ${DIST_PATH}/web/static
cp -RL web/static/fonts ${DIST_PATH}/web/static
cp -RL web/static/help ${DIST_PATH}/web/static
cp -RL web/static/images ${DIST_PATH}/web/static
cp -RL web/static/js/jquery-dragster ${DIST_PATH}/web/static/js/
cp -RL web/templates ${DIST_PATH}/web

mkdir -p ${DIST_PATH}/api
cp -RL api/templates ${DIST_PATH}/api

cp build/MIT-COMPILED-LICENSE.md ${DIST_PATH}
cp NOTICE.txt ${DIST_PATH}
cp README.md ${DIST_PATH}

mv ${DIST_PATH}/web/static/js/bundle.min.js ${DIST_PATH}/web/static/js/bundle-${BUILD_NUMBER}.min.js
mv ${DIST_PATH}/web/static/js/libs.min.js ${DIST_PATH}/web/static/js/libs-${BUILD_NUMBER}.min.js

sed -i'.bak' 's|react-0.14.3.js|react-0.14.3.min.js|g' ${DIST_PATH}/web/templates/head.html
sed -i'.bak' 's|react-dom-0.14.3.js|react-dom-0.14.3.min.js|g' ${DIST_PATH}/web/templates/head.html
sed -i'.bak' 's|jquery-2.1.4.js|jquery-2.1.4.min.js|g' ${DIST_PATH}/web/templates/head.html
sed -i'.bak' 's|bootstrap-3.3.5.js|bootstrap-3.3.5.min.js|g' ${DIST_PATH}/web/templates/head.html
sed -i'.bak' 's|react-bootstrap-0.28.1.js|react-bootstrap-0.28.1.min.js|g' ${DIST_PATH}/web/templates/head.html
sed -i'.bak' 's|perfect-scrollbar-0.6.7.jquery.js|perfect-scrollbar-0.6.7.jquery.min.js|g' ${DIST_PATH}/web/templates/head.html
sed -i'.bak' 's|bundle.js|bundle-${BUILD_NUMBER}.min.js|g' ${DIST_PATH}/web/templates/head.html
sed -i'.bak' 's|libs.min.js|libs-${BUILD_NUMBER}.min.js|g' ${DIST_PATH}/web/templates/head.html
rm ${DIST_PATH}/web/templates/*.bak
