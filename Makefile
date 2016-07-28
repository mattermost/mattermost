.PHONY: build package run stop run-client run-server stop-client stop-server restart restart-server restart-client start-docker clean-dist clean nuke check-style check-client-style check-server-style check-unit-tests test dist setup-mac prepare-enteprise run-client-tests setup-run-client-tests cleanup-run-client-tests test-client build-linux build-osx build-windows internal-test-client

# For golang 1.5.x compatibility (remove when we don't want to support it anymore)
export GO15VENDOREXPERIMENT=1

# Build Flags
BUILD_NUMBER ?= $(BUILD_NUMBER:)
BUILD_DATE = $(shell date -u)
BUILD_HASH = $(shell git rev-parse HEAD)
# If we don't set the build number it defaults to dev
ifeq ($(BUILD_NUMBER),)
	BUILD_NUMBER := dev
endif
BUILD_ENTERPRISE_DIR ?= ../enterprise
BUILD_ENTERPRISE ?= true
BUILD_ENTERPRISE_READY = false
BUILD_TYPE_NAME = team
BUILD_HASH_ENTERPRISE = none
ifneq ($(wildcard $(BUILD_ENTERPRISE_DIR)/.),)
	ifeq ($(BUILD_ENTERPRISE),true)
		BUILD_ENTERPRISE_READY = true
		BUILD_TYPE_NAME = enterprise
		BUILD_HASH_ENTERPRISE = $(shell cd $(BUILD_ENTERPRISE_DIR) && git rev-parse HEAD)
	else
		BUILD_ENTERPRISE_READY = false
		BUILD_TYPE_NAME = team
	endif
else
	BUILD_ENTERPRISE_READY = false
	BUILD_TYPE_NAME = team
endif
BUILD_WEBAPP_DIR = ./webapp

# Golang Flags
GOPATH ?= $(GOPATH:):./vendor
GOFLAGS ?= $(GOFLAGS:)
GO=go
GO_LINKER_FLAGS ?= -ldflags \
				   "-X github.com/mattermost/platform/model.BuildNumber=$(BUILD_NUMBER)\
				    -X 'github.com/mattermost/platform/model.BuildDate=$(BUILD_DATE)'\
				    -X github.com/mattermost/platform/model.BuildHash=$(BUILD_HASH)\
				    -X github.com/mattermost/platform/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
				    -X github.com/mattermost/platform/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)"

# Output paths
DIST_ROOT=dist
DIST_PATH=$(DIST_ROOT)/mattermost

# Tests
TESTS=.

all: dist

dist: | check-style test package

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
	elif [ $(shell docker ps | grep -ci mattermost-postgres) -eq 0 ]; then \
		echo restarting mattermost-postgres; \
		docker start mattermost-postgres > /dev/null; \
	fi

	@echo Ldap test user test.one
	@if [ $(shell docker ps -a | grep -ci mattermost-openldap) -eq 0 ]; then \
		echo starting mattermost-openldap; \
		docker run --name mattermost-openldap -p 389:389 -p 636:636 \
			-e LDAP_TLS_VERIFY_CLIENT="never" \
			-e LDAP_ORGANISATION="Mattermost Test" \
			-e LDAP_DOMAIN="mm.test.com" \
			-e LDAP_ADMIN_PASSWORD="mostest" \
			-d osixia/openldap:1.1.2 > /dev/null;\
		sleep 10; \
		docker exec -ti mattermost-openldap bash -c 'echo -e "dn: ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: organizationalunit" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest';\
		docker exec -ti mattermost-openldap bash -c 'echo -e "dn: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: iNetOrgPerson\nsn: User\ncn: Test1\nmail: success+testone@simulator.amazonses.com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest';\
		docker exec -ti mattermost-openldap bash -c 'ldappasswd -s Password1 -D "cn=admin,dc=mm,dc=test,dc=com" -x "uid=test.one,ou=testusers,dc=mm,dc=test,dc=com" -w mostest';\
		docker exec -ti mattermost-openldap bash -c 'echo -e "dn: uid=test.two,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: iNetOrgPerson\nsn: User\ncn: Test2\nmail: success+testtwo@simulator.amazonses.com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest';\
		docker exec -ti mattermost-openldap bash -c 'ldappasswd -s Password1 -D "cn=admin,dc=mm,dc=test,dc=com" -x "uid=test.two,ou=testusers,dc=mm,dc=test,dc=com" -w mostest';\
		docker exec -ti mattermost-openldap bash -c 'echo -e "dn: cn=tgroup,ou=testusers,dc=mm,dc=test,dc=com\nobjectclass: groupOfUniqueNames\nuniqueMember: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com" | ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest';\
	elif [ $(shell docker ps | grep -ci mattermost-openldap) -eq 0 ]; then \
		echo restarting mattermost-openldap; \
		docker start mattermost-openldap > /dev/null; \
		sleep 10; \
	fi

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
	
	@if [ $(shell docker ps -a | grep -ci mattermost-openldap) -eq 1 ]; then \
		echo stopping mattermost-openldap; \
		docker stop mattermost-openldap > /dev/null; \
	fi

