.PHONY: all dist dist-local dist-travis start-docker build-server package build-client test travis-init build-container stop-docker clean-docker clean nuke run run-client run-server stop stop-client stop-server setup-mac cleandb docker-build docker-run restart-server

GOPATH ?= $(GOPATH:)
GOFLAGS ?= $(GOFLAGS:)
BUILD_NUMBER ?= $(BUILD_NUMBER:)
BUILD_DATE = $(shell date -u)
BUILD_HASH = $(shell git rev-parse HEAD)

ENTERPRISE_DIR ?= ../enterprise
BUILD_ENTERPRISE ?= true

GO=$(GOPATH)/bin/godep go
ESLINT=node_modules/eslint/bin/eslint.js

ifeq ($(BUILD_NUMBER),)
	BUILD_NUMBER := dev
endif

ifeq ($(TRAVIS_BUILD_NUMBER),)
	BUILD_NUMBER := dev
else
	BUILD_NUMBER := $(TRAVIS_BUILD_NUMBER)
endif

DIST_ROOT=dist
DIST_PATH=$(DIST_ROOT)/mattermost

TESTS=.

DOCKERNAME ?= mm-dev
DOCKER_CONTAINER_NAME ?= mm-test

all: dist-local

dist: | build-server build-client go-test package
	mv ./model/version.go.bak ./model/version.go
	@if [ "$(BUILD_ENTERPRISE)" = "true" ] && [ -d "$(ENTERPRISE_DIR)" ]; then \
		mv ./mattermost.go.bak ./mattermost.go; \
		mv ./config/config.json.bak ./config/config.json 2> /dev/null || true; \
	fi

dist-local: | start-docker dist

dist-travis: | travis-init build-container

start-docker:
	@echo Starting docker containers

	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 0 ]; then \
		echo starting mattermost-mysql; \
		docker run --name mattermost-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=mostest \
		-e MYSQL_USER=mmuser -e MYSQL_PASSWORD=mostest -e MYSQL_DATABASE=mattermost_test -d mysql:5.7 > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-mysql) -eq 0 ]; then \
		echo restarting mattermost-mysql; \
		docker start mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-postgres) -eq 0 ]; then \
		echo starting mattermost-postgres; \
		docker run --name mattermost-postgres -p 5432:5432 -e POSTGRES_USER=mmuser -e POSTGRES_PASSWORD=mostest \
		-d postgres:9.4 > /dev/null; \
		sleep 10; \
	elif [ $(shell docker ps | grep -ci mattermost-postgres) -eq 0 ]; then \
		echo restarting mattermost-postgres; \
		docker start mattermost-postgres > /dev/null; \
		sleep 10; \
	fi

build-server:
	@echo Building mattermost server

	rm -Rf $(DIST_ROOT)
	$(GO) clean $(GOFLAGS) -i ./...

	@echo GOFMT
	$(eval GOFMT_OUTPUT := $(shell gofmt -d -s api/ model/ store/ utils/ manualtesting/ mattermost.go 2>&1))
	@echo "$(GOFMT_OUTPUT)"
	@if [ ! "$(GOFMT_OUTPUT)" ]; then \
		echo "gofmt sucess"; \
	else \
		echo "gofmt failure"; \
		exit 1; \
	fi

	cp ./model/version.go ./model/version.go.bak
	sed -i'.make_mac_work' 's|_BUILD_NUMBER_|$(BUILD_NUMBER)|g' ./model/version.go
	sed -i'.make_mac_work' 's|_BUILD_DATE_|$(BUILD_DATE)|g' ./model/version.go
	sed -i'.make_mac_work' 's|_BUILD_HASH_|$(BUILD_HASH)|g' ./model/version.go

	@if [ "$(BUILD_ENTERPRISE)" = "true" ] && [ -d "$(ENTERPRISE_DIR)" ]; then \
		cp ./config/config.json ./config/config.json.bak; \
		jq -s '.[0] * .[1]' ./config/config.json $(ENTERPRISE_DIR)/config/enterprise-config-additions.json > config.json.tmp; \
		mv config.json.tmp ./config/config.json; \
		sed -e '/\/\/ENTERPRISE_IMPORTS/ {' -e 'r $(ENTERPRISE_DIR)/imports' -e 'd' -e '}' -i'.bak' mattermost.go; \
		sed -i'.make_mac_work' 's|_BUILD_ENTERPRISE_READY_|true|g' ./model/version.go; \
	else \
		sed -i'.make_mac_work' 's|_BUILD_ENTERPRISE_READY_|false|g' ./model/version.go; \
	fi

	rm ./model/version.go.make_mac_work

	$(GO) build $(GOFLAGS) ./...
	$(GO) generate $(GOFLAGS) ./...
	$(GO) install $(GOFLAGS) ./...

package:
	@ echo Packaging mattermost

	mkdir -p $(DIST_PATH)/bin
	cp $(GOPATH)/bin/platform $(DIST_PATH)/bin

	cp -RL config $(DIST_PATH)/config
	cp -RL fonts $(DIST_PATH)/fonts
	touch $(DIST_PATH)/config/build.txt
	echo $(BUILD_NUMBER) | tee -a $(DIST_PATH)/config/build.txt

	mkdir -p $(DIST_PATH)/logs

	mkdir -p $(DIST_PATH)/webapp/dist
	cp -RL webapp/dist $(DIST_PATH)/webapp

	cp -RL templates $(DIST_PATH)

	cp -RL i18n $(DIST_PATH)

	cp build/MIT-COMPILED-LICENSE.md $(DIST_PATH)
	cp NOTICE.txt $(DIST_PATH)
	cp README.md $(DIST_PATH)

	mv $(DIST_PATH)/webapp/dist/bundle.js $(DIST_PATH)/webapp/dist/bundle-$(BUILD_NUMBER).js
	sed -i'.bak' 's|bundle.js|bundle-$(BUILD_NUMBER).js|g' $(DIST_PATH)/webapp/dist/root.html
	rm $(DIST_PATH)/webapp/dist/root.html.bak

	@if [ "$(BUILD_ENTERPRISE)" = "true" ] && [ -d "$(ENTERPRISE_DIR)" ]; then \
		sudo mv -f $(DIST_PATH)/config/config.json.bak $(DIST_PATH)/config/config.json || echo 'nomv'; \
	fi

	tar -C dist -czf $(DIST_PATH).tar.gz mattermost

