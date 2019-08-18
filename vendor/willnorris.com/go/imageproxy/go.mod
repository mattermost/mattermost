module willnorris.com/go/imageproxy

require (
	cloud.google.com/go v0.37.1
	contrib.go.opencensus.io/exporter/ocagent v0.4.9 // indirect
	github.com/Azure/azure-sdk-for-go v26.5.0+incompatible // indirect
	github.com/Azure/go-autorest v11.5.2+incompatible // indirect
	github.com/PaulARoy/azurestoragecache v0.0.0-20170906084534-3c249a3ba788
	github.com/aws/aws-sdk-go v1.19.0
	github.com/dgrijalva/jwt-go v3.2.0+incompatible // indirect
	github.com/die-net/lrucache v0.0.0-20181227122439-19a39ef22a11
	github.com/disintegration/imaging v1.6.0
	github.com/dnaeon/go-vcr v1.0.1 // indirect
	github.com/garyburd/redigo v1.6.0
	github.com/gomodule/redigo v2.0.0+incompatible // indirect
	github.com/google/btree v1.0.0 // indirect
	github.com/gregjones/httpcache v0.0.0-20190212212710-3befbb6ad0cc
	github.com/grpc-ecosystem/grpc-gateway v1.8.5 // indirect
	github.com/hashicorp/golang-lru v0.5.1 // indirect
	github.com/jamiealquiza/envy v1.1.0
	github.com/marstr/guid v0.0.0-20170427235115-8bdf7d1a087c // indirect
	github.com/muesli/smartcrop v0.2.1-0.20181030220600-548bbf0c0965
	github.com/nfnt/resize v0.0.0-20180221191011-83c6a9932646 // indirect
	github.com/peterbourgon/diskv v0.0.0-20171120014656-2973218375c3
	github.com/rwcarlsen/goexif v0.0.0-20190318171057-76e3344f7516
	github.com/satori/go.uuid v0.0.0-20180103174451-36e9d2ebbde5 // indirect
	github.com/stretchr/testify v1.3.0 // indirect
	go.opencensus.io v0.19.2 // indirect
	golang.org/x/image v0.0.0-20190321063152-3fc05d484e9f
	golang.org/x/net v0.0.0-20190322120337-addf6b3196f6 // indirect
	golang.org/x/oauth2 v0.0.0-20190319182350-c85d3e98c914 // indirect
	golang.org/x/sys v0.0.0-20190322080309-f49334f85ddc // indirect
	google.golang.org/appengine v1.5.0 // indirect
	google.golang.org/genproto v0.0.0-20190321212433-e79c0c59cdb5 // indirect
	willnorris.com/go/gifresize v1.0.0
)

// temporary fix to https://github.com/golang/lint/issues/436 which still seems to be a problem
replace github.com/golang/lint => github.com/golang/lint v0.0.0-20190227174305-8f45f776aaf1

// local copy of envy package without cobra support
replace github.com/jamiealquiza/envy => ./third_party/envy
