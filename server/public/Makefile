test-public: gotestsum ## Runs tests for public packages
	$(call run_tool_docker,gotestsum,./public/... -- $(GOFLAGS))

mocks-public: $(MOCKGEN_BIN) ## Generates mock golang interfaces for testing
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/panel/mocks/mock_panel.go -package mock_panel github.com/mattermost/mattermost/server/public/pluginapi/experimental/panel Panel)
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/panel/mocks/mock_panelStore.go -package mock_panel github.com/mattermost/mattermost/server/public/pluginapi/experimental/panel Store)
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/panel/mocks/mock_setting.go -package mock_panel github.com/mattermost/mattermost/server/public/pluginapi/experimental/panel/settings Setting)
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/bot/mocks/mock_bot.go -package mock_bot github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot Bot)
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/bot/mocks/mock_logger.go -package mock_bot github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/logger Logger)
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/bot/mocks/mock_poster.go -package mock_bot github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/poster Poster)
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/oauther/mocks/mock_oauther.go -package mock_oauther github.com/mattermost/mattermost/server/public/pluginapi/experimental/oauther OAuther)
	$(call run_tool_docker,mockgen,-destination public/pluginapi/experimental/bot/poster/mock_import/mock_postapi.go -package mock_import github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/poster PostAPI)
