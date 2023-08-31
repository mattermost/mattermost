ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: build build-v4 clean playbooks

V4_YAML = $(ROOT)/v4/html/static/mattermost-openapi-v4.yaml

V4_SRC = $(ROOT)/v4/source
PLAYBOOKS_SRC = $(ROOT)/playbooks

build: build-v4

build-v4: node_modules playbooks
	@echo Building mattermost openapi yaml for v4

	@if [ -r $(PLAYBOOKS_SRC)/merged-tags.yaml ]; then cat $(PLAYBOOKS_SRC)/merged-tags.yaml > $(V4_YAML); else cat $(V4_SRC)/introduction.yaml > $(V4_YAML); fi
	@cat $(V4_SRC)/users.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/status.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/teams.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/channels.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/posts.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/preferences.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/files.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/uploads.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/jobs.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/system.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/emoji.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/webhooks.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/saml.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/compliance.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/ldap.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/groups.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/cluster.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/brand.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/commands.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/oauth.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/elasticsearch.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/bleve.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/dataretention.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/plugins.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/roles.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/schemes.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/service_terms.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/sharedchannels.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/reactions.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/actions.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/bots.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/cloud.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/usage.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/permissions.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/imports.yaml >> $(V4_YAML)
	@cat $(V4_SRC)/exports.yaml >> $(V4_YAML)
	@if [ -r $(PLAYBOOKS_SRC)/paths.yaml ]; then cat $(PLAYBOOKS_SRC)/paths.yaml >> $(V4_YAML); fi
	@if [ -r $(PLAYBOOKS_SRC)/merged-definitions.yaml ]; then cat $(PLAYBOOKS_SRC)/merged-definitions.yaml >> $(V4_YAML); else cat $(V4_SRC)/definitions.yaml >> $(V4_YAML); fi
	@echo Extracting code samples
	cd server && go run . $(V4_YAML)

	@node_modules/.bin/swagger-cli validate $(V4_YAML)
	@node_modules/.bin/redoc-cli -t ./v4/html/ssr_template.hbs build ./v4/html/static/mattermost-openapi-v4.yaml -o ./v4/html/index.html --options.noAutoAuth  --options.suppressWarnings
	@echo Complete

node_modules: package.json $(wildcard package-lock.json)
	@echo Getting dependencies using npm

	npm install
	touch $@

run:
	@echo Starting redoc server

	@node_modules/.bin/redoc-cli -t ./v4/html/ssr_template.hbs serve ./v4/html/static/mattermost-openapi-v4.yaml --options.noAutoAuth  --options.suppressWarnings  --ssr

clean:
	@echo Cleaning

	rm -rf node_modules

playbooks:
	@echo Fetching Playbooks OpenAPI spec
	cd playbooks && node extract.js
	cd playbooks && node merge-definitions.js $(V4_SRC)/definitions.yaml
	cd playbooks && node merge-tags.js $(V4_SRC)/introduction.yaml
