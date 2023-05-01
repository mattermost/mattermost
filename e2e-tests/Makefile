DASHBOARD_REF ?= origin/main

.PHONY: run-cypress
run-cypress:
	./.ci/server.run_cypress.sh

.PHONY: start-server stop-server
start-server:
	./.ci/server.start.sh
	./.ci/server.inject_test_data.sh
stop-server:
	./.ci/server.stop.sh

.PHONY: start-dashboard stop-dashboard
start-dashboard:
	./.ci/dashboard.start.sh
stop-dashboard:
	./.ci/dashboard.stop.sh

.PHONY: clean-env-placeholders
clean-env-placeholders:
	git reset .ci/.env.*
	git checkout .ci/.env.*
