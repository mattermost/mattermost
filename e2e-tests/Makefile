# Load environment variables from .env file
-include .ci/.env
export

SHELL := /bin/bash
TEST ?= cypress
SERVER ?= self-hosted
ENABLED_DOCKER_SERVICES ?= postgres inbucket

define log_message
    @echo "[$(shell date '+%Y-%m-%dT%H:%M:%S%Z')]$1"
endef

.PHONY: all run stop
all: run
run: info generate-docker-compose create-cloud-customer start-server-test prepare-server run-test delete-cloud-customer
stop: stop-server stop-dashboard clean-env-placeholders

.PHONY: info generate-docker-compose start-server-test run-test start-server prepare-server stop-server restart-server
generate-docker-compose:
	bash ./.ci/docker_compose_generator.sh
start-server-test:
	bash ./.ci/server.start.sh
prepare-server:
	bash ./.ci/server.prepare.sh
run-test:
	@if [ "$(TEST)" = "cypress" ]; then bash ./.ci/server.run_cypress.sh; \
    elif [ "$(TEST)" = "playwright" ]; then bash ./.ci/server.run_playwright.sh; \
    else $(call log_message, "TEST: $(TEST)"); fi
info:
	$(call log_message, "TEST: $(TEST)")
	$(call log_message, "SERVER: $(SERVER)")
	$(call log_message, "ENABLED_DOCKER_SERVICES: $(ENABLED_DOCKER_SERVICES)")

start-server: generate-docker-compose
	TEST=server bash ./.ci/server.start.sh
stop-server:
	bash ./.ci/server.stop.sh
restart-server: stop-server start-server

.PHONY: start-dashboard stop-dashboard
start-dashboard:
	bash ./.ci/dashboard.start.sh
stop-dashboard:
	bash ./.ci/dashboard.stop.sh

.PHONY: print-env-placeholders clean-env-placeholders
print-env-placeholders:
	find .ci -maxdepth 1 -name '.env.*'  | xargs --verbose -l cat
clean-env-placeholders:
	git reset .ci/.env.{cypress,server,server.cloud,dashboard}
	git checkout .ci/.env.{cypress,server,server.cloud,dashboard}

.PHONY: create-cloud-customer delete-cloud-customer
create-cloud-customer:
	@if [ "$(SERVER)" = "cloud" ]; then bash ./.ci/server.cloud_customer_create.sh; fi
delete-cloud-customer:
	@if [ "$(SERVER)" = "cloud" ]; then bash ./.ci/server.cloud_customer_delete.sh; fi

.PHONY: prettier fmt-ci
# Install with https://webinstall.dev/shellcheck/
HAVE_SHELLCHECK ?= $(shell command -v shellcheck >/dev/null 2>&1 && echo yes)

# Install with https://webinstall.dev/shfmt/
HAVE_SHFMT ?= $(shell command -v shfmt >/dev/null  2>&1 && echo yes)

prettier:
	# formats yaml files
	npx prettier ./.ci "!./.ci/dashboard" --write --cache
fmt-ci: prettier
ifeq ($(HAVE_SHFMT),yes)
	shfmt -w -s -i 2 ./.ci/*.sh
endif
ifeq ($(HAVE_SHELLCHECK),yes)
	shellcheck ./.ci/*.sh ./.ci/.e2erc*
endif
