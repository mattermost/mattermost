.PHONY: build test run clean

test:
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

	npm run run
	

clean:
	@echo Cleaning Webapp

	rm -rf dist
	rm -rf node_modules
	rm -f .npminstall
