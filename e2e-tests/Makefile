SHELL := /bin/bash

.PHONY: all run stop clean
all: run
run: cloud-init generate-server start-server prepare-server run-test cloud-teardown
stop: stop-server stop-dashboard clean
clean:
	rm -fv .ci/server.yml
	rm -fv .ci/.env*

.PHONY: generate-server start-server prepare-server run-test stop-server restart-server
generate-server:
	bash ./.ci/server.generate.sh
start-server: generate-server
	bash ./.ci/server.start.sh
prepare-server:
	bash ./.ci/server.prepare.sh
run-test:
	bash ./.ci/server.run_test.sh
stop-server: generate-server
	bash ./.ci/server.stop.sh
restart-server: stop-server start-server

.PHONY: start-dashboard generate-test-cycle stop-dashboard
start-dashboard:
	bash ./.ci/dashboard.start.sh
generate-test-cycle: requirecmd-node generate-server
	bash ./.ci/dashboard.generate_test_cycle.sh
stop-dashboard:
	bash ./.ci/dashboard.stop.sh

.PHONY: cloud-init cloud-teardown
cloud-init: requirecmd-jq requirecmd-curl
	bash ./.ci/server.cloud_init.sh
cloud-teardown:
	bash ./.ci/server.cloud_teardown.sh

.PHONY: publish-report
publish-report: requirecmd-node
	bash ./.ci/report.publish.sh

.PHONY: fmt-node fmt-shell fmt
requirecmd-%:
	@which "$(*)" >/dev/null || { echo "Error, missing required CLI tool: $(*). Aborting." >&2; exit 1; }
fmt-node: requirecmd-npx
	# Formats yaml files
	npx prettier ./.ci "!./.ci/dashboard" --write --cache
fmt-shell: requirecmd-shfmt requirecmd-shellcheck
	shfmt -w -s -i 2 ./.ci/*.sh         # Install with https://webinstall.dev/shellcheck/
	shellcheck ./.ci/*.sh ./.ci/.e2erc* # Install with https://webinstall.dev/shfmt/
fmt: fmt-node fmt-shell
