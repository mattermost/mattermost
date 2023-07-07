-include config.override.mk
include config.mk

# The CI environment variable is set automatically in CircleCI and GitLab CI
CI ?= false

# Detect Linux/ARM64 and set a flag to fix the issue with optipng-bin on it:
# please see optipng-bin Linux arm64 support issue (https://github.com/imagemin/optipng-bin/issues/118) for details:
ifeq ($(shell uname)/$(shell uname -m),Linux/aarch64)
  LINUX_ARM64 = true
  CPPFLAGS = "-DPNG_ARM_NEON_OPT=0"
endif

.PHONY: run
run: node_modules ## Runs app
	@echo Running Mattermost Web App for development

	npm run run

.PHONY: stop
stop: ## Stops webpack
	@echo Stopping changes watching

ifeq ($(OS),Windows_NT)
	wmic process where "Caption='node.exe' and CommandLine like '%webpack%'" call terminate
else
	-@pkill -f webpack || true
endif

.PHONY: restart
restart: | stop run ## Restarts the app

.PHONY: dev
dev: node_modules ## Runs app with webpack-dev-server
	npm run dev-server

.PHONY: test
test: node_modules ## Runs tests
	@echo Running jest unit/component testing

	npm run test

.PHONY: check-style
check-style: node_modules ## Checks JS file for ESLint confirmity
	@echo Checking for style guide compliance

	npm run check

.PHONY: fix-style
fix-style: node_modules ## Fix JS file ESLint issues
	@echo Fixing lint issues to follow style guide

	npm run fix

.PHONY: check-types
check-types: node_modules ## Checks TS file for TypeScript confirmity
	@echo Checking for TypeScript compliance

	npm run check-types

.PHONY: dist
dist: node_modules ## Builds all web app packages
	@echo Packaging Mattermost Web App

	npm run build

node_modules: package.json $(wildcard package-lock.json)
	@echo Getting dependencies using npm

ifeq ($(CI),false)
	CPPFLAGS=$(CPPFLAGS) npm install
else
	# This runs in CI with NODE_ENV=production which skips devDependencies without this flag
	npm ci --include=dev
endif

	touch $@

.PHONY: clean
clean: ## Clears cached; deletes node_modules and dist directories
	@echo Cleaning Web App

	npm run clean --workspaces --if-present
	rm -rf node_modules

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
.PHONY: help
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