clean-docker:
	@echo Removing docker containers

	@if [ $(shell docker ps -a | grep -ci mattermost-mysql) -eq 1 ]; then \
		echo removing mattermost-mysql; \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-postgres) -eq 1 ]; then \
		echo removing mattermost-postgres; \
		docker stop mattermost-postgres > /dev/null; \
		docker rm -v mattermost-postgres > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-openldap) -eq 1 ]; then \
		echo removing mattermost-openldap; \
		docker stop mattermost-openldap > /dev/null; \
		docker rm -v mattermost-openldap > /dev/null; \
	fi

check-client-style:
	@echo Checking client style

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) check-style
	
check-server-style:
	@echo Running GOFMT
	$(eval GOFMT_OUTPUT := $(shell gofmt -d -s api/ model/ store/ utils/ manualtesting/ einterfaces/ mattermost.go 2>&1))
	@echo "$(GOFMT_OUTPUT)"
	@if [ ! "$(GOFMT_OUTPUT)" ]; then \
		echo "gofmt sucess"; \
	else \
		echo "gofmt failure"; \
		exit 1; \
	fi

check-style: check-client-style check-server-style

test-server: start-docker prepare-enterprise
	@echo Running server tests

	rm -f cover.out
	echo "mode: count" > cover.out

	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=440s -covermode=count -coverprofile=capi.out ./api || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=60s -covermode=count -coverprofile=cmodel.out ./model || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=180s -covermode=count -coverprofile=cstore.out ./store || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s -covermode=count -coverprofile=cutils.out ./utils || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=120s -covermode=count -coverprofile=cweb.out ./web || exit 1

	tail -n +2 capi.out >> cover.out
	tail -n +2 cmodel.out >> cover.out
	tail -n +2 cstore.out >> cover.out
	tail -n +2 cutils.out >> cover.out
	tail -n +2 cweb.out >> cover.out
	rm -f capi.out cmodel.out cstore.out cutils.out cweb.out

ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Running Enterprise tests

	rm -f ecover.out
	echo "mode: count" > ecover.out

	$(GO) test $(GOFLAGS) -run=$(TESTS) -covermode=count -c ./enterprise/ldap && ./ldap.test -test.v -test.timeout=120s -test.coverprofile=cldap.out || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -covermode=count -c ./enterprise/compliance && ./compliance.test -test.v -test.timeout=120s -test.coverprofile=ccompliance.out || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -covermode=count -c ./enterprise/emoji && ./emoji.test -test.v -test.timeout=120s -test.coverprofile=cemoji.out || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -covermode=count -c ./enterprise/saml && ./saml.test -test.v -test.timeout=60s -test.coverprofile=csaml.out || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -covermode=count -c ./enterprise/cluster && ./cluster.test -test.v -test.timeout=60s -test.coverprofile=ccluster.out || exit 1
	$(GO) test $(GOFLAGS) -run=$(TESTS) -covermode=count -c ./enterprise/account_migration && ./account_migration.test -test.v -test.timeout=60s -test.coverprofile=caccount_migration.out || exit 1

	tail -n +2 cldap.out >> ecover.out
	tail -n +2 ccompliance.out >> ecover.out
	tail -n +2 cemoji.out >> ecover.out
	tail -n +2 csaml.out >> ecover.out
	tail -n +2 ccluster.out >> ecover.out
	tail -n +2 caccount_migration.out >> ecover.out
	rm -f cldap.out ccompliance.out cemoji.out csaml.out ccluster.out caccount_migration.out

	rm -r ldap.test
	rm -r compliance.test
	rm -r emoji.test
	rm -r saml.test
	rm -r cluster.test
	rm -r account_migration.test
	rm -f config/*.crt
	rm -f config/*.key
endif

internal-test-web-client: start-docker prepare-enterprise
	$(GO) run $(GOFLAGS) *.go -run_web_client_tests

internal-test-javascript-client: start-docker prepare-enterprise
	$(GO) run $(GOFLAGS) *.go -run_javascript_client_tests

test-client: start-docker prepare-enterprise
	@echo Running client tests

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) test

test: test-server test-client

cover:
	@echo Opening coverage info in browser. If this failed run make test first

	$(GO) tool cover -html=cover.out
	$(GO) tool cover -html=ecover.out

.prebuild:
	@echo Preparation for running go code
	go get $(GOFLAGS) github.com/Masterminds/glide

	touch $@

prepare-enterprise:
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Enterprise build selected, preparing
	cp $(BUILD_ENTERPRISE_DIR)/imports.go .
	rm -f enterprise
	ln -s $(BUILD_ENTERPRISE_DIR) enterprise
endif

build-linux: .prebuild prepare-enterprise
	@echo Build Linux amd64
	env GOOS=linux GOARCH=amd64 $(GO) install $(GOFLAGS) $(GO_LINKER_FLAGS) $(go list ./... | grep -v /vendor/)

build-osx: .prebuild prepare-enterprise
	@echo Build OSX amd64
	env GOOS=darwin GOARCH=amd64 $(GO) install $(GOFLAGS) $(GO_LINKER_FLAGS) $(go list ./... | grep -v /vendor/) 

build-windows: .prebuild prepare-enterprise
	@echo Build Windows amd64
	env GOOS=windows GOARCH=amd64 $(GO) install $(GOFLAGS) $(GO_LINKER_FLAGS) $(go list ./... | grep -v /vendor/) 

build: build-linux build-windows build-osx

build-client:
	@echo Building mattermost web app

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) build


package: build build-client
	@ echo Packaging mattermost

	@# Remove any old files
	rm -Rf $(DIST_ROOT)

	@# Create needed directories
	mkdir -p $(DIST_PATH)/bin
	mkdir -p $(DIST_PATH)/logs

	@# Resource directories
	cp -RL config $(DIST_PATH)
	cp -RL fonts $(DIST_PATH)
	cp -RL templates $(DIST_PATH)
	cp -RL i18n $(DIST_PATH)

	@# Package webapp
	mkdir -p $(DIST_PATH)/webapp/dist
	cp -RL $(BUILD_WEBAPP_DIR)/dist $(DIST_PATH)/webapp

	@# Help files
ifeq ($(BUILD_ENTERPRISE_READY),true)
	cp $(BUILD_ENTERPRISE_DIR)/ENTERPRISE-EDITION-LICENSE.txt $(DIST_PATH)
else
	cp build/MIT-COMPILED-LICENSE.md $(DIST_PATH)
endif
	cp NOTICE.txt $(DIST_PATH)
	cp README.md $(DIST_PATH)

	@# ----- PLATFORM SPECIFIC -----

	@# Make osx package
	@# Copy binary
	cp $(GOPATH)/bin/darwin_amd64/platform $(DIST_PATH)/bin
	@# Package
	tar -C dist -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-osx-amd64.tar.gz mattermost
	@# Cleanup
	rm -f $(DIST_PATH)/bin/platform

	@# Make windows package
	@# Copy binary
	cp $(GOPATH)/bin/windows_amd64/platform.exe $(DIST_PATH)/bin
	@# Package
	tar -C dist -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-windows-amd64.tar.gz mattermost
	@# Cleanup
	rm -f $(DIST_PATH)/bin/platform.exe

	@# Make linux package
	@# Copy binary
	cp $(GOPATH)/bin/platform $(DIST_PATH)/bin
	@# Package
	tar -C dist -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-linux-amd64.tar.gz mattermost
	@# Don't cleanup linux package so dev machines will have an unziped linux package avalilable
	@#rm -f $(DIST_PATH)/bin/platform


run-server: prepare-enterprise start-docker
	@echo Running mattermost for development

	mkdir -p $(BUILD_WEBAPP_DIR)/dist/files
	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) *.go &

run-cli: prepare-enterprise start-docker
	@echo Running mattermost for development
	@echo Example should be like >'make ARGS="-version" run-cli'

	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) *.go ${ARGS}

run-client:
	@echo Running mattermost client for development

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

run-client-fullmap:
	@echo Running mattermost client for development with FULL SOURCE MAP

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run-fullmap

run: run-server run-client

run-fullmap: run-server run-client-fullmap

stop-server:
	@echo Stopping mattermost

	@for PID in $$(ps -ef | grep "[g]o run" | awk '{ print $$2 }'); do \
		echo stopping go $$PID; \
		kill $$PID; \
	done

	@for PID in $$(ps -ef | grep "[g]o-build" | awk '{ print $$2 }'); do \
		echo stopping mattermost $$PID; \
		kill $$PID; \
	done

stop-client:
	@echo Stopping mattermost client

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) stop


stop: stop-server stop-client

restart: restart-server restart-client

restart-server: | stop-server run-server

restart-client: | stop-client run-client

clean: stop-docker
	@echo Cleaning

	rm -Rf $(DIST_ROOT)
	go clean $(GOFLAGS) -i ./...

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) clean

	rm -rf api/data
	rm -rf logs

	rm -f mattermost.log
	rm -f npm-debug.log
	rm -f api/mattermost.log
	rm -f .prepare-go
	rm -f enterprise
	rm -f cover.out
	rm -f ecover.out
	rm -f *.out
	rm -f *.test

nuke: clean clean-docker
	@echo BOOM

	rm -rf data

setup-mac:
	echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts
