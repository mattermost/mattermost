.PHONY: build package run stop run-client run-server run-haserver stop-haserver stop-client stop-server restart restart-server restart-client restart-haserver start-docker clean-dist clean nuke check-style check-client-style check-server-style check-unit-tests test dist run-client-tests setup-run-client-tests cleanup-run-client-tests test-client build-linux build-osx build-windows package-prep package-linux package-osx package-windows internal-test-web-client vet run-server-for-web-client-tests diff-config prepackaged-plugins prepackaged-binaries test-server test-server-ee test-server-quick test-server-race new-migration migrations-extract

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

ifeq ($(OS),Windows_NT)
	PLATFORM := Windows
else
	PLATFORM := $(shell uname)
endif

# Set an environment variable on Linux used to resolve `docker.host.internal` inconsistencies with
# docker. This can be reworked once https://github.com/docker/for-linux/issues/264 is resolved
# satisfactorily.
ifeq ($(PLATFORM),Linux)
	export IS_LINUX = -linux
else
	export IS_LINUX =
endif

# Detect M1/M2 Macs and set a flag.
ifeq ($(shell uname)/$(shell uname -m),Darwin/arm64)
  M1_MAC = true
endif

define LICENSE_HEADER
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

endef

IS_CI ?= false
# Build Flags
BUILD_NUMBER ?= $(BUILD_NUMBER:)
BUILD_DATE = $(shell date -u)
BUILD_HASH = $(shell git rev-parse HEAD)
# If we don't set the build number it defaults to dev
ifeq ($(BUILD_NUMBER),)
	BUILD_DATE := n/a
	BUILD_NUMBER := dev
endif

ifeq ($(BUILD_NUMBER),dev)
	export MM_FEATUREFLAGS_GRAPHQL = true
endif

# Enterprise
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

# Webapp
BUILD_WEBAPP_DIR ?= ../mattermost-webapp
BUILD_CLIENT = false
BUILD_HASH_CLIENT = independent
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

# Boards
BUILD_BOARDS_DIR ?= ../focalboard
BUILD_BOARDS ?= true
BUILD_HASH_BOARDS = none
ifneq ($(wildcard $(BUILD_BOARDS_DIR)/.),)
  ifeq ($(BUILD_BOARDS),true)
    BUILD_BOARDS = true
    BUILD_HASH_BOARDS = $(shell cd $(BUILD_BOARDS_DIR) && git rev-parse HEAD)
  else
    BUILD_BOARDS = false
  endif
else
    BUILD_BOARDS = false
endif

# Playbooks
BUILD_PLAYBOOKS_DIR ?= ../mattermost-plugin-playbooks
BUILD_PLAYBOOKS ?= false
BUILD_HASH_PLAYBOOKS = none

ifneq ($(wildcard $(BUILD_PLAYBOOKS_DIR)/.),)
  ifeq ($(BUILD_PLAYBOOKS),true)
    BUILD_PLAYBOOKS = true
    BUILD_HASH_PLAYBOOKS = $(shell cd $(BUILD_PLAYBOOKS_DIR) && git rev-parse HEAD)
  else
    BUILD_PLAYBOOKS = false
  endif
else
    BUILD_PLAYBOOKS = false
endif

# We need current user's UID for `run-haserver` so docker compose does not run server
# as root and mess up file permissions for devs. When running like this HOME will be blank
# and docker will add '/', so we need to set the go-build cache location or we'll get
# permission errors on build as it tries to create a cache in filesystem root.
export CURRENT_UID = $(shell id -u):$(shell id -g)
ifeq ($(HOME),/)
	export XDG_CACHE_HOME = /tmp/go-cache/
endif

# Go Flags
GOFLAGS ?= $(GOFLAGS:)
# We need to export GOBIN to allow it to be set
# for processes spawned from the Makefile
export GOBIN ?= $(PWD)/bin
GO=go
DELVE=dlv
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildNumber=$(BUILD_NUMBER)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildDate=$(BUILD_DATE)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildHash=$(BUILD_HASH)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildHashBoards=$(BUILD_HASH_BOARDS)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildBoards=$(BUILD_BOARDS)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.BuildHashPlaybooks=$(BUILD_HASH_PLAYBOOKS)"

GO_MAJOR_VERSION = $(shell $(GO) version | cut -c 14- | cut -d' ' -f1 | cut -d'.' -f1)
GO_MINOR_VERSION = $(shell $(GO) version | cut -c 14- | cut -d' ' -f1 | cut -d'.' -f2)
MINIMUM_SUPPORTED_GO_MAJOR_VERSION = 1
MINIMUM_SUPPORTED_GO_MINOR_VERSION = 15
GO_VERSION_VALIDATION_ERR_MSG = Golang version is not supported, please update to at least $(MINIMUM_SUPPORTED_GO_MAJOR_VERSION).$(MINIMUM_SUPPORTED_GO_MINOR_VERSION)

