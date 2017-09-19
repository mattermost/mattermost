.PHONY: build package run stop run-client run-server stop-client stop-server restart restart-server restart-client start-docker clean-dist clean nuke check-style check-client-style check-server-style check-unit-tests test dist setup-mac prepare-enteprise run-client-tests setup-run-client-tests cleanup-run-client-tests test-client build-linux build-osx build-windows internal-test-web-client vet run-server-for-web-client-tests

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
GOPATH ?= $(GOPATH:):./vendor
GOFLAGS ?= $(GOFLAGS:)
GO=go
GO_LINKER_FLAGS ?= -ldflags \
				   "-X github.com/mattermost/mattermost-server/model.BuildNumber=$(BUILD_NUMBER)\
				    -X 'github.com/mattermost/mattermost-server/model.BuildDate=$(BUILD_DATE)'\
				    -X github.com/mattermost/mattermost-server/model.BuildHash=$(BUILD_HASH)\
				    -X github.com/mattermost/mattermost-server/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
				    -X github.com/mattermost/mattermost-server/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)"

# GOOS/GOARCH of the build host, used to determine whether we're cross-compiling or not
BUILDER_GOOS_GOARCH="$(shell $(GO) env GOOS)_$(shell $(GO) env GOARCH)"

# Output paths
DIST_ROOT=dist
DIST_PATH=$(DIST_ROOT)/mattermost

# Tests
TESTS=.

TESTFLAGS ?= -short
TESTFLAGSEE ?= -test.short

# Packages lists
TE_PACKAGES=$(shell go list ./... | grep -v vendor)
TE_PACKAGES_COMMA=$(shell echo $(TE_PACKAGES) | tr ' ' ',')

EE_PACKAGES=$(shell go list ./enterprise/... | grep -v vendor | tail -n +2)
EE_PACKAGES_COMMA=$(shell echo $(EE_PACKAGES) | tr ' ' ',')

ifeq ($(BUILD_ENTERPRISE_READY),true)
ALL_PACKAGES_COMMA=$(TE_PACKAGES_COMMA),$(EE_PACKAGES_COMMA)
else
ALL_PACKAGES_COMMA=$(TE_PACKAGES_COMMA)
endif

# Prepares the enterprise build if exists. The IGNORE stuff is a hack to get the Makefile to execute the commands outside a target
ifeq ($(BUILD_ENTERPRISE_READY),true)
	IGNORE:=$(shell echo Enterprise build selected, preparing)
	IGNORE:=$(shell mkdir -p imports/)
	IGNORE:=$(shell cp $(BUILD_ENTERPRISE_DIR)/imports/imports.go imports/)
	IGNORE:=$(shell rm -f enterprise)
	IGNORE:=$(shell ln -s $(BUILD_ENTERPRISE_DIR) enterprise)
endif


all: run

