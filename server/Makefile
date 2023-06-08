.PHONY: build package run stop run-client run-server run-haserver stop-haserver stop-client stop-server restart restart-server restart-client restart-haserver start-docker update-docker clean-dist clean nuke check-style check-client-style check-server-style check-unit-tests test dist run-client-tests setup-run-client-tests cleanup-run-client-tests test-client build-linux build-osx build-windows package-prep package-linux package-osx package-windows internal-test-web-client vet run-server-for-web-client-tests diff-config prepackaged-plugins prepackaged-binaries test-server test-server-ee test-server-quick test-server-race test-mmctl-unit test-mmctl-e2e test-mmctl test-mmctl-coverage mmctl-build mmctl-docs new-migration migrations-extract

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

# treestate
GIT_TREESTATE = clean
DIFF = $(shell git diff --quiet >/dev/null 2>&1; if [ $$? -eq 1 ]; then echo "1"; fi)
ifeq ($(DIFF), 1)
    GIT_TREESTATE = dirty
endif

# Docker
export COMPOSE_PROJECT_NAME=mattermost-server

# If we don't set the build number it defaults to dev
ifeq ($(BUILD_NUMBER),)
	BUILD_DATE := n/a
	BUILD_NUMBER := dev
endif

ifeq ($(BUILD_NUMBER),dev)
	export MM_FEATUREFLAGS_GRAPHQL = true
endif

# Ensure developer invocation and tests are anchored.
MM_SERVER_PATH ?= $(ROOT)

# Go test sum configuration
GOTESTSUM_FORMAT ?= testname
GOTESTSUM_JUNITFILE ?= report.xml
GOTESTSUM_JSONFILE ?= gotestsum.json

# mmctl
MMCTL_BUILD_TAGS =
MMCTL_TESTFLAGS = -timeout 30m -race -v
MMCTL_PKG = github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/commands
LDFLAGS += -X "$(MMCTL_PKG).gitCommit=$(BUILD_HASH)"
LDFLAGS += -X "$(MMCTL_PKG).gitTreeState=$(GIT_TREESTATE)"
LDFLAGS += -X "$(MMCTL_PKG).buildDate=$(BUILD_DATE)"

# Enterprise
BUILD_ENTERPRISE_DIR ?= ../../enterprise
BUILD_ENTERPRISE ?= true
BUILD_ENTERPRISE_READY = false
BUILD_TYPE_NAME = team
BUILD_HASH_ENTERPRISE = none
ifneq ($(wildcard $(BUILD_ENTERPRISE_DIR)/.),)
	MMCTL_TESTFLAGS += -ldflags '-X "$(MMCTL_PKG).EnableEnterpriseTests=true" -X "github.com/mattermost/mattermost-server/server/public/model.BuildEnterpriseReady=true"'
	MMCTL_BUILD_TAGS += enterprise

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
BUILD_WEBAPP_DIR ?= ../webapp
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
LDFLAGS += -X "github.com/mattermost/mattermost-server/server/public/model.BuildNumber=$(BUILD_NUMBER)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/server/public/model.BuildDate=$(BUILD_DATE)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/server/public/model.BuildHash=$(BUILD_HASH)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/server/public/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)"
LDFLAGS += -X "github.com/mattermost/mattermost-server/server/public/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)"

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

# Packages lists
TE_PACKAGES=$(shell $(GO) list ./... | grep -vE 'server/v8/playbooks|server/v8/boards|server/v8/cmd/mmctl')
BOARDS_PACKAGES=$(shell $(GO) list ./... | grep -E 'server/v8/boards')
PLAYBOOKS_PACKAGES=$(shell $(GO) list ./... | grep -E 'server/v8/playbooks')
SUITE_PACKAGES=$(shell $(GO) list ./...| grep -vE 'server/v8/cmd/mmctl')
MMCTL_PACKAGES=$(shell $(GO) list ./... | grep -E 'server/v8/cmd/mmctl')