# GOOS/GOARCH of the build host, used to determine whether we're cross-compiling or not
BUILDER_GOOS_GOARCH="$(shell $(GO) env GOOS)_$(shell $(GO) env GOARCH)"

PLATFORM_FILES="./cmd/mattermost"

# Output paths
DIST_ROOT=dist
DIST_PATH=$(DIST_ROOT)/mattermost
DIST_PATH_LIN_AMD64=$(DIST_ROOT)/linux_amd64/mattermost
DIST_PATH_LIN_ARM64=$(DIST_ROOT)/linux_arm64/mattermost
DIST_PATH_OSX_AMD64=$(DIST_ROOT)/osx_amd64/mattermost
DIST_PATH_OSX_ARM64=$(DIST_ROOT)/osx_arm64/mattermost
DIST_PATH_WIN=$(DIST_ROOT)/windows/mattermost

# Tests
TESTS=.

# Packages lists
TE_PACKAGES=$(shell $(GO) list ./...)

TEMPLATES_DIR=templates

# Plugins Packages
PLUGIN_PACKAGES ?= mattermost-plugin-antivirus-v0.1.2
PLUGIN_PACKAGES += mattermost-plugin-autolink-v1.2.2
PLUGIN_PACKAGES += mattermost-plugin-aws-SNS-v1.2.0
PLUGIN_PACKAGES += mattermost-plugin-calls-v0.13.0
PLUGIN_PACKAGES += mattermost-plugin-channel-export-v1.0.0
PLUGIN_PACKAGES += mattermost-plugin-confluence-v1.3.0
PLUGIN_PACKAGES += mattermost-plugin-custom-attributes-v1.3.1
PLUGIN_PACKAGES += mattermost-plugin-github-v2.1.4
PLUGIN_PACKAGES += mattermost-plugin-gitlab-v1.6.0
PLUGIN_PACKAGES += mattermost-plugin-playbooks-v1.36.0
PLUGIN_PACKAGES += mattermost-plugin-jenkins-v1.1.0
PLUGIN_PACKAGES += mattermost-plugin-jira-v3.2.2
PLUGIN_PACKAGES += mattermost-plugin-jitsi-v2.0.1
PLUGIN_PACKAGES += mattermost-plugin-nps-v1.3.1
PLUGIN_PACKAGES += mattermost-plugin-todo-v0.6.1
PLUGIN_PACKAGES += mattermost-plugin-welcomebot-v1.2.0
PLUGIN_PACKAGES += mattermost-plugin-zoom-v1.6.0
# dummy change
PLUGIN_PACKAGES += focalboard-v7.8.2
PLUGIN_PACKAGES += mattermost-plugin-apps-v1.2.0

# Prepares the enterprise build if exists. The IGNORE stuff is a hack to get the Makefile to execute the commands outside a target
ifeq ($(BUILD_ENTERPRISE_READY),true)
	IGNORE:=$(shell echo Enterprise build selected, preparing)
	IGNORE:=$(shell rm -f imports/imports.go)
	IGNORE:=$(shell cp $(BUILD_ENTERPRISE_DIR)/imports/imports.go imports/)
	IGNORE:=$(shell rm -f enterprise)
else
	IGNORE:=$(shell rm -f imports/imports.go)
endif

EE_PACKAGES=$(shell $(GO) list $(BUILD_ENTERPRISE_DIR)/...)

ifeq ($(BUILD_ENTERPRISE_READY),true)
  ALL_PACKAGES=$(TE_PACKAGES) $(EE_PACKAGES)
else
  ALL_PACKAGES=$(TE_PACKAGES)
endif

# Prepare optional Boards build.
BOARDS_PACKAGES=$(shell $(GO) list $(BUILD_BOARDS_DIR)/server/...)
ifeq ($(BUILD_BOARDS),true)
# We removed `ALL_PACKAGES += $(BOARDS_PACKAGES)` since board tests needs `-tag 'json1'` in the tests.
# Adding that flag to server breaks the build with unsupported flag error.
# PR: https://github.com/mattermost/mattermost-server/pull/20772
# Ticket: https://mattermost.atlassian.net/browse/CLD-3800
	IGNORE:=$(shell echo Boards build selected, preparing)
	IGNORE:=$(shell rm -f imports/boards_imports.go)
	IGNORE:=$(shell cp $(BUILD_BOARDS_DIR)/mattermost-plugin/product/imports/boards_imports.go imports/)
else
	IGNORE:=$(shell rm -f imports/boards_imports.go)
endif

