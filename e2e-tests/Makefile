SHELL := /bin/bash

.PHONY: all run stop
all: run
run: start-server prepare-server run-cypress
stop: stop-server stop-dashboard clean-env-placeholders

.PHONY: start-server prepare-server run-cypress stop-server restart-server
start-server:
	bash ./.ci/server.start.sh
prepare-server:
	bash ./.ci/server.prepare.sh
run-cypress:
	bash ./.ci/server.run_cypress.sh
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
	git reset .ci/.env.{cypress,server,dashboard}
	git checkout .ci/.env.{cypress,server,dashboard}
