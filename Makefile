.PHONY: all test clean build install run stop cover dist cleandb travis docker

GOPATH ?= $(GOPATH:)
GOFLAGS ?= $(GOFLAGS:)
BUILD_NUMBER ?= $(BUILD_NUMBER:)
BUILD_DATE = $(shell date -u)
BUILD_HASH = $(shell git rev-parse HEAD)

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
DIST_RESULTS=$(DIST_ROOT)/results

BENCH=.
TESTS=.

DOCKERNAME ?= mm-dev
DOCKER_CONTAINER_NAME ?= mm-test

all: travis

travis:
	@echo building for travis

	if [ "$(TRAVIS_DB)" = "postgres" ]; then \
		sed -i'.bak' 's|mysql|postgres|g' config/config.json; \
		sed -i'.bak' 's|mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8|postgres://mmuser:mostest@dockerhost:5432/mattermost_test?sslmode=disable\&connect_timeout=10|g' config/config.json; \
	fi

	rm -Rf $(DIST_ROOT)
	@$(GO) clean $(GOFLAGS) -i ./...

	@cd web/react/ && npm install
	cd web/react/ && npm run build-libs

	@echo Checking for style guide compliance
	cd web/react && $(ESLINT) --quiet components/* dispatcher/* pages/* stores/* utils/*
	@echo Running gofmt
	$(eval GOFMT_OUTPUT := $(shell gofmt -d -s api/ model/ store/ utils/ manualtesting/ mattermost.go 2>&1))
	@echo "$(GOFMT_OUTPUT)"
	@if [ ! "$(GOFMT_OUTPUT)" ]; then \
		echo "gofmt sucess"; \
	else \
		echo "gofmt failure"; \
		exit 1; \
	fi

	@sed -i'.bak' 's|_BUILD_NUMBER_|$(BUILD_NUMBER)|g' ./model/version.go
	@sed -i'.bak' 's|_BUILD_DATE_|$(BUILD_DATE)|g' ./model/version.go
	@sed -i'.bak' 's|_BUILD_HASH_|$(BUILD_HASH)|g' ./model/version.go

	@$(GO) build $(GOFLAGS) ./...
	@$(GO) install $(GOFLAGS) ./...

	@mkdir -p logs

	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=180s ./api || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=12s ./model || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./store || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./utils || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./web || exit 1

	mkdir -p $(DIST_PATH)/bin
	cp $(GOPATH)/bin/platform $(DIST_PATH)/bin

	cp -RL config $(DIST_PATH)/config
	touch $(DIST_PATH)/config/build.txt
	echo $(BUILD_NUMBER) | tee -a $(DIST_PATH)/config/build.txt

	mkdir -p $(DIST_PATH)/logs

	mkdir -p web/static/js
	cd web/react && npm run build

	cd web/sass-files && compass compile -e production --force

	mkdir -p $(DIST_PATH)/web/static/js
	cp -L web/static/js/*.min.js $(DIST_PATH)/web/static/js/
	cp -RL web/static/js/jquery-dragster $(DIST_PATH)/web/static/js/
	cp -RL web/templates $(DIST_PATH)/web

	mkdir -p $(DIST_PATH)/api
	cp -RL api/templates $(DIST_PATH)/api

	cp build/MIT-COMPILED-LICENSE.md $(DIST_PATH)
	cp NOTICE.txt $(DIST_PATH)
	cp README.md $(DIST_PATH)

	mv $(DIST_PATH)/web/static/js/bundle.min.js $(DIST_PATH)/web/static/js/bundle-$(BUILD_NUMBER).min.js
	mv $(DIST_PATH)/web/static/js/libs.min.js $(DIST_PATH)/web/static/js/libs-$(BUILD_NUMBER).min.js

	@sed -i'.bak' 's|react-with-addons-0.13.3.js|react-with-addons-0.13.3.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|jquery-1.11.1.js|jquery-1.11.1.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|bootstrap-3.3.5.js|bootstrap-3.3.5.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|react-bootstrap-0.25.1.js|react-bootstrap-0.25.1.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|perfect-scrollbar.js|perfect-scrollbar.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|bundle.js|bundle-$(BUILD_NUMBER).min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|libs.min.js|libs-$(BUILD_NUMBER).min.js|g' $(DIST_PATH)/web/templates/head.html
	rm $(DIST_PATH)/web/templates/*.bak

	mv doc/README.md doc/index.md
	mkdocs build
	cp -r documentation-html $(DIST_PATH)/documentation-html

	tar -C dist -czf $(DIST_PATH).tar.gz mattermost
	rm -r $(DIST_PATH)

build:
	@$(GO) build $(GOFLAGS) ./...

install:
	@go get $(GOFLAGS) github.com/tools/godep

	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 0 ]; then \
		echo starting mattermost-mysql; \
		docker run --name mattermost-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=mostest \
    	-e MYSQL_USER=mmuser -e MYSQL_PASSWORD=mostest -e MYSQL_DATABASE=mattermost_test -d mysql > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-mysql) -eq 0 ]; then \
		echo restarting mattermost-mysql; \
		docker start mattermost-mysql > /dev/null; \
	fi

	@cd web/react/ && npm install
	@cd web/react/ && npm run build-libs

check: install
	@echo Running ESLint...
	-cd web/react && $(ESLINT) components/* dispatcher/* pages/* stores/* utils/*
	@echo Running gofmt
	$(eval GOFMT_OUTPUT := $(shell gofmt -d -s api/ model/ store/ utils/ manualtesting/ mattermost.go 2>&1))
	@echo "$(GOFMT_OUTPUT)"
	@if [[ ! "$(GOFMT_OUTPUT)" ]]; then \
		echo "gofmt sucess"; \
	else \
		echo "gofmt failure"; \
		exit 1; \
	fi

test: install
	@mkdir -p logs
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=600s ./api || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=60s ./model || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=600s ./store || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=600s ./utils || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=600s ./web || exit 1

benchmark: install
	@mkdir -p logs
	@$(GO) test $(GOFLAGS) -test.v -run=NO_TESTS -bench=$(BENCH) ./api || exit 1

cover: install
	rm -Rf $(DIST_RESULTS)
	mkdir -p $(DIST_RESULTS)

	@$(GO) test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/api.cover.out github.com/mattermost/platform/api
	@$(GO) test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/model.cover.out github.com/mattermost/platform/model
	@$(GO) test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/store.cover.out github.com/mattermost/platform/store
	@$(GO) test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/utils.cover.out github.com/mattermost/platform/utils
	@$(GO) test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/web.cover.out github.com/mattermost/platform/web

	cd $(DIST_RESULTS) && \
	echo "mode: set" > coverage.out && cat *.cover.out | grep -v mode: | sort -r | \
	awk '{if($$1 != last) {print $$0;last=$$1}}' >> coverage.out

	cd $(DIST_RESULTS) && $(GO) tool cover -html=coverage.out -o=coverage.html

	rm -f $(DIST_RESULTS)/*.cover.out
	
clean:
	rm -Rf $(DIST_ROOT)
	@$(GO) clean $(GOFLAGS) -i ./...

	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		echo stopping mattermost-mysql; \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

	rm -rf web/react/node_modules
	rm -f web/static/js/bundle*.js
	rm -f web/static/js/libs*.js
	rm -f web/static/css/styles.css

	rm -rf data/*
	rm -rf api/data/*
	rm -rf logs/*

	rm -rf Godeps/_workspace/pkg/


run: install
	mkdir -p web/static/js

	@echo starting react processor	
	@cd web/react && npm start &

	@echo starting go web server
	@$(GO) run $(GOFLAGS) mattermost.go -config=config.json &

	@echo starting compass watch
	@cd web/sass-files && compass watch &

stop:
	@for PID in $$(ps -ef | grep [c]ompass | awk '{ print $$2 }'); do \
		echo stopping css watch $$PID; \
		kill $$PID; \
	done

	@for PID in $$(ps -ef | grep [n]pm | awk '{ print $$2 }'); do \
		echo stopping watchify $$PID; \
		kill $$PID; \
	done

	@for PID in $$(ps -ef | grep [m]atterm | awk '{ print $$2 }'); do \
		echo stopping go web $$PID; \
		kill $$PID; \
	done

	@if [ $(shell docker ps -a | grep -ci ${DOCKER_CONTAINER_NAME}) -eq 1 ]; then \
		echo removing dev docker container; \
		docker stop ${DOCKER_CONTAINER_NAME} > /dev/null; \
		docker rm -v ${DOCKER_CONTAINER_NAME} > /dev/null; \
	fi

setup-mac:
	echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts

cleandb:
	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi
dist: install

	@sed -i'.bak' 's|_BUILD_NUMBER_|$(BUILD_NUMBER)|g' ./model/version.go
	@sed -i'.bak' 's|_BUILD_DATE_|$(BUILD_DATE)|g' ./model/version.go
	@sed -i'.bak' 's|_BUILD_HASH_|$(BUILD_HASH)|g' ./model/version.go

	@$(GO) build $(GOFLAGS) -i ./...
	@$(GO) install $(GOFLAGS) ./...

	mkdir -p $(DIST_PATH)/bin
	cp $(GOPATH)/bin/platform $(DIST_PATH)/bin

	cp -RL config $(DIST_PATH)/config
	touch $(DIST_PATH)/config/build.txt
	echo $(BUILD_NUMBER) | tee -a $(DIST_PATH)/config/build.txt

	mkdir -p $(DIST_PATH)/logs

	mkdir -p web/static/js
	cd web/react && npm run build

	cd web/sass-files && compass compile -e production --force

	mkdir -p $(DIST_PATH)/web
	cp -RL web/static $(DIST_PATH)/web
	cp -RL web/templates $(DIST_PATH)/web

	mkdir -p $(DIST_PATH)/api
	cp -RL api/templates $(DIST_PATH)/api

	cp build/MIT-COMPILED-LICENSE.md $(DIST_PATH)
	cp NOTICE.txt $(DIST_PATH)
	cp README.md $(DIST_PATH)

	mv $(DIST_PATH)/web/static/js/bundle.min.js $(DIST_PATH)/web/static/js/bundle-$(BUILD_NUMBER).min.js
	mv $(DIST_PATH)/web/static/js/libs.min.js $(DIST_PATH)/web/static/js/libs-$(BUILD_NUMBER).min.js

	@sed -i'.bak' 's|react-with-addons-0.13.3.js|react-with-addons-0.13.3.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|jquery-1.11.1.js|jquery-1.11.1.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|bootstrap-3.3.5.js|bootstrap-3.3.5.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|react-bootstrap-0.25.1.js|react-bootstrap-0.25.1.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|perfect-scrollbar.js|perfect-scrollbar.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|bundle.js|bundle-$(BUILD_NUMBER).min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|libs.min.js|libs-$(BUILD_NUMBER).min.js|g' $(DIST_PATH)/web/templates/head.html
	rm $(DIST_PATH)/web/templates/*.bak

	tar -C dist -czf $(DIST_PATH).tar.gz mattermost

docker-build: stop
	docker build -t ${DOCKERNAME} -f docker/local/Dockerfile .

docker-run: docker-build
	docker run --name ${DOCKER_CONTAINER_NAME} -d --publish 8065:80 ${DOCKERNAME}

