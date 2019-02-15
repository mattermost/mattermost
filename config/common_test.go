package config_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func prepareExpectedConfig(t *testing.T, expectedCfg *model.Config) *model.Config {
	// These fields require special initialization for our tests.
	expectedCfg = expectedCfg.Clone()
	expectedCfg.MessageExportSettings.GlobalRelaySettings = &model.GlobalRelayMessageExportSettings{}
	expectedCfg.PluginSettings.Plugins = make(map[string]map[string]interface{})
	expectedCfg.PluginSettings.PluginStates = make(map[string]*model.PluginState)

	return expectedCfg
}