TEMPLATES_DIR=templates

# Plugins Packages
PLUGIN_PACKAGES ?= mattermost-plugin-antivirus-v0.1.2
PLUGIN_PACKAGES += mattermost-plugin-autolink-v1.4.0
PLUGIN_PACKAGES += mattermost-plugin-aws-SNS-v1.2.0
PLUGIN_PACKAGES += mattermost-plugin-calls-v0.16.1
PLUGIN_PACKAGES += mattermost-plugin-channel-export-v1.0.0
PLUGIN_PACKAGES += mattermost-plugin-confluence-v1.3.0
PLUGIN_PACKAGES += mattermost-plugin-custom-attributes-v1.3.1
PLUGIN_PACKAGES += mattermost-plugin-github-v2.1.6
PLUGIN_PACKAGES += mattermost-plugin-gitlab-v1.6.0
PLUGIN_PACKAGES += mattermost-plugin-jenkins-v1.1.0
PLUGIN_PACKAGES += mattermost-plugin-jira-v3.2.5
PLUGIN_PACKAGES += mattermost-plugin-jitsi-v2.0.1
PLUGIN_PACKAGES += mattermost-plugin-nps-v1.3.1
PLUGIN_PACKAGES += mattermost-plugin-todo-v0.6.1
PLUGIN_PACKAGES += mattermost-plugin-welcomebot-v1.3.0
PLUGIN_PACKAGES += mattermost-plugin-zoom-v1.6.0
PLUGIN_PACKAGES += mattermost-plugin-apps-v1.2.1

# Prepares the enterprise build if exists. The IGNORE stuff is a hack to get the Makefile to execute the commands outside a target
ifeq ($(BUILD_ENTERPRISE_READY),true)
	IGNORE:=$(shell echo Enterprise build selected, preparing)
	IGNORE:=$(shell rm -f channels/imports/imports.go)
	IGNORE:=$(shell cp $(BUILD_ENTERPRISE_DIR)/imports/imports.go channels/imports/)
	IGNORE:=$(shell rm -f enterprise)
else
	IGNORE:=$(shell rm -f channels/imports/imports.go)
endif

EE_PACKAGES=$(shell $(GO) list $(BUILD_ENTERPRISE_DIR)/...)

ifeq ($(BUILD_ENTERPRISE_READY),true)
  ALL_PACKAGES=$(TE_PACKAGES) $(BOARDS_PACKAGES) $(PLAYBOOKS_PACKAGES) $(EE_PACKAGES)
else
  ALL_PACKAGES=$(TE_PACKAGES) $(BOARDS_PACKAGES) $(PLAYBOOKS_PACKAGES)
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

LDFLAGS += -X "github.com/mattermost/mattermost-server/server/public/model.MockCWS=$(MM_ENABLE_CWS_MOCK)"

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

update-docker: stop-docker ## Updates the docker containers for local development.
	@echo Updating docker containers

	$(GO) run ./build/docker-compose-generator/main.go $(ENABLED_DOCKER_SERVICES) | docker-compose -f docker-compose.makefile.yml -f /dev/stdin $(DOCKER_COMPOSE_OVERRIDE) up --no-start

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
	$(GO) run $(GOFLAGS) ./public/plugin/checker

prepackaged-plugins: ## Populate the prepackaged-plugins directory
	@echo Downloading prepackaged plugins
	mkdir -p prepackaged_plugins
	@cd prepackaged_plugins && for plugin_package in $(PLUGIN_PACKAGES) ; do \
		curl -f -O -L https://plugins-store.test.mattermost.com/release/$$plugin_package.tar.gz; \
		curl -f -O -L https://plugins-store.test.mattermost.com/release/$$plugin_package.tar.gz.sig; \
	done

prepackaged-binaries: ## Populate the prepackaged-binaries to the bin directory
ifeq ($(shell test -f bin/mmctl && printf "yes"),yes)
	@echo "MMCTL already exists in bin/mmctl, not compiling."
