GO ?= go
GO_TEST_FLAGS ?= -race

# We need to export GOBIN to allow it to be set
# for processes spawned from the Makefile
export GOBIN ?= $(PWD)/bin

all: test

test:
	$(GO) test $(GO_TEST_FLAGS) -v ./...

coverage:
	$(GO) test $(GO_TEST_FLAGS) -coverprofile=coverage.txt ./...
	$(GO) tool cover -html=coverage.txt

check-style:
	@# Keep the version in sync with the command in .circleci/config.yml
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.49.0

	@echo Running golangci-lint
	$(GOBIN)/golangci-lint run ./...

## Generates mock golang interfaces for testing
mock:
	go install github.com/golang/mock/mockgen@v1.6.0
	mockgen -destination experimental/panel/mocks/mock_panel.go -package mock_panel github.com/mattermost/mattermost-plugin-api/experimental/panel Panel
	mockgen -destination experimental/panel/mocks/mock_panelStore.go -package mock_panel github.com/mattermost/mattermost-plugin-api/experimental/panel Store
	mockgen -destination experimental/panel/mocks/mock_setting.go -package mock_panel github.com/mattermost/mattermost-plugin-api/experimental/panel/settings Setting
	mockgen -destination experimental/bot/mocks/mock_bot.go -package mock_bot github.com/mattermost/mattermost-plugin-api/experimental/bot Bot
	mockgen -destination experimental/bot/mocks/mock_logger.go -package mock_bot github.com/mattermost/mattermost-plugin-api/experimental/bot/logger Logger
	mockgen -destination experimental/bot/mocks/mock_poster.go -package mock_bot github.com/mattermost/mattermost-plugin-api/experimental/bot/poster Poster
	mockgen -destination experimental/oauther/mocks/mock_oauther.go -package mock_oauther github.com/mattermost/mattermost-plugin-api/experimental/oauther OAuther
	mockgen -destination experimental/bot/poster/mock_import/mock_postapi.go -package mock_import github.com/mattermost/mattermost-plugin-api/experimental/bot/poster PostAPI
