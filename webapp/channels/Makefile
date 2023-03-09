.PHONY: build dist test run clean stop check-style fix-style run-unit emojis help update-dependencies

BUILD_SERVER_DIR = ../mattermost-server

export NODE_OPTIONS=--max-old-space-size=4096

-include config.override.mk
include config.mk

RUN_IN_BACKGROUND ?=
ifeq ($(RUN_CLIENT_IN_BACKGROUND),true)
	RUN_IN_BACKGROUND := &
endif

# The CI environment variable is set automatically in CircleCI and GitLab CI
CI ?= false

check-style: node_modules ## Checks JS file for ESLint confirmity
	@echo Checking for style guide compliance

	npm run check

fix-style: node_modules ## Fix JS file ESLint issues
	@echo Fixing lint issues to follow style guide

	npm run fix

check-types: node_modules e2e/playwright/node_modules ## Checks TS file for TypeScript confirmity
	@echo Checking for TypeScript compliance

	npm run check-types

test: node_modules ## Runs tests
	@echo Running jest unit/component testing

	npm run test

i18n-extract: ## Extract strings for translation from the source code
	npm run mmjstool -- i18n extract-webapp

node_modules: package.json package-lock.json
	@echo Getting dependencies using npm

	node skip_integrity_check.js

ifeq ($(CI),false)
	npm install
else
	# This runs in CI with NODE_ENV=production which doesn't install devDependencies without this flag
	npm ci --include=dev

endif

	touch $@

e2e/playwright/node_modules:
	@echo Install Playwright and its dependencies
	cd e2e/playwright && npm install

build: node_modules ## Builds app
	@echo Building Mattermost Web App

	rm -rf dist
	npm run build

dist: node_modules build ## Builds and packages app
	@echo Packaging Mattermost Web App

	mkdir tmp
	mv dist tmp/client
	tar -C tmp -czf mattermost-webapp.tar.gz client
	mv tmp/client dist
	rmdir tmp

run: node_modules ## Runs app
	@echo Running Mattermost Web App for development

	npm run run $(RUN_IN_BACKGROUND)

dev: node_modules ## Runs webpack-dev-server
	npm run dev-server

run-fullmap: node_modules ## Legacy alias to run
	@echo Running Mattermost Web App for development

	npm run run $(RUN_IN_BACKGROUND)

stop: ## Stops webpack
	@echo Stopping changes watching

ifeq ($(OS),Windows_NT)
	wmic process where "Caption='node.exe' and CommandLine like '%webpack%'" call terminate
else
	@pkill -f webpack || true
endif

restart: | stop run ## Restarts the app

clean: ## Clears cached; deletes node_modules and dist directories
	@echo Cleaning Web App

	rm -rf dist
	rm -rf node_modules

	rm -f .eslintcache
	rm -f .stylelintcache

e2e-test: node_modules
	@echo E2E: Running mattermost-mysql-e2e
	@if [ $(shell docker ps -a | grep -ci mattermost-mysql-e2e) -eq 0 ]; then \
		echo starting mattermost-mysql-e2e; \
		docker run --name mattermost-mysql-e2e -p 35476:3306 -e MYSQL_ROOT_PASSWORD=mostest \
		-e MYSQL_USER=mmuser -e MYSQL_PASSWORD=mostest -e MYSQL_DATABASE=mattermost_test -d mysql:5.7 > /dev/null; \
	elif [ $(shell docker ps | grep -ci mattermost-mysql-e2e) -eq 0 ]; then \
		echo restarting mattermost-mysql-e2e; \
		docker start mattermost-mysql-e2e > /dev/null; \
	fi

	cd $(BUILD_SERVER_DIR) && [[ -f config/config.json ]] && \
		cp config/config.json config/config-backup.json && make config-reset || \
		echo "config.json not found" && make config-reset

	@echo E2E: Starting the server
	cd $(BUILD_SERVER_DIR) && $(MAKE) run

	@echo E2E: Generating test data
	cd $(BUILD_SERVER_DIR) && $(MAKE) test-data

	@echo E2E: Running end-to-end testing
	cd e2e && npm install && npm run cypress:run

	@echo E2E: Stoppping the server
	cd $(BUILD_SERVER_DIR) && $(MAKE) stop

	@echo E2E: stopping mattermost-mysql-e2e
	docker stop mattermost-mysql-e2e > /dev/null

	cd $(BUILD_SERVER_DIR) && [[ -f config/config-backup.json ]] && \
		cp config/config-backup.json config/config.json && echo "revert local config.json" || \
		echo "config-backup.json not found" && sed -i'' -e 's|"DataSource": ".*"|"DataSource": "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8\u0026readTimeout=30s\u0026writeTimeout=30s"|g' config/config.json

	@echo E2E: Tests completed

clean-e2e:
	@if [ $(shell docker ps -a | grep -ci mattermost-mysql-e2e) -eq 1 ]; then \
		echo stopping mattermost-mysql-e2e; \
		docker stop mattermost-mysql-e2e > /dev/null; \
	fi

	cd $(BUILD_SERVER_DIR) && [[ -f config/config-backup.json ]] && \
		cp config/config-backup.json config/config.json && echo "revert local config.json" || \
		echo "config-backup.json not found" && sed -i'' -e 's|"DataSource": ".*"|"DataSource": "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8\u0026readTimeout=30s\u0026writeTimeout=30s"|g' config/config.json

emojis: ## Creates emoji JSON, JSX and Go files and extracts emoji images from the system font
	SERVER_DIR=$(BUILD_SERVER_DIR) npm run make-emojis
	@if [ -e $(BUILD_SERVER_DIR)/model/emoji_data.go ]; then \
		gofmt -w $(BUILD_SERVER_DIR)/model/emoji_data.go; \
	fi

## Help documentatin à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

update-dependencies: # Updates the dependencies
	npm update --depth 9999
	npm audit fix
	@echo Automatic dependency update complete.
	@echo You should manually inspect changes to package.json and pin exact versions of packages where appropriate.