else
	$(MAKE) mmctl-build
endif

golangci-lint: ## Run golangci-lint on codebase
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.52.2

	@echo Running golangci-lint
	$(GOBIN)/golangci-lint run ./...
	$(GOBIN)/golangci-lint run ./public/...
ifeq ($(BUILD_ENTERPRISE_READY),true)
  ifneq ($(MM_NO_ENTERPRISE_LINT),true)
		$(GOBIN)/golangci-lint run $(BUILD_ENTERPRISE_DIR)/...
  endif
endif

app-layers: ## Extract interface from App struct
	$(GO) install github.com/reflog/struct2interface@v0.6.1
	$(GOBIN)/struct2interface -f "channels/app" -o "channels/app/app_iface.go" -p "app" -s "App" -i "AppIface" -t ./channels/app/layer_generators/app_iface.go.tmpl
	$(GO) run ./channels/app/layer_generators -in ./channels/app/app_iface.go -out ./channels/app/opentracing/opentracing_layer.go -template ./channels/app/layer_generators/opentracing_layer.go.tmpl

boards-gen: ## Run generators for Boards
	$(GO) install github.com/golang/mock/mockgen@v1.6.0
	cd boards && $(GO) generate ./...

i18n-extract: ## Extract strings for translation from the source code
	$(GO) install github.com/mattermost/mattermost-utilities/mmgotool@mono-repo
	$(GOBIN)/mmgotool i18n extract --portal-dir=""

i18n-check: ## Exit on empty translation strings and translation source strings
	$(GO) install github.com/mattermost/mattermost-utilities/mmgotool@mono-repo
	$(GOBIN)/mmgotool i18n clean-empty --portal-dir="" --check
	$(GOBIN)/mmgotool i18n check-empty-src --portal-dir=""

store-mocks: ## Creates mock files.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir channels/store --name ".*Store" --output channels/store/storetest/mocks --note 'Regenerate this file using `make store-mocks`.'

telemetry-mocks: ## Creates mock files.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir platform/services/telemetry --all --output platform/services/telemetry/mocks --note 'Regenerate this file using `make telemetry-mocks`.'

store-layers: ## Generate layers for the store
	$(GO) generate $(GOFLAGS) ./channels/store

new-migration: ## Creates a new migration. Run with make new-migration name=<>
	$(GO) install github.com/mattermost/morph/cmd/morph@master
	@echo "Generating new migration for mysql"
	$(GOBIN)/morph generate $(name) --driver mysql --dir channels/db/migrations --sequence

	@echo "Generating new migration for postgres"
	$(GOBIN)/morph generate $(name) --driver postgres --dir channels/db/migrations --sequence

filestore-mocks: ## Creates mock files.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir platform/shared/filestore --all --output platform/shared/filestore/mocks --note 'Regenerate this file using `make filestore-mocks`.'

ldap-mocks: ## Creates mock files for ldap.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir $(BUILD_ENTERPRISE_DIR)/ldap --all --output $(BUILD_ENTERPRISE_DIR)/ldap/mocks --note 'Regenerate this file using `make ldap-mocks`.'

plugin-mocks: ## Creates mock files for plugins.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir ./public/plugin --name API --output ./public/plugin/plugintest --outpkg plugintest --case underscore --note 'Regenerate this file using `make plugin-mocks`.'
	$(GOBIN)/mockery --dir ./public/plugin --name Hooks --output ./public/plugin/plugintest --outpkg plugintest --case underscore --note 'Regenerate this file using `make plugin-mocks`.'
	$(GOBIN)/mockery --dir ./public/plugin --name Driver --output ./public/plugin/plugintest --outpkg plugintest --case underscore --note 'Regenerate this file using `make plugin-mocks`.'

einterfaces-mocks: ## Creates mock files for einterfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir channels/einterfaces --all --output channels/einterfaces/mocks --note 'Regenerate this file using `make einterfaces-mocks`.'

