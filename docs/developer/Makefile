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
	http --download -o site/static/css/compass-icons.css https://mattermost.github.io/compass-icons/css/compass-icons.css
	http --download -o "site/static/font/compass-icons.eot" "https://mattermost.github.io/compass-icons/font/compass-icons.eot"
	http --download -o "site/static/font/compass-icons.woff2" "https://mattermost.github.io/compass-icons/font/compass-icons.woff2"
	http --download -o "site/static/font/compass-icons.woff" "https://mattermost.github.io/compass-icons/font/compass-icons.woff"
	http --download -o "site/static/font/compass-icons.ttf" "https://mattermost.github.io/compass-icons/font/compass-icons.ttf"
	http --download -o "site/static/font/compass-icons.svg" "https://mattermost.github.io/compass-icons/font/compass-icons.svg"
