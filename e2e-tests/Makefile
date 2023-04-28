.PHONY: run-cypress

DASHBOARD_REF ?= origin/main

run-cypress:
	./.ci/server.start.sh
	./.ci/server.inject_test_data.sh
	./.ci/server.run_cypress.sh

# TODO create also the docker-compose alias for the dashboard?
start-dashboard:
	[ -d .ci/dashboard ] || git clone https://github.com/saturninoabril/automation-dashboard.git .ci/dashboard
	git -C .ci/dashboard fetch
	git -C .ci/dashboard checkout $(DASHBOARD_REF)
	UID=$$UID docker-compose -p dashboard -f .ci/dashboard/docker/docker-compose.yml -f .ci/dashboard.override.yml up -d db dashboard
stop-dashboard:
	UID=$$UID docker-compose -p dashboard -f .ci/dashboard/docker/docker-compose.yml -f .ci/dashboard.override.yml down
reset-env-placeholders:
	git reset .ci/.env.*
	git checkout .ci/.env.*
