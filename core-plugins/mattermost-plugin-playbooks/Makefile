GO ?= $(shell command -v go 2> /dev/null)
GOFLAGS ?= $(GOFLAGS:)
NPM ?= $(shell command -v npm 2> /dev/null)
CURL ?= $(shell command -v curl 2> /dev/null)
MM_DEBUG ?=
GOPATH ?= $(shell go env GOPATH)
GO_TEST_FLAGS ?= -race
GO_BUILD_FLAGS ?=
MM_UTILITIES_DIR ?= ../mattermost-utilities
DLV_DEBUG_PORT := 2346
DEFAULT_GOOS ?= $(shell go env GOOS)
DEFAULT_GOARCH ?= $(shell go env GOARCH)

export GO111MODULE=on

# We need to export GOBIN to allow it to be set
# for processes spawned from the Makefile
export GOBIN ?= $(PWD)/bin

# You can include assets this directory into the bundle. This can be e.g. used to include profile pictures.
ASSETS_DIR ?= assets

## Define the default target (make all)
.PHONY: default
default: all

# Verify environment, and define PLUGIN_ID, PLUGIN_VERSION, HAS_SERVER and HAS_WEBAPP as needed.
include build/setup.mk

BUNDLE_NAME ?= $(PLUGIN_ID)-$(PLUGIN_VERSION).tar.gz

# Include custom makefile, if present
ifneq ($(wildcard build/custom.mk),)
	include build/custom.mk
endif

ifneq ($(MM_DEBUG),)
	GO_BUILD_GCFLAGS = -gcflags "all=-N -l"
else
	GO_BUILD_GCFLAGS =
endif

# ====================================================================================
# Semver release tagging
# Usage: make tag-release [bump-type] [DRY_RUN=1] [FORCE=1] [VERSION=X.Y.Z] [RELEASE_ARGS="..."]
# Examples:
#   make tag-release                    # Interactive mode
#   make tag-release patch              # Bump patch version
#   make tag-release minor-rc           # Start minor RC cycle
#   make tag-release rc-finalize        # Finalize RC to stable
#   DRY_RUN=1 make tag-release patch    # Dry run
#   FORCE=1 make tag-release patch      # Force (skip validation errors)
#   VERSION=2.6.2 make tag-release      # Explicit version
#   make tag-release RELEASE_ARGS="--version=2.6.2"  # Explicit version (alternative)
TAG_RELEASE_BUMP := $(word 2,$(MAKECMDGOALS))
ifneq ($(filter tag-release,$(MAKECMDGOALS)),)
  ifneq ($(TAG_RELEASE_BUMP),)
    $(eval $(TAG_RELEASE_BUMP):;@:)
  endif
endif
RELEASE_ARGS ?=
RELEASE_FLAGS := $(RELEASE_ARGS)
ifneq ($(DRY_RUN),)
  RELEASE_FLAGS += --dry-run
endif
ifneq ($(FORCE),)
  RELEASE_FLAGS += --force
endif
ifneq ($(VERSION),)
  RELEASE_FLAGS += --version=$(VERSION)
endif
# ====================================================================================

.PHONY: tag-release
## Tag a semver release interactively or with bump type (DRY_RUN=1, FORCE=1)
tag-release:
	./build/bin/release $(TAG_RELEASE_BUMP) $(RELEASE_FLAGS)

## Checks the code style, tests, builds and bundles the plugin.
.PHONY: all
all: check-style test dist

## Ensures the plugin manifest is valid
.PHONY: manifest-check
manifest-check:
	./build/bin/manifest check

## Propagates plugin manifest information into the server/ and webapp/ folders.
.PHONY: apply
apply:
	./build/bin/manifest apply

## Install go tools
install-go-tools:
	@echo Installing go tools
	$(GO) install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.1.6
	$(GO) install github.com/golang/mock/mockgen@v1.6.0
	$(GO) install gotest.tools/gotestsum@v1.7.0
	$(GO) install github.com/cortesi/modd/cmd/modd@latest
	$(GO) install github.com/mattermost/mattermost-govet/v2@3f08281c344327ac09364f196b15f9a81c7eff08