searchengine-mocks: ## Creates mock files for searchengines.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir platform/services/searchengine --all --output platform/services/searchengine/mocks --note 'Regenerate this file using `make searchengine-mocks`.'

sharedchannel-mocks: ## Creates mock files for shared channels.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir=./platform/services/sharedchannel --name=ServerIface --output=./platform/services/sharedchannel --inpackage --outpkg=sharedchannel --testonly --note 'Regenerate this file using `make sharedchannel-mocks`.'
	$(GOBIN)/mockery --dir=./platform/services/sharedchannel --name=AppIface --output=./platform/services/sharedchannel --inpackage --outpkg=sharedchannel --testonly --note 'Regenerate this file using `make sharedchannel-mocks`.'

misc-mocks: ## Creates mocks for misc interfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir channels/utils --name LicenseValidatorIface --output channels/utils/mocks --note 'Regenerate this file using `make misc-mocks`.'

email-mocks: ## Creates mocks for misc interfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.23.2
	$(GOBIN)/mockery --dir channels/app/email --name ServiceInterface --output channels/app/email/mocks --note 'Regenerate this file using `make email-mocks`.'

platform-mocks: ## Creates mocks for platform interfaces.
	$(GO) install github.com/vektra/mockery/v2/...@v2.14.0
	$(GOBIN)/mockery --dir channels/app/platform --name SuiteIFace --output channels/app/platform/mocks --note 'Regenerate this file using `make platform-mocks`.'

mmctl-mocks: ## Creates mocks for mmctl
	$(GO) install github.com/golang/mock/mockgen@v1.6.0
	$(GOBIN)/mockgen -destination=cmd/mmctl/mocks/client_mock.go -copyright_file=cmd/mmctl/mocks/copyright.txt -package=mocks github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client Client

pluginapi: ## Generates api and hooks glue code for plugins
	$(GO) generate $(GOFLAGS) ./public/plugin

mocks: store-mocks telemetry-mocks filestore-mocks ldap-mocks plugin-mocks einterfaces-mocks searchengine-mocks sharedchannel-mocks misc-mocks email-mocks platform-mocks mmctl-mocks

layers: app-layers store-layers pluginapi boards-gen

generated: mocks layers

check-prereqs: ## Checks prerequisite software status.
	./scripts/prereq-check.sh

check-prereqs-enterprise: setup-go-work ## Checks prerequisite software status for enterprise.
ifeq ($(BUILD_ENTERPRISE_READY),true)
	./scripts/prereq-check-enterprise.sh
endif

setup-go-work: export BUILD_ENTERPRISE_READY := $(BUILD_ENTERPRISE_READY)
setup-go-work: ## Sets up your go.work file
ifneq ($(IGNORE_GO_WORK_IF_EXISTS),true)
	@echo "Creating a go.work file"
	rm -f go.work
	go work init
	go work use .
	go work use ./public
ifeq ($(BUILD_ENTERPRISE_READY),true)
	go work use ../../enterprise
endif
endif

check-style: plugin-checker vet golangci-lint ## Runs style/lint checks


gotestsum:
	$(GO) install gotest.tools/gotestsum@v1.7.0

test-compile: gotestsum ## Compile tests.
	@echo COMPILE TESTS

	for package in $(SUITE_PACKAGES) $(EE_PACKAGES); do \
		$(GO) test $(GOFLAGS) -c $$package; \
	done

modules-tidy:
	@if [ -f "channels/imports/imports.go" ]; then \
		mv channels/imports/imports.go channels/imports/imports.go.orig; \
	fi;
	-$(GO) mod tidy
	-cd public && $(GO) mod tidy
	@if [ -f "channels/imports/imports.go.orig" ]; then \
		mv channels/imports/imports.go.orig channels/imports/imports.go; \
	fi;

test-server-pre: check-prereqs-enterprise start-docker gotestsum ## Runs tests.
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Running all tests
else
	@echo Running only TE tests
endif

