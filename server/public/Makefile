test-public: gotestsum
	$(GOBIN)/gotestsum ./public/... -- $(GOFLAGS)

## Generates mock golang interfaces for testing
mocks-public:
	$(GO) install github.com/golang/mock/mockgen@v1.6.0
	$(GOBIN)/mockgen -destination public/plugin/experimental/panel/mocks/mock_panel.go -package mock_panel github.com/mattermost/mattermost/server/public/plugin/experimental/panel Panel
	$(GOBIN)/mockgen -destination public/plugin/experimental/panel/mocks/mock_panelStore.go -package mock_panel github.com/mattermost/mattermost/server/public/plugin/experimental/panel Store
	$(GOBIN)/mockgen -destination public/plugin/experimental/panel/mocks/mock_setting.go -package mock_panel github.com/mattermost/mattermost/server/public/plugin/experimental/panel/settings Setting
	$(GOBIN)/mockgen -destination public/plugin/experimental/bot/mocks/mock_bot.go -package mock_bot github.com/mattermost/mattermost/server/public/plugin/experimental/bot Bot
	$(GOBIN)/mockgen -destination public/plugin/experimental/bot/mocks/mock_logger.go -package mock_bot github.com/mattermost/mattermost/server/public/plugin/experimental/bot/logger Logger
	$(GOBIN)/mockgen -destination public/plugin/experimental/bot/mocks/mock_poster.go -package mock_bot github.com/mattermost/mattermost/server/public/plugin/experimental/bot/poster Poster
	$(GOBIN)/mockgen -destination public/plugin/experimental/oauther/mocks/mock_oauther.go -package mock_oauther github.com/mattermost/mattermost/server/public/plugin/experimental/oauther OAuther
	$(GOBIN)/mockgen -destination public/plugin/experimental/bot/poster/mock_import/mock_postapi.go -package mock_import github.com/mattermost/mattermost/server/public/plugin/experimental/bot/poster PostAPI