## Runs eslint and golangci-lint
.PHONY: check-style
check-style: manifest-check apply webapp/node_modules e2e-tests/node_modules install-go-tools
	@echo Checking for style guide compliance

ifneq ($(HAS_WEBAPP),)
	cd webapp && npm run lint
	cd webapp && npm run check-types
endif

	cd e2e-tests && npm run check

# It's highly recommended to run go-vet first
# to find potential compile errors that could introduce
# weird reports at golangci-lint step
ifneq ($(HAS_SERVER),)
	@echo Running golangci-lint
	$(GO) vet ./...
	$(GOBIN)/golangci-lint run ./...
	$(GO) vet -vettool=$(GOBIN)/mattermost-govet -license -license.year=2020 -license.ignore=server/graphql/models.go ./...
endif

## Fix JS file ESLint issues
.PHONY: fix-style
fix-style: apply webapp/node_modules e2e-tests/node_modules
	@echo Fixing lint issues to follow style guide

ifneq ($(HAS_WEBAPP),)
	cd webapp && npm run fix
endif
	cd e2e-tests && npm run fix


## Builds the server, if it exists, for all supported architectures, unless MM_SERVICESETTINGS_ENABLEDEVELOPER is set
.PHONY: server
server:
ifneq ($(HAS_SERVER),)
ifneq ($(MM_DEBUG),)
	$(info DEBUG mode is on; to disable, unset MM_DEBUG)
endif
	mkdir -p server/dist;
ifneq ($(MM_SERVICESETTINGS_ENABLEDEVELOPER),)
	@echo Building plugin only for $(DEFAULT_GOOS)-$(DEFAULT_GOARCH) because MM_SERVICESETTINGS_ENABLEDEVELOPER is enabled
	cd server && env GOOS=$(DEFAULT_GOOS) GOARCH=$(DEFAULT_GOARCH) $(GO) build $(GO_BUILD_FLAGS) $(GO_BUILD_GCFLAGS) -trimpath -o dist/plugin-$(DEFAULT_GOOS)-$(DEFAULT_GOARCH);

ifneq ($(MM_DEBUG),)
	cd server && ./dist/plugin-$(DEFAULT_GOOS)-$(DEFAULT_GOARCH) graphqlcheck
endif
else
	cd server && env GOOS=linux GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) $(GO_BUILD_GCFLAGS) -trimpath -o dist/plugin-linux-amd64;
ifeq ($(FIPS_ENABLED),true)
	@echo Only building linux-amd64 for FIPS
else
	cd server && env GOOS=linux GOARCH=arm64 $(GO) build $(GO_BUILD_FLAGS) $(GO_BUILD_GCFLAGS) -trimpath -o dist/plugin-linux-arm64;
endif
endif
endif

## Ensures NPM dependencies are installed without having to run this all the time.
webapp/node_modules: $(wildcard webapp/package.json)
ifneq ($(HAS_WEBAPP),)
	cd webapp && $(NPM) install --ignore-scripts --legacy-peer-deps
	touch $@
endif

## Ensures NPM dependencies are installed without having to run this all the time.
e2e-tests/node_modules: $(wildcard e2e-tests/package.json)
ifneq ($(HAS_WEBAPP),)
	cd e2e-tests && $(NPM) install
	touch $@
endif

## Builds the webapp, if it exists.
.PHONY: webapp
webapp: webapp/node_modules
ifneq ($(HAS_WEBAPP),)
	cd webapp && $(NPM) run graphql;
ifeq ($(MM_DEBUG),)
	cd webapp && $(NPM) run build;
else
	cd webapp && $(NPM) run debug;
endif
endif

## Generates a tar bundle of the plugin for install.
.PHONY: bundle
bundle:
	rm -rf dist/
	mkdir -p dist/$(PLUGIN_ID)
	./build/bin/manifest dist
ifneq ($(wildcard LICENSE.txt),)
	cp -r LICENSE.txt dist/$(PLUGIN_ID)/
endif
ifneq ($(wildcard NOTICE.txt),)
	cp -r NOTICE.txt dist/$(PLUGIN_ID)/
endif
ifneq ($(wildcard $(ASSETS_DIR)/.),)
	cp -r $(ASSETS_DIR) dist/$(PLUGIN_ID)/