test-server-race: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-server-race: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-race: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-race: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-race: test-server-pre
	$(GOBIN)/gotestsum --packages="$(TE_PACKAGES) $(EE_PACKAGES)" -- "-race $(GOFLAGS)" -timeout=90m
	$(GOBIN)/gotestsum --packages="$(BOARDS_PACKAGES)" -- "-race $(GOFLAGS)" -timeout=90m
	$(GOBIN)/gotestsum --packages="$(PLAYBOOKS_PACKAGES)" -- "-race $(GOFLAGS)" -timeout=90m

ifneq ($(IS_CI),true)
  ifneq ($(MM_NO_DOCKER),true)
    ifneq ($(TEMP_DOCKER_SERVICES),)
	  @echo Stopping temporary docker services
	  docker-compose stop $(TEMP_DOCKER_SERVICES)
    endif
  endif
endif

test-server: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-server: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server: test-server-pre
	$(GOBIN)/gotestsum --packages="$(SUITE_PACKAGES) $(EE_PACKAGES)" -- $(GOFLAGS) -timeout=90m
ifneq ($(IS_CI),true)
  ifneq ($(MM_NO_DOCKER),true)
    ifneq ($(TEMP_DOCKER_SERVICES),)
	  @echo Stopping temporary docker services
	  docker-compose stop $(TEMP_DOCKER_SERVICES)
    endif
  endif
endif

test-server-ee: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-server-ee: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-ee: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-ee: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-ee: check-prereqs-enterprise start-docker gotestsum ## Runs EE tests.
	@echo Running only EE tests
	$(GOBIN)/gotestsum --packages="$(EE_PACKAGES)" -- $(GOFLAGS) -timeout=20m

test-server-quick: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-server-quick: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-quick: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-quick: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-quick: check-prereqs-enterprise ## Runs only quick tests.
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@echo Running all tests
	$(GOBIN)/gotestsum --packages="$(SUITE_PACKAGES) $(EE_PACKAGES)" -- $(GOFLAGS) -short
else
	@echo Running only TE tests
	$(GOBIN)/gotestsum --packages="$(SUITE_PACKAGES)" -- $(GOFLAGS) -short
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

test-mmctl-unit: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-mmctl-unit: test-mmctl-pre
	@echo Running mmctl unit tests
	$(GO) test $(MMCTL_TESTFLAGS) -tags 'unit $(MMCTL_BUILD_TAGS)' $(MMCTL_PACKAGES)

test-mmctl-e2e: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-mmctl-e2e: start-docker
	@echo Running mmctl e2e tests
	$(GO) test $(MMCTL_TESTFLAGS) -tags 'e2e $(MMCTL_BUILD_TAGS)' $(MMCTL_PACKAGES)

test-mmctl: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-mmctl: start-docker
	@echo Running all mmctl tests
	$(GO) test $(MMCTL_TESTFLAGS) -tags 'unit e2e $(MMCTL_BUILD_TAGS)' $(MMCTL_PACKAGES)

test-mmctl-coverage: export MM_SERVER_PATH := $(MM_SERVER_PATH)
test-mmctl-coverage: start-docker
	@echo Running all mmctl tests with coverage
	$(GO) test $(MMCTL_TESTFLAGS) -tags 'unit e2e $(MMCTL_BUILD_TAGS)' -coverprofile=mmctlcover.out $(MMCTL_PACKAGES)
	$(GO) tool cover -html=mmctlcover.out

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