include build/*.mk

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

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 0 ]; then \
		echo starting mattermost-inbucket; \
		docker run --name mattermost-inbucket -p 9000:10080 -p 2500:10025 -d jhillyerd/inbucket:latest > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-inbucket) -eq 0 ]; then \
		echo restarting mattermost-inbucket; \
		docker start mattermost-inbucket > /dev/null; \
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

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 1 ]; then \
		echo stopping mattermost-inbucket; \
		docker stop mattermost-inbucket > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-elasticsearch) -eq 1 ]; then \
		echo stopping mattermost-elasticsearch; \
		docker stop mattermost-elasticsearch > /dev/null; \
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

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 1 ]; then \
		echo removing mattermost-inbucket; \
		docker stop mattermost-inbucket > /dev/null; \
		docker rm -v mattermost-inbucket > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-elasticsearch) -eq 1 ]; then \
		echo removing mattermost-elasticsearch; \
		docker stop mattermost-elasticsearch > /dev/null; \
		docker rm -v mattermost-elasticsearch > /dev/null; \
	fi

govet:
	@echo Running GOVET
	$(GO) vet $(GOFLAGS) $(TE_PACKAGES) || exit 1

ifeq ($(BUILD_ENTERPRISE_READY),true)
	$(GO) vet $(GOFLAGS) $(EE_PACKAGES) || exit 1
endif

gofmt: 
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

check-style: govet gofmt

test-te-race:
	@echo Testing TE race conditions

	@echo "Packages to test: "$(TE_PACKAGES)

	@for package in $(TE_PACKAGES); do \
		echo "Testing "$$package; \
		$(GO) test $(GOFLAGS) -race -run=$(TESTS) -test.timeout=4000s $$package || exit 1; \
	done

test-ee-race:
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

test-server-race: test-te-race test-ee-race

do-cover-file:
	@echo "mode: count" > cover.out

test-te: do-cover-file
	@echo Testing TE


	@echo "Packages to test: "$(TE_PACKAGES)

	@for package in $(TE_PACKAGES); do \
		echo "Testing "$$package; \
		$(GO) test $(GOFLAGS) -run=$(TESTS) $(TESTFLAGS) -test.v -test.timeout=2000s -covermode=count -coverprofile=cprofile.out -coverpkg=$(ALL_PACKAGES_COMMA) $$package || exit 1; \
		if [ -f cprofile.out ]; then \
			tail -n +2 cprofile.out >> cover.out; \
			rm cprofile.out; \
		fi; \
	done

test-ee: do-cover-file
	@echo Testing EE

ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo "Packages to test: "$(EE_PACKAGES)

	for package in $(EE_PACKAGES); do \
		echo "Testing "$$package; \
		$(GO) test $(GOFLAGS) -run=$(TESTS) -covermode=count -coverpkg=$(ALL_PACKAGES_COMMA) -c $$package || exit 1; \
		if [ -f $$(basename $$package).test ]; then \
			echo "Testing "$$package; \
			./$$(basename $$package).test -test.v $(TESTFLAGSEE) -test.timeout=2000s -test.coverprofile=cprofile.out || exit 1; \
			if [ -f cprofile.out ]; then \
				tail -n +2 cprofile.out >> cover.out; \
				rm cprofile.out; \
			fi; \
			rm -r $$(basename $$package).test; \
		fi; \
	done

	rm -f config/*.crt
	rm -f config/*.key
endif

test-postgres:
	@echo Testing Postgres

	@sed -i'' -e 's|"DriverName": "mysql"|"DriverName": "postgres"|g' config/config.json
	@sed -i'' -e 's|"DataSource": "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8"|"DataSource": "postgres://mmuser:mostest@dockerhost:5432?sslmode=disable"|g' config/config.json

	$(GO) test $(GOFLAGS) -run=$(TESTS) -test.v -test.timeout=2000s -covermode=count -coverprofile=cprofile.out -coverpkg=$(ALL_PACKAGES_COMMA) github.com/mattermost/mattermost-server/store || exit 1; \
	if [ -f cprofile.out ]; then \
		tail -n +2 cprofile.out >> cover.out; \
		rm cprofile.out; \
	fi; \

	@sed -i'' -e 's|"DataSource": "postgres://mmuser:mostest@dockerhost:5432?sslmode=disable"|"DataSource": "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8"|g' config/config.json
	@sed -i'' -e 's|"DriverName": "postgres"|"DriverName": "mysql"|g' config/config.json
	@rm config/config.json-e

test-server: test-te test-ee

internal-test-web-client:
	$(GO) run $(GOFLAGS) ./cmd/platform/*go test web_client_tests

run-server-for-web-client-tests:
	$(GO) run $(GOFLAGS) ./cmd/platform/*go test web_client_tests_server

test-client:
	@echo Running client tests

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) test

test: test-server test-client

cover:
	@echo Opening coverage info in browser. If this failed run make test first

	$(GO) tool cover -html=cover.out
	$(GO) tool cover -html=ecover.out

run-server: start-docker
	@echo Running mattermost for development

	mkdir -p $(BUILD_WEBAPP_DIR)/dist/files
	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) ./cmd/platform/*.go --disableconfigwatch &

run-cli: start-docker
	@echo Running mattermost for development
	@echo Example should be like 'make ARGS="-version" run-cli'

	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) ./cmd/platform/*.go ${ARGS}

run-client:
	@echo Running mattermost client for development

	@if [ ! -e client ]; then \
		ln -s $(BUILD_WEBAPP_DIR)/dist client; \
	fi
	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

run-client-fullmap:
	@echo Running mattermost client for development with FULL SOURCE MAP

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run-fullmap

run: run-server run-client

run-fullmap: run-server run-client-fullmap

stop-server:
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

stop-client:
	@echo Stopping mattermost client

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) stop

stop: stop-server stop-client

restart: restart-server restart-client

restart-server: | stop-server run-server

restart-client: | stop-client run-client

run-job-server:
	@echo Running job server for development
	$(GO) run $(GOFLAGS) $(GO_LINKER_FLAGS) ./cmd/platform/*.go jobserver --disableconfigwatch &

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
	rm -f imports.go

nuke: clean clean-docker
	@echo BOOM

	rm -rf data

setup-mac:
	echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts


todo:
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