endif
ifneq ($(HAS_PUBLIC),)
	cp -r public dist/$(PLUGIN_ID)/public/
endif
ifneq ($(HAS_SERVER),)
	mkdir -p dist/$(PLUGIN_ID)/server
	cp -r server/dist dist/$(PLUGIN_ID)/server/
endif
ifneq ($(HAS_WEBAPP),)
	mkdir -p dist/$(PLUGIN_ID)/webapp
	cp -r webapp/dist dist/$(PLUGIN_ID)/webapp/
endif
ifeq ($(shell uname),Darwin)
	cd dist && tar --disable-copyfile -cvzf $(BUNDLE_NAME) $(PLUGIN_ID)
else
	cd dist && tar -cvzf $(BUNDLE_NAME) $(PLUGIN_ID)
endif

	@echo plugin built at: dist/$(BUNDLE_NAME)

## Builds and bundles the plugin.
.PHONY: dist
dist: apply server webapp bundle

## Builds and installs the plugin to a server.
.PHONY: deploy
deploy: dist upload-to-server

## Builds and installs the plugin to a server, updating the plugin automatically when changed.
.PHONY: watch
watch: apply install-go-tools bundle upload-to-server
	$(GOBIN)/modd

## Watch mode for webapp side
.PHONY: watch-webapp
watch-webapp:
ifeq ($(MM_DEBUG),)
	cd webapp && $(NPM) run build:watch
else
	cd webapp && $(NPM) run debug:watch
endif

## Builds and installs the plugin to a server, then starts the webpack dev server on 9005
.PHONY: dev
dev: apply server bundle webapp/node_modules
	cd webapp && $(NPM) run dev-server

## Installs a previous built plugin with updated webpack assets to a server.
.PHONY: deploy-from-watch
deploy-from-watch: bundle upload-to-server

.PHONY: upload-to-server
upload-to-server:
	./build/bin/pluginctl deploy $(PLUGIN_ID) dist/$(BUNDLE_NAME)

## Setup dlv for attaching, identifying the plugin PID for other targets.
.PHONY: setup-attach
setup-attach:
	$(eval PLUGIN_PID := $(shell ps aux | grep "plugins/${PLUGIN_ID}" | grep -v "grep" | awk -F " " '{print $$2}'))
	$(eval NUM_PID := $(shell echo -n ${PLUGIN_PID} | wc -w))

	@if [ ${NUM_PID} -gt 2 ]; then \
		echo "** There is more than 1 plugin process running. Run 'make kill reset' to restart just one."; \
		exit 1; \
	fi

## Check if setup-attach succeeded.
.PHONY: check-attach
check-attach:
	@if [ -z ${PLUGIN_PID} ]; then \
		echo "Could not find plugin PID; the plugin is not running. Exiting."; \
		exit 1; \
	else \
		echo "Located Plugin running with PID: ${PLUGIN_PID}"; \
	fi

## Attach dlv to an existing plugin instance.
.PHONY: attach
attach: setup-attach check-attach
	dlv attach ${PLUGIN_PID}

## Attach dlv to an existing plugin instance, exposing a headless instance on $DLV_DEBUG_PORT.
.PHONY: attach-headless
attach-headless: setup-attach check-attach
	dlv attach ${PLUGIN_PID} --listen :$(DLV_DEBUG_PORT) --headless=true --api-version=2 --accept-multiclient

## Detach dlv from an existing plugin instance, if previously attached.
.PHONY: detach
detach: setup-attach
	@DELVE_PID=$(shell ps aux | grep "dlv attach ${PLUGIN_PID}" | grep -v "grep" | awk -F " " '{print $$2}') && \
	if [ "$$DELVE_PID" -gt 0 ] > /dev/null 2>&1 ; then \
		echo "Located existing delve process running with PID: $$DELVE_PID. Killing." ; \
		kill -9 $$DELVE_PID ; \
	fi

## Runs any lints and unit tests defined for the server and webapp, if they exist.
.PHONY: test
test: apply webapp/node_modules install-go-tools
ifneq ($(HAS_SERVER),)
	$(GOBIN)/gotestsum --format standard-verbose --junitfile report.xml -- ./...