run-server: setup-go-work prepackaged-binaries validate-go-version start-docker client ## Starts the server.
	@echo Running mattermost for development

	mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files
	$(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' $(PLATFORM_FILES) $(RUN_IN_BACKGROUND)

debug-server: start-docker ## Compile and start server using delve.
	mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files
	$(DELVE) debug $(PLATFORM_FILES) --build-flags="-ldflags '\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildNumber=$(BUILD_NUMBER)\
		-X \"github.com/mattermost/mattermost-server/server/public/model.BuildDate=$(BUILD_DATE)\"\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildHash=$(BUILD_HASH)\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)'"

debug-server-headless: start-docker ## Debug server from within an IDE like VSCode or IntelliJ.
	mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files
	$(DELVE) debug --headless --listen=:2345 --api-version=2 --accept-multiclient $(PLATFORM_FILES) --build-flags="-ldflags '\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildNumber=$(BUILD_NUMBER)\
		-X \"github.com/mattermost/mattermost-server/server/public/model.BuildDate=$(BUILD_DATE)\"\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildHash=$(BUILD_HASH)\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
		-X github.com/mattermost/mattermost-server/server/public/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)'"

run-cli: start-docker ## Runs CLI.
	@echo Running mattermost for development
	@echo Example should be like 'make ARGS="-version" run-cli'

	$(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' $(PLATFORM_FILES) ${ARGS}

run-client: client ## Runs the webapp.
	@echo Running mattermost client for development

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

client: ## Sets up a symlink to the compiled files generated by the web app
	@echo Setting up symlink to client directory
	ln -nfs $(BUILD_WEBAPP_DIR)/channels/dist client

run-client-fullmap: client ## Legacy alias to run-client
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
	rm -f channels/imports/imports.go
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
	rm -f channels/imports/imports.go
endif

	# Update all dependencies (does not update across major versions)
	$(GO) get -u ./...

	# Tidy up
	$(GO) mod tidy

ifeq ($(BUILD_ENTERPRISE_READY),true)
	cp $(BUILD_ENTERPRISE_DIR)/imports/imports.go channels/imports/
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
	$(GO) vet -vettool=$(GOBIN)/mattermost-govet -enterpriseLicense -structuredLogging -tFatal $(BUILD_ENTERPRISE_DIR)/...
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
	$(GOBIN)/msgp -file=./public/model/session.go -tests=false -o=./public/model/session_serial_gen.go
	@echo "$$LICENSE_HEADER" > tmp.go
	@cat ./public/model/session_serial_gen.go >> tmp.go
	@mv tmp.go ./public/model/session_serial_gen.go
	$(GOBIN)/msgp -file=./public/model/user.go -tests=false -o=./public/model/user_serial_gen.go
	@echo "$$LICENSE_HEADER" > tmp.go
	@cat ./public/model/user_serial_gen.go >> tmp.go
	@mv tmp.go ./public/model/user_serial_gen.go
	$(GOBIN)/msgp -file=./public/model/team_member.go -tests=false -o=./public/model/team_member_serial_gen.go
	@echo "$$LICENSE_HEADER" > tmp.go
	@cat ./public/model/team_member_serial_gen.go >> tmp.go
	@mv tmp.go ./public/model/team_member_serial_gen.go

todo: ## Display TODO and FIXME items in the source code.
	@! ag --ignore Makefile --ignore-dir runtime '(TODO|XXX|FIXME|"FIX ME")[: ]+'
ifeq ($(BUILD_ENTERPRISE_READY),true)
	@! ag --ignore Makefile --ignore-dir runtime '(TODO|XXX|FIXME|"FIX ME")[: ]+' $(BUILD_ENTERPRISE_DIR)/
endif

mmctl-build: ## Compiles and generates the mmctl binary
	go build -trimpath -ldflags '$(LDFLAGS)' -o $(GOBIN) ./cmd/mmctl

mmctl-docs: ## Generate the mmctl docs
	rm -rf ./cmd/mmctl/docs
	cd ./cmd/mmctl && go run mmctl.go docs

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo You can modify the default settings for this Makefile creating a file config.mk based on the default-config.mk
	@echo

migrations-extract:
	@echo Listing migration files
	@echo "# Autogenerated file to synchronize migrations sequence in the PR workflow, please do not edit.\n#" > channels/db/migrations/migrations.list
	find channels/db/migrations -maxdepth 2 -mindepth 2 | sort >> channels/db/migrations/migrations.list
