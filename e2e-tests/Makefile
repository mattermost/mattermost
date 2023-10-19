# Load environment variables from .env file
-include .ci/.env
export

SHELL := /bin/bash

.PHONY: all run stop
all: run
run: generate-server create-cloud-customer start-server prepare-server run-test delete-cloud-customer
stop: stop-server stop-dashboard

.PHONY: generate-server start-server prepare-server run-test stop-server restart-server
generate-server:
	bash ./.ci/server.generate.sh
start-server:
	bash ./.ci/server.start.sh
prepare-server:
	bash ./.ci/server.prepare.sh
run-test:
	bash ./.ci/server.run_test.sh
stop-server:
	bash ./.ci/server.stop.sh
restart-server: stop-server start-server

.PHONY: start-dashboard stop-dashboard
start-dashboard:
	bash ./.ci/dashboard.start.sh
stop-dashboard:
	bash ./.ci/dashboard.stop.sh

.PHONY: create-cloud-customer delete-cloud-customer
create-cloud-customer:
	bash ./.ci/server.cloud_customer_create.sh
delete-cloud-customer:
	bash ./.ci/server.cloud_customer_delete.sh

.PHONY: fmt-node fmt-shell fmt
requirecmd-%:
	@which "$(*)" >/dev/null || { echo "Missing required command: "$(*)". Aborting." >&2; exit 1; }
fmt-node: requirecmd-npx
	# Formats yaml files
	npx prettier ./.ci "!./.ci/dashboard" --write --cache
fmt-shell: requirecmd-shfmt requirecmd-shellcheck
	shfmt -w -s -i 2 ./.ci/*.sh         # Install with https://webinstall.dev/shellcheck/
	shellcheck ./.ci/*.sh ./.ci/.e2erc* # Install with https://webinstall.dev/shfmt/
fmt: fmt-node fmt-shell
