.PHONY: build test run clean stop

test: .npminstall
	@echo Checking for style guide compliance

	npm run check

.npminstall: package.json
	@echo Getting dependencies using npm

	npm install

	touch $@

build: | .npminstall test
	@echo Building mattermost Webapp

	npm run build

run: .npminstall
	@echo Running mattermost Webapp for development

	npm run run &

run-fullmap: .npminstall
	@echo FULL SOURCE MAP Running mattermost Webapp for development FULL SOURCE MAP

	npm run run-fullmap &

stop:
	@echo Stopping changes watching

	@for PROCID in $$(ps -ef | grep "[n]ode.*[w]ebpack" | awk '{ print $$2 }'); do \
		echo stopping webpack watch $$PROCID; \
		kill $$PROCID; \
	done

clean:
	@echo Cleaning Webapp

	rm -rf dist
	rm -rf node_modules
	rm -f .npminstall