ifeq ($(BUILD_PLAYBOOKS),true)
IGNORE:=$(shell cp $(BUILD_PLAYBOOKS_DIR)/product/imports/playbooks_imports.go imports/)
else
	IGNORE:=$(shell rm -f imports/playbooks_imports.go)
endif

all: run ## Alias for 'run'.

-include config.override.mk

# Make sure not to modify an overridden ENABLED_DOCKER_SERVICES variable
DOCKER_SERVICES_OVERRIDE=false
ifneq (,$(ENABLED_DOCKER_SERVICES))
  $(info ENABLED_DOCKER_SERVICES has been overridden)
  DOCKER_SERVICES_OVERRIDE=true
endif

include config.mk
include build/*.mk

LDFLAGS += -X "github.com/mattermost/mattermost-server/v6/model.MockCWS=$(MM_ENABLE_CWS_MOCK)"

RUN_IN_BACKGROUND ?=
ifeq ($(RUN_SERVER_IN_BACKGROUND),true)
	RUN_IN_BACKGROUND := &
endif

DOCKER_COMPOSE_OVERRIDE=
ifneq ("$(wildcard ./docker-compose.override.yaml)","")
  DOCKER_COMPOSE_OVERRIDE=-f docker-compose.override.yaml
endif

ifeq ($(M1_MAC),true)
  $(info M1 detected, applying elasticsearch override)
  DOCKER_COMPOSE_OVERRIDE := -f docker-compose.makefile.m1.yml $(DOCKER_COMPOSE_OVERRIDE)
endif

ifneq ($(DOCKER_SERVICES_OVERRIDE),true)
  ifeq (,$(findstring minio,$(ENABLED_DOCKER_SERVICES)))
    TEMP_DOCKER_SERVICES:=$(TEMP_DOCKER_SERVICES) minio
  endif
  ifeq ($(BUILD_ENTERPRISE_READY),true)
    ifeq (,$(findstring openldap,$(ENABLED_DOCKER_SERVICES)))
      TEMP_DOCKER_SERVICES:=$(TEMP_DOCKER_SERVICES) openldap
    endif
    ifeq (,$(findstring elasticsearch,$(ENABLED_DOCKER_SERVICES)))
      TEMP_DOCKER_SERVICES:=$(TEMP_DOCKER_SERVICES) elasticsearch
	endif
  endif
  ENABLED_DOCKER_SERVICES:=$(ENABLED_DOCKER_SERVICES) $(TEMP_DOCKER_SERVICES)
endif

start-docker: ## Starts the docker containers for local development.
ifneq ($(IS_CI),false)
	@echo CI Build: skipping docker start
else ifeq ($(MM_NO_DOCKER),true)
	@echo No Docker Enabled: skipping docker start
else
	@echo Starting docker containers

	docker-compose rm start_dependencies
	$(GO) run ./build/docker-compose-generator/main.go $(ENABLED_DOCKER_SERVICES) | docker-compose -f docker-compose.makefile.yml -f /dev/stdin $(DOCKER_COMPOSE_OVERRIDE) run -T --rm start_dependencies
  ifneq (,$(findstring openldap,$(ENABLED_DOCKER_SERVICES)))
	cat tests/${LDAP_DATA}-data.ldif | docker-compose -f docker-compose.makefile.yml $(DOCKER_COMPOSE_OVERRIDE) exec -T openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest || true';
  endif
  ifneq (,$(findstring mysql-read-replica,$(ENABLED_DOCKER_SERVICES)))
	./scripts/replica-mysql-config.sh
  endif
endif

run-haserver:
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Starting mattermost in an HA topology '(3 node cluster)'

	docker-compose -f docker-compose.yaml $(DOCKER_COMPOSE_OVERRIDE) up --remove-orphans haproxy
endif

stop-haserver:
	@echo Stopping docker containers for HA topology
	docker-compose stop

stop-docker: ## Stops the docker containers for local development.
ifeq ($(MM_NO_DOCKER),true)
	@echo No Docker Enabled: skipping docker stop
else
	@echo Stopping docker containers

	docker-compose stop
endif

clean-docker: ## Deletes the docker containers for local development.
ifeq ($(MM_NO_DOCKER),true)
	@echo No Docker Enabled: skipping docker clean
else
	@echo Removing docker containers

	docker-compose down -v
	docker-compose rm -v
endif

plugin-checker:
	$(GO) run $(GOFLAGS) ./plugin/checker

prepackaged-plugins: ## Populate the prepackaged-plugins directory
	@echo Downloading prepackaged plugins
	mkdir -p prepackaged_plugins
	@cd prepackaged_plugins && for plugin_package in $(PLUGIN_PACKAGES) ; do \
		curl -f -O -L https://plugins-store.test.mattermost.com/release/$$plugin_package.tar.gz; \
		curl -f -O -L https://plugins-store.test.mattermost.com/release/$$plugin_package.tar.gz.sig; \
	done

prepackaged-binaries: ## Populate the prepackaged-binaries to the bin directory
ifeq ($(shell test -f bin/mmctl && printf "yes"),yes)
	@echo "MMCTL already exists in bin/mmctl not downloading a new version."
else
	@scripts/download_mmctl_release.sh
endif

golangci-lint: ## Run golangci-lint on codebase
	@# Keep the version in sync with the command in .circleci/config.yml
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.50.1

	@echo Running golangci-lint
	$(GOBIN)/golangci-lint run ./...
ifeq ($(BUILD_ENTERPRISE_READY),true)
  ifneq ($(MM_NO_ENTERPRISE_LINT),true)
		$(GOBIN)/golangci-lint run ../enterprise/...
  endif
endif
ifeq ($(BUILD_BOARDS),true)
  ifneq ($(MM_NO_BOARDS_LINT),true)
		cd $(BUILD_BOARDS_DIR); make server-lint
  endif
endif

app-layers: ## Extract interface from App struct
	$(GO) install github.com/reflog/struct2interface@v0.6.1
	$(GOBIN)/struct2interface -f "app" -o "app/app_iface.go" -p "app" -s "App" -i "AppIface" -t ./app/layer_generators/app_iface.go.tmpl
	$(GO) run ./app/layer_generators -in ./app/app_iface.go -out ./app/opentracing/opentracing_layer.go -template ./app/layer_generators/opentracing_layer.go.tmpl

i18n-extract: ## Extract strings for translation from the source code
	$(GO) install github.com/mattermost/mattermost-utilities/mmgotool@fdf2cd651b261bcd511a32da33dd76febedd44a8
	$(GOBIN)/mmgotool i18n extract --portal-dir=""

i18n-check: ## Exit on empty translation strings and translation source strings
	$(GO) install github.com/mattermost/mattermost-utilities/mmgotool@fdf2cd651b261bcd511a32da33dd76febedd44a8
	$(GOBIN)/mmgotool i18n clean-empty --portal-dir="" --check
	$(GOBIN)/mmgotool i18n check-empty-src --portal-dir=""

store-mocks: ## Creates mock files.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir store --name ".*Store" --output store/storetest/mocks --note 'Regenerate this file using `make store-mocks`.'

telemetry-mocks: ## Creates mock files.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir services/telemetry --all --output services/telemetry/mocks --note 'Regenerate this file using `make telemetry-mocks`.'

store-layers: ## Generate layers for the store
	$(GO) generate $(GOFLAGS) ./store

generate-worktemplates: ## Generate work templates
	$(GO) generate $(GOFLAGS) ./app/worktemplates

new-migration: ## Creates a new migration. Run with make new-migration name=<>
	$(GO) install github.com/mattermost/morph/cmd/morph@master
	@echo "Generating new migration for mysql"
	$(GOBIN)/morph generate $(name) --driver mysql --dir db/migrations --sequence

	@echo "Generating new migration for postgres"
	$(GOBIN)/morph generate $(name) --driver postgres --dir db/migrations --sequence

filestore-mocks: ## Creates mock files.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir shared/filestore --all --output shared/filestore/mocks --note 'Regenerate this file using `make filestore-mocks`.'

ldap-mocks: ## Creates mock files for ldap.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir enterprise/ldap --all --output enterprise/ldap/mocks --note 'Regenerate this file using `make ldap-mocks`.'

plugin-mocks: ## Creates mock files for plugins.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir plugin --name API --output plugin/plugintest --outpkg plugintest --case underscore --note 'Regenerate this file using `make plugin-mocks`.'
	$(GOBIN)/mockery --dir plugin --name Hooks --output plugin/plugintest --outpkg plugintest --case underscore --note 'Regenerate this file using `make plugin-mocks`.'
	$(GOBIN)/mockery --dir plugin --name Driver --output plugin/plugintest --outpkg plugintest --case underscore --note 'Regenerate this file using `make plugin-mocks`.'

einterfaces-mocks: ## Creates mock files for einterfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir einterfaces --all --output einterfaces/mocks --note 'Regenerate this file using `make einterfaces-mocks`.'

searchengine-mocks: ## Creates mock files for searchengines.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir services/searchengine --all --output services/searchengine/mocks --note 'Regenerate this file using `make searchengine-mocks`.'

sharedchannel-mocks: ## Creates mock files for shared channels.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir=./services/sharedchannel --name=ServerIface --output=./services/sharedchannel --inpackage --outpkg=sharedchannel --testonly --note 'Regenerate this file using `make sharedchannel-mocks`.'
	$(GOBIN)/mockery --dir=./services/sharedchannel --name=AppIface --output=./services/sharedchannel --inpackage --outpkg=sharedchannel --testonly --note 'Regenerate this file using `make sharedchannel-mocks`.'

misc-mocks: ## Creates mocks for misc interfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir utils --name LicenseValidatorIface --output utils/mocks --note 'Regenerate this file using `make misc-mocks`.'
	$(GOBIN)/mockery --dir app --name WorkTemplateExecutor --output app/mocks --note 'Regenerate this file using `make misc-mocks`.'

email-mocks: ## Creates mocks for misc interfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.10.4
	$(GOBIN)/mockery --dir app/email --name ServiceInterface --output app/email/mocks --note 'Regenerate this file using `make email-mocks`.'

platform-mocks: ## Creates mocks for platform interfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.14.0
	$(GOBIN)/mockery --dir app/platform --name SuiteIFace --output app/platform/mocks --note 'Regenerate this file using `make platform-mocks`.'

pluginapi: ## Generates api and hooks glue code for plugins
	$(GO) generate $(GOFLAGS) ./plugin

mocks: store-mocks telemetry-mocks filestore-mocks ldap-mocks plugin-mocks einterfaces-mocks searchengine-mocks sharedchannel-mocks misc-mocks email-mocks platform-mocks

layers: app-layers store-layers pluginapi

generated: mocks layers

check-prereqs: ## Checks prerequisite software status.
	./scripts/prereq-check.sh

check-prereqs-enterprise: setup-go-work ## Checks prerequisite software status for enterprise.
ifeq ($(BUILD_ENTERPRISE_READY),true)
	./scripts/prereq-check-enterprise.sh
endif

setup-go-work: export BUILD_ENTERPRISE_READY := $(BUILD_ENTERPRISE_READY)
setup-go-work: export BUILD_BOARDS := $(BUILD_BOARDS)
setup-go-work: export BUILD_PLAYBOOKS := $(BUILD_PLAYBOOKS)
setup-go-work: ## Sets up your go.work file
	./scripts/setup_go_work.sh $(IGNORE_GO_WORK_IF_EXISTS)

check-style: golangci-lint plugin-checker vet ## Runs style/lint checks


do-cover-file: ## Creates the test coverage report file.
	@echo "mode: count" > cover.out

go-junit-report:
	$(GO) install github.com/jstemmer/go-junit-report@v1.0.0

test-compile: ## Compile tests.
	@echo COMPILE TESTS

	for package in $(TE_PACKAGES) $(EE_PACKAGES); do \
		$(GO) test $(GOFLAGS) -c $$package; \
	done

test-db-migration: start-docker ## Gets diff of upgrade vs new instance schemas.
	./scripts/mysql-migration-test.sh 6.0.0
	./scripts/psql-migration-test.sh 6.0.0

test-db-migration-v5: start-docker ## Gets diff of upgrade vs new instance schemas.
	./scripts/mysql-migration-test.sh 5.0.0
	./scripts/psql-migration-test.sh 5.0.0

gomodtidy:
	@cp go.mod go.mod.orig
	@cp go.sum go.sum.orig
	@if [ -f "imports/imports.go" ]; then \
		mv imports/imports.go imports/imports.go.orig; \
	fi;
	@if [ -f "imports/boards_imports.go" ]; then \
		mv imports/boards_imports.go imports/boards_imports.go.orig; \
	fi;
	$(GO) mod tidy
	@if [ "$$(diff go.mod go.mod.orig)" != "" -o "$$(diff go.sum go.sum.orig)" != "" ]; then \
		echo "go.mod/go.sum was modified. \ndiff- $$(diff go.mod go.mod.orig) \n$$(diff go.sum go.sum.orig) \nRun \"go mod tidy\"."; \
		rm go.*.orig; \
		exit 1; \
	fi;
	@if [ -f "imports/imports.go.orig" ]; then \
		mv imports/imports.go.orig imports/imports.go; \
	fi;
	@if [ -f "imports/boards_imports.go.orig" ]; then \
		mv imports/boards_imports.go.orig imports/boards_imports.go; \
	fi;
	@rm go.*.orig;

modules-tidy:
	@if [ -f "imports/imports.go" ]; then \
		mv imports/imports.go imports/imports.go.orig; \
	fi;
	@if [ -f "imports/boards_imports.go" ]; then \
		mv imports/boards_imports.go imports/boards_imports.go.orig; \
	fi;
	-$(GO) mod tidy
	@if [ -f "imports/imports.go.orig" ]; then \
		mv imports/imports.go.orig imports/imports.go; \
	fi;
	@if [ -f "imports/boards_imports.go.orig" ]; then \
		mv imports/boards_imports.go.orig imports/boards_imports.go; \
	fi;

test-server-pre: check-prereqs-enterprise start-docker go-junit-report do-cover-file ## Runs tests.
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Running all tests
else
	@echo Running only TE tests
endif

test-server-race: test-server-pre
	./scripts/test.sh "$(GO)" "-race $(GOFLAGS)" "$(ALL_PACKAGES)" "$(TESTS)" "$(TESTFLAGS)" "$(GOBIN)" "90m" "atomic"
ifneq ($(IS_CI),true)
  ifneq ($(MM_NO_DOCKER),true)
    ifneq ($(TEMP_DOCKER_SERVICES),)
	  @echo Stopping temporary docker services
	  docker-compose stop $(TEMP_DOCKER_SERVICES)
    endif
  endif
endif

test-server: test-server-pre
	./scripts/test.sh "$(GO)" "$(GOFLAGS)" "$(ALL_PACKAGES)" "$(TESTS)" "$(TESTFLAGS)" "$(GOBIN)" "45m" "count"
ifneq ($(IS_CI),true)
  ifneq ($(MM_NO_DOCKER),true)
    ifneq ($(TEMP_DOCKER_SERVICES),)
	  @echo Stopping temporary docker services
	  docker-compose stop $(TEMP_DOCKER_SERVICES)
    endif
  endif
endif

test-server-ee: check-prereqs-enterprise start-docker go-junit-report do-cover-file ## Runs EE tests.
	@echo Running only EE tests
	./scripts/test.sh "$(GO)" "$(GOFLAGS)" "$(EE_PACKAGES)" "$(TESTS)" "$(TESTFLAGS)" "$(GOBIN)" "20m" "count"

test-server-quick: check-prereqs-enterprise ## Runs only quick tests.
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Running all tests
	$(GO) test $(GOFLAGS) -short $(ALL_PACKAGES)
else
	@echo Running only TE tests
	$(GO) test $(GOFLAGS) -short $(TE_PACKAGES)
endif

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

test-data: run-server inject-test-data ## start a local instance and add test data to it.

inject-test-data: # add test data to the local instance.
	@if ! ./scripts/wait-for-system-start.sh; then \
		make stop; \
	fi

	@echo ServiceSettings.EnableLocalMode must be set to true.

	bin/mmctl config set TeamSettings.MaxUsersPerTeam 100 --local
	bin/mmctl sampledata -u 60 --local

	@echo You may need to restart the Mattermost server before using the following
	@echo ========================================================================
	@echo Login with a system admin account username=sysadmin password=Sys@dmin-sample1
	@echo Login with a regular account username=user-1 password=SampleUs@r-1
	@echo ========================================================================

validate-go-version: ## Validates the installed version of go against Mattermost's minimum requirement.
	@if [ $(GO_MAJOR_VERSION) -gt $(MINIMUM_SUPPORTED_GO_MAJOR_VERSION) ]; then \
		exit 0 ;\
	elif [ $(GO_MAJOR_VERSION) -lt $(MINIMUM_SUPPORTED_GO_MAJOR_VERSION) ]; then \
		echo '$(GO_VERSION_VALIDATION_ERR_MSG)';\
		exit 1; \
	elif [ $(GO_MINOR_VERSION) -lt $(MINIMUM_SUPPORTED_GO_MINOR_VERSION) ] ; then \
		echo '$(GO_VERSION_VALIDATION_ERR_MSG)';\
		exit 1; \
	fi

build-templates: ## Compile all mjml email templates
	cd $(TEMPLATES_DIR) && $(MAKE) build

run-server: setup-go-work prepackaged-binaries validate-go-version start-docker ## Starts the server.
	@echo Running mattermost for development

	mkdir -p $(BUILD_WEBAPP_DIR)/dist/files
	$(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' $(PLATFORM_FILES) $(RUN_IN_BACKGROUND)

debug-server: start-docker ## Compile and start server using delve.
	mkdir -p $(BUILD_WEBAPP_DIR)/dist/files
	$(DELVE) debug $(PLATFORM_FILES) --build-flags="-ldflags '\
		-X github.com/mattermost/mattermost-server/v6/model.BuildNumber=$(BUILD_NUMBER)\
		-X \"github.com/mattermost/mattermost-server/v6/model.BuildDate=$(BUILD_DATE)\"\
		-X github.com/mattermost/mattermost-server/v6/model.BuildHash=$(BUILD_HASH)\
		-X github.com/mattermost/mattermost-server/v6/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
		-X github.com/mattermost/mattermost-server/v6/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)'"

debug-server-headless: start-docker ## Debug server from within an IDE like VSCode or IntelliJ.
	mkdir -p $(BUILD_WEBAPP_DIR)/dist/files
	$(DELVE) debug --headless --listen=:2345 --api-version=2 --accept-multiclient $(PLATFORM_FILES) --build-flags="-ldflags '\
		-X github.com/mattermost/mattermost-server/v6/model.BuildNumber=$(BUILD_NUMBER)\
		-X \"github.com/mattermost/mattermost-server/v6/model.BuildDate=$(BUILD_DATE)\"\
		-X github.com/mattermost/mattermost-server/v6/model.BuildHash=$(BUILD_HASH)\
		-X github.com/mattermost/mattermost-server/v6/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
		-X github.com/mattermost/mattermost-server/v6/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)'"

run-cli: start-docker ## Runs CLI.
	@echo Running mattermost for development
	@echo Example should be like 'make ARGS="-version" run-cli'

	$(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' $(PLATFORM_FILES) ${ARGS}

run-client: ## Runs the webapp.
	@echo Running mattermost client for development

	ln -nfs $(BUILD_WEBAPP_DIR)/dist client
	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

run-client-fullmap: ## Legacy alias to run-client
	@echo Running mattermost client for development

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

run: check-prereqs run-server run-client ## Runs the server and webapp.

run-fullmap: run-server run-client ## Legacy alias to run

stop-server: ## Stops the server.
	@echo Stopping mattermost

ifeq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
	wmic process where "Caption='go.exe' and CommandLine like '%go.exe run%'" call terminate
	wmic process where "Caption='mattermost.exe' and CommandLine like '%go-build%'" call terminate
else
	@for PID in $$(ps -ef | grep "[g]o run" | grep "mattermost" | awk '{ print $$2 }'); do \
		echo stopping go $$PID; \
		kill $$PID; \
	done
	@for PID in $$(ps -ef | grep "[g]o-build" | grep "mattermost" | awk '{ print $$2 }'); do \
		echo stopping mattermost $$PID; \
		kill $$PID; \
	done
endif

stop-client: ## Stops the webapp.
	@echo Stopping mattermost client

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) stop

stop: stop-server stop-client stop-docker ## Stops server, client and the docker compose.

restart: restart-server restart-client ## Restarts the server and webapp.

restart-server: | stop-server run-server ## Restarts the mattermost server to pick up development change.

restart-haserver:
	@echo Restarting mattermost in an HA topology

	docker-compose restart follower2
	docker-compose restart follower
	docker-compose restart leader
	docker-compose restart haproxy

restart-client: | stop-client run-client ## Restarts the webapp.

run-job-server: ## Runs the background job server.
	@echo Running job server for development
	$(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' $(PLATFORM_FILES) jobserver &

config-ldap: ## Configures LDAP.
	@echo Setting up configuration for local LDAP

	@sed -i'' -e 's|"LdapServer": ".*"|"LdapServer": "localhost"|g' config/config.json
	@sed -i'' -e 's|"BaseDN": ".*"|"BaseDN": "dc=mm,dc=test,dc=com"|g' config/config.json
	@sed -i'' -e 's|"BindUsername": ".*"|"BindUsername": "cn=admin,dc=mm,dc=test,dc=com"|g' config/config.json
	@sed -i'' -e 's|"BindPassword": ".*"|"BindPassword": "mostest"|g' config/config.json
	@sed -i'' -e 's|"FirstNameAttribute": ".*"|"FirstNameAttribute": "cn"|g' config/config.json
	@sed -i'' -e 's|"LastNameAttribute": ".*"|"LastNameAttribute": "sn"|g' config/config.json
	@sed -i'' -e 's|"NicknameAttribute": ".*"|"NicknameAttribute": "cn"|g' config/config.json
	@sed -i'' -e 's|"EmailAttribute": ".*"|"EmailAttribute": "mail"|g' config/config.json
	@sed -i'' -e 's|"UsernameAttribute": ".*"|"UsernameAttribute": "uid"|g' config/config.json
	@sed -i'' -e 's|"IdAttribute": ".*"|"IdAttribute": "uid"|g' config/config.json
	@sed -i'' -e 's|"LoginIdAttribute": ".*"|"LoginIdAttribute": "uid"|g' config/config.json
	@sed -i'' -e 's|"GroupDisplayNameAttribute": ".*"|"GroupDisplayNameAttribute": "cn"|g' config/config.json
	@sed -i'' -e 's|"GroupIdAttribute": ".*"|"GroupIdAttribute": "entryUUID"|g' config/config.json

config-reset: ## Resets the config/config.json file to the default.
	@echo Resetting configuration to default
	rm -f config/config.json
	OUTPUT_CONFIG=$(PWD)/config/config.json $(GO) $(GOFLAGS) run ./scripts/config_generator

diff-config: ## Compares default configuration between two mattermost versions
	@./scripts/diff-config.sh

clean: stop-docker ## Clean up everything except persistent server data.
	@echo Cleaning

	rm -Rf $(DIST_ROOT)
	$(GO) clean $(GOFLAGS) -i ./...

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) clean

	find . -type d -name data | xargs rm -rf
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
	rm -f cmd/mattermost/cprofile*.out

nuke: clean clean-docker ## Clean plus removes persistent server data.
	@echo BOOM

	rm -rf data
	rm -f go.work go.work.sum

setup-mac: ## Adds macOS hosts entries for Docker.
	echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts

update-dependencies: ## Uses go get -u to update all the dependencies while holding back any that require it.
	@echo Updating Dependencies

ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Enterprise repository detected, temporarily removing imports.go
	rm -f imports/imports.go
endif

ifeq ($(BUILD_BOARDS),true)
	@echo Boards repository detected, temporarily removing boards_imports.go
	rm -f imports/boards_imports.go
endif

	# Update all dependencies (does not update across major versions)
	$(GO) get -u ./...

	# Tidy up
	$(GO) mod tidy

ifeq ($(BUILD_ENTERPRISE_READY),true)
	cp $(BUILD_ENTERPRISE_DIR)/imports/imports.go imports/
endif

ifeq ($(BUILD_BOARDS),true)
	cp $(BUILD_BOARDS_DIR)/mattermost-plugin/product/imports/boards_imports.go imports/
endif

vet: ## Run mattermost go vet specific checks
	$(GO) install github.com/mattermost/mattermost-govet/v2@new
	@VET_CMD="-license -structuredLogging -inconsistentReceiverName -inconsistentReceiverName.ignore=session_serial_gen.go,team_member_serial_gen.go,user_serial_gen.go -emptyStrCmp -tFatal -configtelemetry -errorAssertions"; \
	if ! [ -z "${MM_VET_OPENSPEC_PATH}" ] && [ -f "${MM_VET_OPENSPEC_PATH}" ]; then \
		VET_CMD="$$VET_CMD -openApiSync -openApiSync.spec=$$MM_VET_OPENSPEC_PATH"; \
	else \
		echo "MM_VET_OPENSPEC_PATH not set or spec yaml path in it is incorrect. Skipping API check"; \
	fi; \
	$(GO) vet -vettool=$(GOBIN)/mattermost-govet $$VET_CMD ./...
ifeq ($(BUILD_ENTERPRISE_READY),true)
  ifneq ($(MM_NO_ENTERPRISE_LINT),true)
	$(GO) vet -vettool=$(GOBIN)/mattermost-govet -enterpriseLicense -structuredLogging -tFatal ../enterprise/...
  endif
endif

gen-serialized:	export LICENSE_HEADER:=$(LICENSE_HEADER)
gen-serialized: ## Generates serialization methods for hot structs
	# This tool only works at a file level, not at a package level.
	# There will be some warnings about "unresolved identifiers",
	# but that is because of the above problem. Since we are generating
	# methods for all the relevant files at a package level, all
	# identifiers will be resolved. An alternative to remove the warnings
	# would be to temporarily move all the structs to the same file,
	# but that involves a lot of manual work.
	$(GO) install github.com/tinylib/msgp@v1.1.6
	$(GOBIN)/msgp -file=./model/session.go -tests=false -o=./model/session_serial_gen.go
	@echo "$$LICENSE_HEADER" > tmp.go
	@cat ./model/session_serial_gen.go >> tmp.go
	@mv tmp.go ./model/session_serial_gen.go
	$(GOBIN)/msgp -file=./model/user.go -tests=false -o=./model/user_serial_gen.go
	@echo "$$LICENSE_HEADER" > tmp.go
	@cat ./model/user_serial_gen.go >> tmp.go
	@mv tmp.go ./model/user_serial_gen.go
	$(GOBIN)/msgp -file=./model/team_member.go -tests=false -o=./model/team_member_serial_gen.go
	@echo "$$LICENSE_HEADER" > tmp.go
	@cat ./model/team_member_serial_gen.go >> tmp.go
	@mv tmp.go ./model/team_member_serial_gen.go

todo: ## Display TODO and FIXME items in the source code.
	@! ag --ignore Makefile --ignore-dir runtime '(TODO|XXX|FIXME|"FIX ME")[: ]+'
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@! ag --ignore Makefile --ignore-dir runtime '(TODO|XXX|FIXME|"FIX ME")[: ]+' enterprise/
endif

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo You can modify the default settings for this Makefile creating a file config.mk based on the default-config.mk
	@echo

migrations-extract:
	@echo Listing migration files
	@echo "# Autogenerated file to synchronize migrations sequence in the PR workflow, please do not edit.\n#" > db/migrations/migrations.list
	find db/migrations -maxdepth 2 -mindepth 2 | sort >> db/migrations/migrations.list
