#!/bin/sh
VERSION=${VERSION:=6.1.2}
docker run --rm -p 9200:9200  -e "http.host=0.0.0.0" -e "transport.host=127.0.0.1" -e "bootstrap.memory_lock=true" -e "ES_JAVA_OPTS=-Xms1g -Xmx1g" docker.elastic.co/elasticsearch/elasticsearch:$VERSION elasticsearch -Expack.security.enabled=false -Enetwork.host=_local_,_site_ -Enetwork.publish_host=_local_
