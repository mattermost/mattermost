package pluginapi

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/require"
)

func TestConfigurationService_GetConfig(t *testing.T) {
	t.Run("success - set defaults in config", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		configurationSvc := ConfigurationService{api: api}

		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()

		api.On("GetConfig").Return(&model.Config{})

		cfg := configurationSvc.GetConfig()

		require.Equal(t, defaultConfig, cfg)
	})
}

func TestConfigurationService_GetUnsanitizedConfig(t *testing.T) {
	t.Run("success - set defaults in unsanitized config", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		configurationSvc := ConfigurationService{api: api}

		defaultConfig := &model.Config{}
		defaultConfig.SetDefaults()

		api.On("GetUnsanitizedConfig").Return(&model.Config{})

		cfg := configurationSvc.GetUnsanitizedConfig()

		require.Equal(t, defaultConfig, cfg)
	})
}
