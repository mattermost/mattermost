GO ?= go
GO_TEST_FLAGS ?= -race

all: test

test:
	$(GO) test $(GO_TEST_FLAGS) -v ./...

coverage:
	$(GO) test $(GO_TEST_FLAGS) -coverprofile=coverage.txt ./...
	$(GO) tool cover -html=coverage.txt

check-style:
	@if ! [ -x "$$(command -v golangci-lint)" ]; then \
		echo "golangci-lint is not installed. Please see https://github.com/golangci/golangci-lint#install for installation instructions."; \
		exit 1; \
	fi; \

	@echo Running golangci-lint
	golangci-lint run ./...

## Generates mock golang interfaces for testing
mock:
	go install github.com/golang/mock/mockgen
	mockgen -destination experimental/panel/mocks/mock_panel.go -package mock_panel github.com/mattermost/mattermost-plugin-api/experimental/panel Panel
	mockgen -destination experimental/panel/mocks/mock_panelStore.go -package mock_panel github.com/mattermost/mattermost-plugin-api/experimental/panel Store
	mockgen -destination experimental/panel/mocks/mock_setting.go -package mock_panel github.com/mattermost/mattermost-plugin-api/experimental/panel/settings Setting
	mockgen -destination experimental/flow/mocks/mock_flow.go -package mock_flow github.com/mattermost/mattermost-plugin-api/experimental/flow Flow
	mockgen -destination experimental/flow/mocks/mock_controller.go -package mock_flow github.com/mattermost/mattermost-plugin-api/experimental/flow Controller
	mockgen -destination experimental/flow/mocks/mock_store.go -package mock_flow github.com/mattermost/mattermost-plugin-api/experimental/flow Store
	mockgen -destination experimental/flow/mocks/mock_step.go -package mock_flow github.com/mattermost/mattermost-plugin-api/experimental/flow/steps Step
	mockgen -destination experimental/bot/mocks/mock_bot.go -package mock_bot github.com/mattermost/mattermost-plugin-api/experimental/bot Bot
	mockgen -destination experimental/bot/mocks/mock_logger.go -package mock_bot github.com/mattermost/mattermost-plugin-api/experimental/bot/logger Logger
	mockgen -destination experimental/bot/mocks/mock_poster.go -package mock_bot github.com/mattermost/mattermost-plugin-api/experimental/bot/poster Poster
	mockgen -destination experimental/freetextfetcher/mocks/mock_fetcher.go -package mock_freetext_fetcher github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher FreetextFetcher
	mockgen -destination experimental/freetextfetcher/mocks/mock_manager.go -package mock_freetext_fetcher github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher Manager
	mockgen -destination experimental/freetextfetcher/mocks/mock_store.go -package mock_freetext_fetcher github.com/mattermost/mattermost-plugin-api/experimental/freetextfetcher FreetextStore