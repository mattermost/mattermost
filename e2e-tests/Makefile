SHELL := /bin/bash

.PHONY: all run stop clean
all: run
run: generate-server start-server run-test
stop: stop-server stop-dashboard clean
report: collect-report-data publish-report
clean:
	rm -fv .ci/server.yml
	rm -fv .ci/.env.{server,dashboard,cypress,playwright}

.PHONY: generate-server start-server run-test stop-server restart-server
generate-server:
	bash ./.ci/server.generate.sh
start-server: generate-server
	bash ./.ci/server.start.sh
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

.PHONY: collect-report-data publish-report
collect-report-data:
	bash ./.ci/report.collect.sh
publish-report: requirecmd-node
	bash ./.ci/report.publish.sh

.PHONY: check-shell fmt-shell fmt-node fmt
requirecmd-%:
	@which "$(*)" >/dev/null || { echo "Error, missing required CLI tool: $(*). Aborting." >&2; exit 1; }
check-shell: requirecmd-shellcheck
	shellcheck ./.ci/*.sh ./.ci/.e2erc* # Install with https://webinstall.dev/shfmt/
fmt-shell: requirecmd-shfmt
	shfmt -w -s -i 2 ./.ci/*.sh         # Install with https://webinstall.dev/shellcheck/
fmt-node: requirecmd-npx
	# Formats yaml files
	npx prettier ./.ci "!./.ci/dashboard" --write --cache
fmt: fmt-node fmt-shell
