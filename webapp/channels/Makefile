.PHONY: build dist test run clean stop check-style fix-style run-unit emojis help update-dependencies

BUILD_SERVER_DIR = ../mattermost-server

export NODE_OPTIONS=--max-old-space-size=4096

i18n-extract: ## Extract strings for translation from the source code
	npm run mmjstool -- i18n extract-webapp

e2e/playwright/node_modules:
	@echo Install Playwright and its dependencies
	cd e2e/playwright && npm install

dist: node_modules build ## Builds and packages app
	@echo Packaging Mattermost Web App

	mkdir tmp
	mv dist tmp/client
	tar -C tmp -czf mattermost-webapp.tar.gz client
	mv tmp/client dist
	rmdir tmp

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