build-client:
	mkdir -p webapp/dist/files
	cd webapp && make build

go-test:
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=180s ./api || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=12s ./model || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./store || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./utils || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./web || exit 1

test: | start-docker .prepare-go go-test

travis-init:
	@echo Setting up enviroment for travis

	if [ "$(TRAVIS_DB)" = "postgres" ]; then \
		sed -i'.bak' 's|mysql|postgres|g' config/config.json; \
		sed -i'.bak2' 's|mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8|postgres://mmuser:mostest@postgres:5432/mattermost_test?sslmode=disable\&connect_timeout=10|g' config/config.json; \
	fi

	if [ "$(TRAVIS_DB)" = "mysql" ]; then \
		sed -i'.bak' 's|mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8|mmuser:mostest@tcp(mysql:3306)/mattermost_test?charset=utf8mb4,utf8|g' config/config.json; \
	fi

build-container:
	@echo Building in container

	cd .. && docker run -e TRAVIS_BUILD_NUMBER=$(TRAVIS_BUILD_NUMBER) --link mattermost-mysql:mysql --link mattermost-postgres:postgres -v `pwd`:/go/src/github.com/mattermost mattermost/builder:latest

stop-docker:
	@echo Stopping docker containers

	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		echo stopping mattermost-mysql; \
		docker stop mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-postgres) -eq 1 ]; then \
		echo stopping mattermost-postgres; \
		docker stop mattermost-postgres > /dev/null; \
	fi

clean-docker:
	@echo Removing docker containers

	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		echo stopping mattermost-mysql; \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-postgres) -eq 1 ]; then \
		echo stopping mattermost-postgres; \
		docker stop mattermost-postgres > /dev/null; \
		docker rm -v mattermost-postgres > /dev/null; \
	fi

clean: stop-docker
	rm -Rf $(DIST_ROOT)
	go clean $(GOFLAGS) -i ./...

	cd webapp && make clean

	rm -rf api/data
	rm -rf logs

	rm -rf Godeps/_workspace/pkg/

	rm -f mattermost.log
	rm -f .prepare-go .prepare-jsx

nuke: | clean clean-docker
	rm -rf data

.prepare-go:
	@echo Preparation for running go code
	go get $(GOFLAGS) github.com/tools/godep

	touch $@

run: | start-docker run-server run-client

run-server: .prepare-go
	@echo Starting go web server
	mkdir -p webapp/dist/files
	$(GO) run $(GOFLAGS) mattermost.go -config=config.json &

run-client:
	@echo Starting client

	cd webapp && make run

	@if [ "$(BUILD_ENTERPRISE)" = "true" ] && [ -d "$(ENTERPRISE_DIR)" ]; then \
		cp ./config/config.json ./config/config.json.bak; \
		jq -s '.[0] * .[1]' ./config/config.json $(ENTERPRISE_DIR)/config/enterprise-config-additions.json > config.json.tmp; \
		mv config.json.tmp ./config/config.json; \
		sed -e '/\/\/ENTERPRISE_IMPORTS/ {' -e 'r $(ENTERPRISE_DIR)/imports' -e 'd' -e '}' -i'.bak' mattermost.go; \
		sed -i'.bak' 's|_BUILD_ENTERPRISE_READY_|true|g' ./model/version.go; \
	else \
		sed -i'.bak' 's|_BUILD_ENTERPRISE_READY_|false|g' ./model/version.go; \
	fi

stop: stop-server stop-client
	@if [ $(shell docker ps -a | grep -ci ${DOCKER_CONTAINER_NAME}) -eq 1 ]; then \
		echo removing dev docker container; \
		docker stop ${DOCKER_CONTAINER_NAME} > /dev/null; \
		docker rm -v ${DOCKER_CONTAINER_NAME} > /dev/null; \
	fi

	@if [ "$(BUILD_ENTERPRISE)" = "true" ] && [ -d "$(ENTERPRISE_DIR)" ]; then \
		mv ./config/config.json.bak ./config/config.json 2> /dev/null || true; \
		mv ./mattermost.go.bak ./mattermost.go 2> /dev/null || true; \
		mv ./model/version.go.bak ./model/version.go 2> /dev/null || true; \
	fi

stop-server:
	@for PID in $$(ps -ef | grep "go run [m]attermost.go" | awk '{ print $$2 }'); do \
		echo stopping go $$PID; \
		kill $$PID; \
	done

	@for PID in $$(ps -ef | grep "go-build.*/[m]attermost" | awk '{ print $$2 }'); do \
		echo stopping mattermost $$PID; \
		kill $$PID; \
	done

stop-client:
	cd webapp && make stop

restart-server: stop-server run-server

setup-mac:
	echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts

cleandb:
	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

docker-build: stop
	docker build -t ${DOCKERNAME} -f docker/local/Dockerfile .

docker-run: docker-build
	docker run --name ${DOCKER_CONTAINER_NAME} -d --publish 8065:80 ${DOCKERNAME}

