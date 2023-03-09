# The CI environment variable is set automatically in CircleCI and GitLab CI
CI ?= false

.PHONY: run
run: node_modules ## Runs app
	@echo Running Mattermost Web App for development

	npm run run

.PHONY: test
test: node_modules ## Runs tests
	@echo Running jest unit/component testing

	npm run test

.PHONY: check-style
check-style: node_modules ## Checks JS file for ESLint confirmity
	@echo Checking for style guide compliance

	npm run check

.PHONY: check-types
check-types: node_modules ## Checks TS file for TypeScript confirmity
	@echo Checking for TypeScript compliance

	npm run check-types

node_modules: package.json $(wildcard package-lock.json)
	@echo Getting dependencies using npm

ifeq ($(CI),false)
	npm install
else
	# This runs in CI with NODE_ENV=production which skips devDependencies without this flag
	npm ci --include=dev
endif

	touch $@

.PHONY: clean
clean: ## Clears cached; deletes node_modules and dist directories
	@echo Cleaning Web App

	npm run clean --workspaces --if-present
	cd channels && make clean
	rm -rf node_modules
