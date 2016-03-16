.PHONY: build test

test:
	@echo Checking for style guide compliance

	npm run check

.npminstall: package.json
	@echo Getting dependencies using npm

	npm install

	touch $@

build: .npminstall
	@echo Building mattermost web client

	npm run build
