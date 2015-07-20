.PHONY: all test clean build install run stop cover dist cleandb travis

GOPATH ?= $(GOPATH:)
GOFLAGS ?= $(GOFLAGS:)
BUILD_NUMBER ?= $(BUILD_NUMBER:)

ifeq ($(shell which godep), "")
	GODEP=$(GOPATH)/bin/godep
else
	GODEP=godep
endif
GO=$(GODEP) go

ifeq ($(BUILD_NUMBER),)
	BUILD_NUMBER := dev
endif

DIST_ROOT=dist
DIST_PATH=$(DIST_ROOT)/mattermost
DIST_RESULTS=$(DIST_ROOT)/results

BENCH=.
TESTS=.

all: travis

travis:
	@echo building for travis

	rm -Rf $(DIST_ROOT)
	@$(GO) clean $(GOFLAGS) -i ./...

	@cd web/react/ && npm install

	@$(GO) build $(GOFLAGS) ./...

	@mkdir -p logs

	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=180s ./api || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=12s ./model || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./store || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./utils || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./web || exit 1

build:
	@$(GO) build $(GOFLAGS) ./...

install:
	@go get $(GOFLAGS) github.com/tools/godep

	@if [ $(shell docker ps | grep -ci mattermost-mysql) -eq 0 ]; then \
		echo starting mattermost-mysql; \
		docker run --name mattermost-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=mostest \
    	-e MYSQL_USER=mmuser -e MYSQL_PASSWORD=mostest -e MYSQL_DATABASE=mattermost_test -d mysql > /dev/null; \
	fi

	@if [ $(shell docker ps | grep -ci mattermost-redis) -eq 0 ]; then \
		echo starting mattermost-redis; \
		docker run --name mattermost-redis -p 6379:6379 -d redis > /dev/null; \
	fi

	@cd web/react/ && npm install

test: install
	@mkdir -p logs
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=180s ./api || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=12s ./model || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./store || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./utils || exit 1
	@$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s ./web || exit 1

benchmark: install
	@mkdir -p logs
	@$(GO) test $(GOFLAGS) -test.v -run=NO_TESTS -bench=$(BENCH) ./api || exit 1

cover: install
	rm -Rf $(DIST_RESULTS)
	mkdir -p $(DIST_RESULTS)

	@go test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/api.cover.out github.com/mattermost/platform/api
	@go test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/model.cover.out github.com/mattermost/platform/model
	@go test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/store.cover.out github.com/mattermost/platform/store
	@go test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/utils.cover.out github.com/mattermost/platform/utils
	@go test $(GOFLAGS) -coverprofile=$(DIST_RESULTS)/web.cover.out github.com/mattermost/platform/web

	cd $(DIST_RESULTS) && \
	echo "mode: set" > coverage.out && cat *.cover.out | grep -v mode: | sort -r | \
	awk '{if($$1 != last) {print $$0;last=$$1}}' >> coverage.out

	cd $(DIST_RESULTS) && go tool cover -html=coverage.out -o=coverage.html

	rm -f $(DIST_RESULTS)/*.cover.out
	
clean:
	rm -Rf $(DIST_ROOT)
	@$(GO) clean $(GOFLAGS) -i ./...

	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		echo stopping mattermost-mysql; \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-redis) -eq 1 ]; then \
		echo stopping mattermost-redis; \
		docker stop mattermost-redis > /dev/null; \
		docker rm -v mattermost-redis > /dev/null; \
	fi

	rm -rf web/react/node_modules
	rm -f web/static/js/bundle*.js
	rm -f web/static/css/styles.css

	rm -rf logs/*


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

setup-mac:
	echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts

cleandb:
	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-redis) -eq 1 ]; then \
		docker stop mattermost-redis > /dev/null; \
		docker rm -v mattermost-redis > /dev/null; \
	fi

dist: install

	@$(GO) build $(GOFLAGS) -i -a ./...
	@$(GO) install $(GOFLAGS) -a ./...

	mkdir -p $(DIST_PATH)/bin
	cp $(GOPATH)/bin/platform $(DIST_PATH)/bin

	cp -RL config $(DIST_PATH)/config
	touch $(DIST_PATH)/config/build.txt
	echo $(BUILD_NUMBER) | tee -a $(DIST_PATH)/config/build.txt

	mkdir -p $(DIST_PATH)/logs

	mkdir -p web/static/js
	cd web/react && npm run build

	cd web/sass-files && compass compile

	mkdir -p $(DIST_PATH)/web
	cp -RL web/static $(DIST_PATH)/web
	cp -RL web/templates $(DIST_PATH)/web

	mkdir -p $(DIST_PATH)/api
	cp -RL api/templates $(DIST_PATH)/api

	mv $(DIST_PATH)/web/static/js/bundle.min.js $(DIST_PATH)/web/static/js/bundle-$(BUILD_NUMBER).min.js

	@sed -i'.bak' 's|react-with-addons-0.13.1.js|react-with-addons-0.13.1.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|jquery-1.11.1.js|jquery-1.11.1.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|bootstrap-3.3.1.js|bootstrap-3.3.1.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|perfect-scrollbar.js|perfect-scrollbar.min.js|g' $(DIST_PATH)/web/templates/head.html
	@sed -i'.bak' 's|bundle.js|bundle-$(BUILD_NUMBER).min.js|g' $(DIST_PATH)/web/templates/head.html
	rm $(DIST_PATH)/web/templates/*.bak

	tar -C dist -czf $(DIST_PATH).tar.gz mattermost
