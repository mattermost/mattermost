.PHONY: build package run stop run-client run-server stop-client stop-server restart restart-server restart-client start-docker clean-dist clean nuke check-style check-client-style check-server-style check-unit-tests test dist setup-mac prepare-enteprise run-client-tests setup-run-client-tests cleanup-run-client-tests test-client build-linux build-osx build-windows internal-test-web-client vet run-server-for-web-client-tests

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

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
BUILD_WEBAPP_DIR ?= ../mattermost-webapp
BUILD_CLIENT = false
BUILD_HASH_CLIENT = independant
ifneq ($(wildcard $(BUILD_WEBAPP_DIR)/.),)
	ifeq ($(BUILD_CLIENT),true)
		BUILD_CLIENT = true
		BUILD_HASH_CLIENT = $(shell cd $(BUILD_WEBAPP_DIR) && git rev-parse HEAD)
	else
		BUILD_CLIENT = false
	endif
else
	BUILD_CLIENT = false
endif

# Golang Flags
GOPATH ?= $(shell go env GOPATH)
GOFLAGS ?= $(GOFLAGS:)
GO=go
DELVE=dlv
GO_LINKER_FLAGS ?= -ldflags \
				   "-X github.com/mattermost/mattermost-server/model.BuildNumber=$(BUILD_NUMBER)\
				    -X 'github.com/mattermost/mattermost-server/model.BuildDate=$(BUILD_DATE)'\
				    -X github.com/mattermost/mattermost-server/model.BuildHash=$(BUILD_HASH)\
				    -X github.com/mattermost/mattermost-server/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
				    -X github.com/mattermost/mattermost-server/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)"

# GOOS/GOARCH of the build host, used to determine whether we're cross-compiling or not
BUILDER_GOOS_GOARCH="$(shell $(GO) env GOOS)_$(shell $(GO) env GOARCH)"

PLATFORM_FILES="./cmd/mattermost/main.go"

# Output paths
DIST_ROOT=dist
DIST_PATH=$(DIST_ROOT)/mattermost

# Tests
TESTS=.

TESTFLAGS ?= -short
TESTFLAGSEE ?= -short

# Packages lists
TE_PACKAGES=$(shell go list ./...)
TE_PACKAGES_COMMA=$(shell echo $(TE_PACKAGES) | tr ' ' ',')

# Plugins Packages
PLUGIN_PACKAGES=mattermost-plugin-zoom mattermost-plugin-jira

# Prepares the enterprise build if exists. The IGNORE stuff is a hack to get the Makefile to execute the commands outside a target
ifeq ($(BUILD_ENTERPRISE_READY),true)
	IGNORE:=$(shell echo Enterprise build selected, preparing)
	IGNORE:=$(shell rm -f imports/imports.go)
	IGNORE:=$(shell cp $(BUILD_ENTERPRISE_DIR)/imports/imports.go imports/)
	IGNORE:=$(shell rm -f enterprise)
	IGNORE:=$(shell ln -s $(BUILD_ENTERPRISE_DIR) enterprise)
endif

EE_PACKAGES=$(shell go list ./enterprise/...)
EE_PACKAGES_COMMA=$(shell echo $(EE_PACKAGES) | tr ' ' ',')

ifeq ($(BUILD_ENTERPRISE_READY),true)
ALL_PACKAGES_COMMA=$(TE_PACKAGES_COMMA),$(EE_PACKAGES_COMMA)
else
ALL_PACKAGES_COMMA=$(TE_PACKAGES_COMMA)
endif


all: run ## Alias for 'run'.

