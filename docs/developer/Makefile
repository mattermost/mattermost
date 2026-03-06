export GOBIN ?= $(PWD)/bin
GO ?= go

HUGO_VERSION := v0.157.0

all: dist

.PHONY: hugo
hugo:
	$(GO) install github.com/gohugoio/hugo@$(HUGO_VERSION)

.PHONY: dist
dist: hugo plugin-data
	rm -rf ./dist
	$(GOBIN)/hugo -s site --destination ../dist/html

.PHONY: plugin-data
plugin-data: backend-plugin-data frontend-plugin-data

.PHONY: backend-plugin-data
backend-plugin-data:
	mkdir -p site/data
	$(GO) run ./cmd/plugin-godocs > site/data/PluginGoDocs.json
	$(GO) run ./cmd/plugin-manifest-docs > site/data/PluginManifestDocs.json

.PHONY: frontend-plugin-data
frontend-plugin-data:
	cd scripts && npm install
	mkdir -p site/data
	node scripts/plugin-jsdocs.js > site/data/PluginJSDocs.json

.PHONY: run
run: hugo
	$(GOBIN)/hugo server --buildDrafts --disableFastRender -F -s site

.PHONY: build
build: hugo
	rm -rf ./dist
	$(GOBIN)/hugo -s site --verbose --destination ../dist/html --printUnusedTemplates --printPathWarnings --gc

.PHONY: test
test:
	npm install
	npm run test-html

.PHONY: compass-icons
compass-icons:
	mkdir -p site/static/css
	mkdir -p site/static/font
	curl --no-progress-meter -o site/static/css/compass-icons.css https://mattermost.github.io/compass-icons/css/compass-icons.css
	curl --no-progress-meter -o "site/static/font/compass-icons.#1" "https://mattermost.github.io/compass-icons/font/compass-icons.{eot,woff2,woff,ttf,svg}"
