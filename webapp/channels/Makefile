BUILD_SERVER_DIR = ../mattermost-server

export NODE_OPTIONS=--max-old-space-size=4096

.PHONY: i18n-extract
i18n-extract: ## Extract strings for translation from the source code
	npm run i18n-extract

.PHONY: emojis
emojis: ## Creates emoji JSON, JSX and Go files and extracts emoji images from the system font
	SERVER_DIR=$(BUILD_SERVER_DIR) npm run make-emojis
	@if [ -e $(BUILD_SERVER_DIR)/model/emoji_data.go ]; then \
		gofmt -w $(BUILD_SERVER_DIR)/model/emoji_data.go; \
	fi

## Help documentatin à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
.PHONY: help
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: update-dependencies
update-dependencies: # Updates the dependencies
	npm update --depth 9999
	npm audit fix
	@echo Automatic dependency update complete.
	@echo You should manually inspect changes to package.json and pin exact versions of packages where appropriate.