include build/*.mk

start-docker: ## Starts the docker containers for local development.
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
		docker run --name mattermost-postgres -p 5432:5432 -e POSTGRES_USER=mmuser -e POSTGRES_PASSWORD=mostest -e POSTGRES_DB=mattermost_test \
		-d postgres:9.4 > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-postgres) -eq 0 ]; then \
		echo restarting mattermost-postgres; \
		docker start mattermost-postgres > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 0 ]; then \
		echo starting mattermost-inbucket; \
		docker run --name mattermost-inbucket -p 9000:10080 -p 2500:10025 -d jhillyerd/inbucket:release-1.2.0 > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-inbucket) -eq 0 ]; then \
		echo restarting mattermost-inbucket; \
		docker start mattermost-inbucket > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-minio) -eq 0 ]; then \
		echo starting mattermost-minio; \
		docker run --name mattermost-minio -p 9001:9000 -e "MINIO_ACCESS_KEY=minioaccesskey" \
		-e "MINIO_SECRET_KEY=miniosecretkey" -d minio/minio:RELEASE.2018-05-25T19-49-13Z server /data > /dev/null; \
		docker exec -it mattermost-minio /bin/sh -c "mkdir -p /data/mattermost-test" > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-minio) -eq 0 ]; then \
		echo restarting mattermost-minio; \
		docker start mattermost-minio > /dev/null; \
	fi

ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Ldap test user test.one
	@if [ $(shell docker ps -a | grep -ci mattermost-openldap) -eq 0 ]; then \
		echo starting mattermost-openldap; \
		docker run --name mattermost-openldap -p 389:389 -p 636:636 \
			-e LDAP_TLS_VERIFY_CLIENT="never" \
			-e LDAP_ORGANISATION="Mattermost Test" \
			-e LDAP_DOMAIN="mm.test.com" \
			-e LDAP_ADMIN_PASSWORD="mostest" \
			-d osixia/openldap:1.1.6 > /dev/null;\
		sleep 10; \
		docker cp tests/add-users-and-groups.ldif mattermost-openldap:/add-data.ldif;\
		docker exec -ti mattermost-openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest -f /add-data.ldif';\
	elif [ $(shell docker ps | grep -ci mattermost-openldap) -eq 0 ]; then \
		echo restarting mattermost-openldap; \
		docker start mattermost-openldap > /dev/null; \
		sleep 10; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-elasticsearch) -eq 0 ]; then \
		echo starting mattermost-elasticsearch; \
		docker run --name mattermost-elasticsearch -p 9200:9200 -e "http.host=0.0.0.0" -e "transport.host=127.0.0.1" -e "ES_JAVA_OPTS=-Xms250m -Xmx250m" -d grundleborg/elasticsearch:latest > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-elasticsearch) -eq 0 ]; then \
		echo restarting mattermost-elasticsearch; \
		docker start mattermost-elasticsearch> /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-redis) -eq 0 ]; then \
		echo starting mattermost-redis; \
		docker run --name mattermost-redis -p 6379:6379 -d redis > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-redis) -eq 0 ]; then \
		echo restarting mattermost-redis; \
		docker start mattermost-redis > /dev/null; \
	fi
endif

stop-docker: ## Stops the docker containers for local development.
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

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 1 ]; then \
		echo stopping mattermost-inbucket; \
		docker stop mattermost-inbucket > /dev/null; \
	fi

		@if [ $(shell docker ps -a | grep -ci mattermost-minio) -eq 1 ]; then \
		echo stopping mattermost-minio; \
		docker stop mattermost-minio > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-elasticsearch) -eq 1 ]; then \
		echo stopping mattermost-elasticsearch; \
		docker stop mattermost-elasticsearch > /dev/null; \
	fi

clean-docker: ## Deletes the docker containers for local development.
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

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 1 ]; then \
		echo removing mattermost-inbucket; \
		docker stop mattermost-inbucket > /dev/null; \
		docker rm -v mattermost-inbucket > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-minio) -eq 1 ]; then \
		echo removing mattermost-minio; \
		docker stop mattermost-minio > /dev/null; \
		docker rm -v mattermost-minio > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-elasticsearch) -eq 1 ]; then \
		echo removing mattermost-elasticsearch; \
		docker stop mattermost-elasticsearch > /dev/null; \
		docker rm -v mattermost-elasticsearch > /dev/null; \
	fi

govet: ## Runs govet against all packages.
	@echo Running GOVET
	$(GO) vet $(GOFLAGS) $(TE_PACKAGES) || exit 1

ifeq ($(BUILD_ENTERPRISE_READY),true)
	$(GO) vet $(GOFLAGS) $(EE_PACKAGES) || exit 1
endif

gofmt: ## Runs gofmt against all packages.
	@echo Running GOFMT

	@for package in $(TE_PACKAGES) $(EE_PACKAGES); do \
		echo "Checking "$$package; \
		files=$$(go list -f '{{range .GoFiles}}{{$$.Dir}}/{{.}} {{end}}' $$package); \
		if [ "$$files" ]; then \
			gofmt_output=$$(gofmt -d -s $$files 2>&1); \
			if [ "$$gofmt_output" ]; then \
				echo "$$gofmt_output"; \
				echo "gofmt failure"; \
				exit 1; \
			fi; \
		fi; \
	done
	@echo "gofmt success"; \

megacheck: ## Run megacheck on codebasis
	go get honnef.co/go/tools/cmd/megacheck
	$(GOPATH)/bin/megacheck $(TE_PACKAGES)

ifeq ($(BUILD_ENTERPRISE_READY),true)
	$(GOPATH)/bin/megacheck $(EE_PACKAGES) || exit 1
endif

store-mocks: ## Creates mock files.
	go get -u github.com/vektra/mockery/...
	$(GOPATH)/bin/mockery -dir store -all -output store/storetest/mocks -note 'Regenerate this file using `make store-mocks`.'

filesstore-mocks: ## Creates mock files.
	go get -u github.com/vektra/mockery/...
	$(GOPATH)/bin/mockery -dir services/filesstore -all -output services/filesstore/mocks -note 'Regenerate this file using `make filesstore-mocks`.'

ldap-mocks: ## Creates mock files for ldap.
	go get -u github.com/vektra/mockery/...
	$(GOPATH)/bin/mockery -dir enterprise/ldap -all -output enterprise/ldap/mocks -note 'Regenerate this file using `make ldap-mocks`.'

plugin-mocks: ## Creates mock files for plugins.
	go get -u github.com/vektra/mockery/...
	$(GOPATH)/bin/mockery -dir plugin -name API -output plugin/plugintest -outpkg plugintest -case underscore -note 'Regenerate this file using `make plugin-mocks`.'
	$(GOPATH)/bin/mockery -dir plugin -name Hooks -output plugin/plugintest -outpkg plugintest -case underscore -note 'Regenerate this file using `make plugin-mocks`.'

pluginapi: ## Generates api and hooks glue code for plugins
	go generate ./plugin

check-licenses: ## Checks license status.
	./scripts/license-check.sh $(TE_PACKAGES) $(EE_PACKAGES)

check-prereqs: ## Checks prerequisite software status.
	./scripts/prereq-check.sh

check-style: govet gofmt check-licenses ## Runs govet and gofmt against all packages.

test-te-race: ## Checks for race conditions in the team edition.
	@echo Testing TE race conditions

	@echo "Packages to test: "$(TE_PACKAGES)

	@for package in $(TE_PACKAGES); do \
		echo "Testing "$$package; \
		$(GO) test $(GOFLAGS) -race -run=$(TESTS) -test.timeout=4000s $$package || exit 1; \
	done

test-ee-race: ## Checks for race conditions in the enterprise edition.
	@echo Testing EE race conditions

ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo "Packages to test: "$(EE_PACKAGES)

	for package in $(EE_PACKAGES); do \
		echo "Testing "$$package; \
		$(GO) test $(GOFLAGS) -race -run=$(TESTS) -c $$package; \
		if [ -f $$(basename $$package).test ]; then \
			echo "Testing "$$package; \
			./$$(basename $$package).test -test.timeout=2000s || exit 1; \
			rm -r $$(basename $$package).test; \
		fi; \
	done

	rm -f config/*.crt
	rm -f config/*.key
endif

test-server-race: test-te-race test-ee-race ## Checks for race conditions.
	find . -type d -name data -not -path './vendor/*' | xargs rm -rf

do-cover-file: ## Creates the test coverage report file.
	@echo "mode: count" > cover.out

test-te: do-cover-file ## Runs tests in the team edition.
	@echo Testing TE
	@echo "Packages to test: "$(TE_PACKAGES)
	find . -name 'cprofile*.out' -exec sh -c 'rm "{}"' \;
	$(GO) test $(GOFLAGS) -run=$(TESTS) $(TESTFLAGS) -v -timeout=2000s -covermode=count -coverpkg=$(ALL_PACKAGES_COMMA) -exec $(ROOT)/scripts/test-xprog.sh $(TE_PACKAGES)
	find . -name 'cprofile*.out' -exec sh -c 'tail -n +2 {} >> cover.out ; rm "{}"' \;

test-ee: do-cover-file ## Runs tests in the enterprise edition.
	@echo Testing EE

ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo "Packages to test: "$(EE_PACKAGES)
	find . -name 'cprofile*.out' -exec sh -c 'rm "{}"' \;
	$(GO) test $(GOFLAGS) -run=$(TESTS) $(TESTFLAGSEE) -p 1 -v -timeout=2000s -covermode=count -coverpkg=$(ALL_PACKAGES_COMMA) -exec $(ROOT)/scripts/test-xprog.sh $(EE_PACKAGES)
	find . -name 'cprofile*.out' -exec sh -c 'tail -n +2 {} >> cover.out ; rm "{}"' \;
	rm -f config/*.crt
	rm -f config/*.key
endif

test-server: test-te test-ee ## Runs tests.
	find . -type d -name data -not -path './vendor/*' | xargs rm -rf

internal-test-web-client: ## Runs web client tests.
	$(GO) run $(GOFLAGS) $(PLATFORM_FILES) test web_client_tests

run-server-for-web-client-tests: ## Tests the server for web client.
	$(GO) run $(GOFLAGS) $(PLATFORM_FILES) test web_client_tests_server

test-client: ## Test client app.
	@echo Running client tests

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) test

test: test-server test-client ## Runs all checks and tests below (except race detection and postgres).

cover: ## Runs the golang coverage tool. You must run the unit tests first.
	@echo Opening coverage info in browser. If this failed run make test first

	$(GO) tool cover -html=cover.out
	$(GO) tool cover -html=ecover.out

test-data: start-docker ## Add test data to the local instance.
	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) $(PLATFORM_FILES) sampledata -w 1

	@echo You may need to restart the Mattermost server before using the following
	@echo ========================================================================
	@echo Login with a system admin account username=sysadmin password=sysadmin
	@echo Login with a regular account username=user-1 password=user-1
	@echo ========================================================================

run-server: start-docker ## Starts the server.
	@echo Running mattermost for development

	mkdir -p $(BUILD_WEBAPP_DIR)/dist/files
	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) $(PLATFORM_FILES) --disableconfigwatch &

debug-server: start-docker
	mkdir -p $(BUILD_WEBAPP_DIR)/dist/files
	$(DELVE) debug $(PLATFORM_FILES) --build-flags="-ldflags '\
		-X github.com/mattermost/mattermost-server/model.BuildNumber=$(BUILD_NUMBER)\
		-X \"github.com/mattermost/mattermost-server/model.BuildDate=$(BUILD_DATE)\"\
		-X github.com/mattermost/mattermost-server/model.BuildHash=$(BUILD_HASH)\
		-X github.com/mattermost/mattermost-server/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
		-X github.com/mattermost/mattermost-server/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)'"

run-cli: start-docker ## Runs CLI.
	@echo Running mattermost for development
	@echo Example should be like 'make ARGS="-version" run-cli'

	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) $(PLATFORM_FILES) ${ARGS}

run-client: ## Runs the webapp.
	@echo Running mattermost client for development

	ln -nfs $(BUILD_WEBAPP_DIR)/dist client
	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

run-client-fullmap: ## Runs the webapp with source code mapping (slower; better debugging).
	@echo Running mattermost client for development with FULL SOURCE MAP

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run-fullmap

run: check-prereqs run-server run-client ## Runs the server and webapp.

run-fullmap: run-server run-client-fullmap ## Same as run but with a full sourcemap for client.

stop-server: ## Stops the server.
	@echo Stopping mattermost

ifeq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
	wmic process where "Caption='go.exe' and CommandLine like '%go.exe run%'" call terminate
	wmic process where "Caption='mattermost.exe' and CommandLine like '%go-build%'" call terminate
else
	@for PID in $$(ps -ef | grep "[g]o run" | awk '{ print $$2 }'); do \
		echo stopping go $$PID; \
		kill $$PID; \
	done
	@for PID in $$(ps -ef | grep "[g]o-build" | awk '{ print $$2 }'); do \
		echo stopping mattermost $$PID; \
		kill $$PID; \
	done
endif

stop-client: ## Stops the webapp.
	@echo Stopping mattermost client

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) stop

stop: stop-server stop-client ## Stops server and client.

restart: restart-server restart-client ## Restarts the server and webapp.

restart-server: | stop-server run-server ## Restarts the mattermost server to pick up development change.

restart-client: | stop-client run-client ## Restarts the webapp.

run-job-server: ## Runs the background job server.
	@echo Running job server for development
	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) $(PLATFORM_FILES) jobserver --disableconfigwatch &

config-ldap: ## Configures LDAP.
	@echo Setting up configuration for local LDAP

	@sed -i'' -e 's|"LdapServer": ".*"|"LdapServer": "dockerhost"|g' config/config.json
	@sed -i'' -e 's|"BaseDN": ".*"|"BaseDN": "ou=testusers,dc=mm,dc=test,dc=com"|g' config/config.json
	@sed -i'' -e 's|"BindUsername": ".*"|"BindUsername": "cn=admin,dc=mm,dc=test,dc=com"|g' config/config.json
	@sed -i'' -e 's|"BindPassword": ".*"|"BindPassword": "mostest"|g' config/config.json
	@sed -i'' -e 's|"FirstNameAttribute": ".*"|"FirstNameAttribute": "cn"|g' config/config.json
	@sed -i'' -e 's|"LastNameAttribute": ".*"|"LastNameAttribute": "sn"|g' config/config.json
	@sed -i'' -e 's|"NicknameAttribute": ".*"|"NicknameAttribute": "cn"|g' config/config.json
	@sed -i'' -e 's|"EmailAttribute": ".*"|"EmailAttribute": "mail"|g' config/config.json
	@sed -i'' -e 's|"UsernameAttribute": ".*"|"UsernameAttribute": "uid"|g' config/config.json
	@sed -i'' -e 's|"IdAttribute": ".*"|"IdAttribute": "uid"|g' config/config.json

config-reset: ## Resets the config/config.json file to the default.
	@echo Resetting configuration to default
	rm -f config/config.json
	cp config/default.json config/config.json

clean: stop-docker ## Clean up everything except persistant server data.
	@echo Cleaning

	rm -Rf $(DIST_ROOT)
	go clean $(GOFLAGS) -i ./...

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) clean

	find . -type d -name data -not -path './vendor/*' | xargs rm -rf
	rm -rf logs

	rm -f mattermost.log
	rm -f mattermost.log.jsonl
	rm -f npm-debug.log
	rm -f .prepare-go
	rm -f enterprise
	rm -f cover.out
	rm -f ecover.out
	rm -f *.out
	rm -f *.test
	rm -f imports/imports.go
	rm -f cmd/platform/cprofile*.out
	rm -f cmd/mattermost/cprofile*.out

nuke: clean clean-docker ## Clean plus removes persistant server data.
	@echo BOOM

	rm -rf data

setup-mac: ## Adds macOS hosts entries for Docker.
	echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts


todo: ## Display TODO and FIXME items in the source code.
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime TODO
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime XXX
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime FIXME
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime "FIX ME"
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime TODO enterprise/
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime XXX enterprise/
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime FIXME enterprise/
	@! ag --ignore Makefile --ignore-dir vendor --ignore-dir runtime "FIX ME" enterprise/
endif

## Help documentatin à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