endif
ifneq ($(HAS_WEBAPP),)
	cd webapp && $(NPM) run test;
endif
	@echo "Running submodule tests..."
	cd client && $(GOBIN)/gotestsum --format standard-verbose --junitfile report.xml -- ./...
	cd build && $(GOBIN)/gotestsum --format standard-verbose --junitfile report.xml -- ./...

## Creates a coverage report for the server code.
.PHONY: coverage
coverage: apply webapp/node_modules
ifneq ($(HAS_SERVER),)
	$(GO) test $(GO_TEST_FLAGS) -coverprofile=server/coverage.txt ./server/...
	$(GO) tool cover -html=server/coverage.txt
endif

## Extract strings for translation from the source code.
.PHONY: i18n-extract
i18n-extract: i18n-extract-webapp i18n-extract-server

i18n-extract-webapp:
ifneq ($(HAS_WEBAPP),)
	cd webapp && $(NPM) run extract
endif

i18n-extract-server:
ifneq ($(HAS_SERVER),)
	$(GO) install -modfile=go.tools.mod github.com/mattermost/mattermost-utilities/mmgotool
	mkdir -p server/i18n
	cp assets/i18n/en.json server/i18n/en.json
	cd server && $(GOBIN)/mmgotool i18n extract --portal-dir="" --skip-dynamic
	mv server/i18n/en.json assets/i18n/en.json
	rmdir server/i18n
endif

## Exit on empty translation strings and translation source strings
i18n-check:
ifneq ($(HAS_SERVER),)
	$(GO) install -modfile=go.tools.mod github.com/mattermost/mattermost-utilities/mmgotool
	mkdir -p server/i18n
	cp assets/i18n/en.json server/i18n/en.json
	cd server && $(GOBIN)/mmgotool i18n clean-empty --portal-dir="" --check
	cd server && $(GOBIN)/mmgotool i18n check-empty-src --portal-dir=""
	rmdir server/i18n
endif

## Disable the plugin.
.PHONY: disable
disable: detach
	./build/bin/pluginctl disable $(PLUGIN_ID)

## Enable the plugin.
.PHONY: enable
enable:
	./build/bin/pluginctl enable $(PLUGIN_ID)

## Generate derived types from schema files
.PHONY: graphql
graphql:
	cd webapp && npm run graphql
	$(GO) install github.com/jkrajniak/graphql-codegen-go@v1.2.1
	cd server && $(GOBIN)/graphql-codegen-go -schemas api/schema.graphqls -packageName graphql -out graphql/models.go


## Reset the plugin, effectively disabling and re-enabling it on the server.
.PHONY: reset
reset: detach
	./build/bin/pluginctl reset $(PLUGIN_ID)

## Kill all instances of the plugin, detaching any existing dlv instance.
.PHONY: kill
kill: detach
	$(eval PLUGIN_PID := $(shell ps aux | grep "plugins/${PLUGIN_ID}" | grep -v "grep" | awk -F " " '{print $$2}'))

	@for PID in ${PLUGIN_PID}; do \
		echo "Killing plugin pid $$PID"; \
		kill -9 $$PID; \
	done; \

## Clean removes all build artifacts.
.PHONY: clean
clean:
	rm -fr dist/
ifneq ($(HAS_SERVER),)
	rm -fr server/coverage.txt
	rm -fr server/dist
endif
ifneq ($(HAS_WEBAPP),)
	rm -fr webapp/junit.xml
	rm -fr webapp/dist
	rm -fr webapp/node_modules
endif
	rm -fr build/bin/

.PHONY: logs
logs:
	./build/bin/pluginctl logs $(PLUGIN_ID)

.PHONY: logs-watch
logs-watch:
	./build/bin/pluginctl logs-watch $(PLUGIN_ID)

# Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@cat Makefile build/*.mk | grep -v '\.PHONY' |  grep -v '\help:' | grep -B1 -E '^[a-zA-Z0-9_.-]+:.*' | sed -e "s/:.*//" | sed -e "s/^## //" |  grep -v '\-\-' | sed '1!G;h;$$!d' | awk 'NR%2{printf "\033[36m%-30s\033[0m",$$0;next;}1' | sort
