// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func TestGetDefaultsFromStruct(t *testing.T) {
	s := struct {
		TestSettings struct {
			IntValue    int
			BoolValue   bool
			StringValue string
		}
		PointerToTestSettings *struct {
			Value int
		}
	}{}

	defaults := getDefaultsFromStruct(s)

	assert.Equal(t, defaults["TestSettings.IntValue"], 0)
	assert.Equal(t, defaults["TestSettings.BoolValue"], false)
	assert.Equal(t, defaults["TestSettings.StringValue"], "")
	assert.Equal(t, defaults["PointerToTestSettings.Value"], 0)
	assert.NotContains(t, defaults, "PointerToTestSettings")
	assert.Len(t, defaults, 4)
}

func TestUnmarshalConfig(t *testing.T) {
	_, _, err := unmarshalConfig(bytes.NewReader([]byte(``)), false)
	require.EqualError(t, err, "parsing error at line 1, character 1: unexpected end of JSON input")

	_, _, err = unmarshalConfig(bytes.NewReader([]byte(`
		{
			malformed
	`)), false)
	require.EqualError(t, err, "parsing error at line 3, character 5: invalid character 'm' looking for beginning of object key string")
}

func TestUnmarshalConfig_PluginSettings(t *testing.T) {
	config, _, err := unmarshalConfig(bytes.NewReader([]byte(`{
		"PluginSettings": {
			"Directory": "/temp/mattermost-plugins",
			"Plugins": {
				"com.example.plugin": {
					"number": 1,
					"string": "abc",
					"boolean": false,
					"abc.def.ghi": {
						"abc": 123,
						"def": "456"
					}
				},
				"jira": {
					"number": 2,
					"string": "123",
					"boolean": true,
					"abc.def.ghi": {
						"abc": 456,
						"def": "123"
					}
 				}
			},
			"PluginStates": {
				"com.example.plugin": {
					"enable": true
				},
				"jira": {
					"enable": false
 				}
			}
		}
	}`)), false)
	require.Nil(t, err)

	assert.Equal(t, "/temp/mattermost-plugins", *config.PluginSettings.Directory)

	if assert.Contains(t, config.PluginSettings.Plugins, "com.example.plugin") {
		assert.Equal(t, map[string]interface{}{
			"number":  float64(1),
			"string":  "abc",
			"boolean": false,
			"abc.def.ghi": map[string]interface{}{
				"abc": float64(123),
				"def": "456",
			},
		}, config.PluginSettings.Plugins["com.example.plugin"])
	}
	if assert.Contains(t, config.PluginSettings.PluginStates, "com.example.plugin") {
		assert.Equal(t, model.PluginState{
			Enable: true,
		}, *config.PluginSettings.PluginStates["com.example.plugin"])
	}

	if assert.Contains(t, config.PluginSettings.Plugins, "jira") {
		assert.Equal(t, map[string]interface{}{
			"number":  float64(2),
			"string":  "123",
			"boolean": true,
			"abc.def.ghi": map[string]interface{}{
				"abc": float64(456),
				"def": "123",
			},
		}, config.PluginSettings.Plugins["jira"])
	}
	if assert.Contains(t, config.PluginSettings.PluginStates, "jira") {
		assert.Equal(t, model.PluginState{
			Enable: false,
		}, *config.PluginSettings.PluginStates["jira"])
	}
}

func TestConfigFromEnviroVars(t *testing.T) {
	config := `{
		"ServiceSettings": {
			"EnableCommands": true,
			"ReadTimeout": 100
		},
		"TeamSettings": {
			"SiteName": "Mattermost",
			"CustomBrandText": ""
		},
		"SupportSettings": {
			"TermsOfServiceLink": "https://about.mattermost.com/default-terms/"
		},
		"PluginSettings": {
			"Enable": true,
			"Plugins": {
				"jira": {
					"enabled": "true",
					"secret": "config-secret"
				}
			},
			"PluginStates": {
				"jira": {
					"Enable": true
				}
			}
		}
	}`

	t.Run("string settings", func(t *testing.T) {
		os.Setenv("MM_TEAMSETTINGS_SITENAME", "From Environment")
		os.Setenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT", "Custom Brand")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, "From Environment", *cfg.TeamSettings.SiteName)
		assert.Equal(t, "Custom Brand", *cfg.TeamSettings.CustomBrandText)

		teamSettings, ok := envCfg["TeamSettings"]
		require.True(t, ok, "TeamSettings is missing from envConfig")

		teamSettingsAsMap, ok := teamSettings.(map[string]interface{})
		require.True(t, ok, "TeamSettings is not a map in envConfig")

		siteNameInEnv, ok := teamSettingsAsMap["SiteName"].(bool)
		require.True(t, ok || siteNameInEnv, "SiteName should be in envConfig")

		customBrandTextInEnv, ok := teamSettingsAsMap["CustomBrandText"].(bool)
		require.True(t, ok || customBrandTextInEnv, "SiteName should be in envConfig")

		os.Unsetenv("MM_TEAMSETTINGS_SITENAME")
		os.Unsetenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT")

		cfg, envCfg, err = unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, "Mattermost", *cfg.TeamSettings.SiteName)

		_, ok = envCfg["TeamSettings"]
		require.False(t, ok, "TeamSettings should be missing from envConfig")
	})

	t.Run("boolean setting", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_ENABLECOMMANDS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ENABLECOMMANDS")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		require.False(t, *cfg.ServiceSettings.EnableCommands, "Couldn't read config from environment var")

		serviceSettings, ok := envCfg["ServiceSettings"]
		require.True(t, ok, "ServiceSettings is missing from envConfig")

		serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{})
		require.True(t, ok, "ServiceSettings is not a map in envConfig")

		enableCommandsInEnv, ok := serviceSettingsAsMap["EnableCommands"].(bool)
		require.True(t, ok || enableCommandsInEnv, "EnableCommands should be in envConfig")
	})

	t.Run("integer setting", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_READTIMEOUT", "400")
		defer os.Unsetenv("MM_SERVICESETTINGS_READTIMEOUT")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, 400, *cfg.ServiceSettings.ReadTimeout)

		serviceSettings, ok := envCfg["ServiceSettings"]
		require.True(t, ok, "ServiceSettings is missing from envConfig")

		serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{})
		require.True(t, ok, "ServiceSettings is not a map in envConfig")

		readTimeoutInEnv, ok := serviceSettingsAsMap["ReadTimeout"].(bool)
		require.True(t, ok || readTimeoutInEnv, "ReadTimeout should be in envConfig")
	})

	t.Run("setting missing from config.json", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_SITEURL", "https://example.com")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, "https://example.com", *cfg.ServiceSettings.SiteURL)

		serviceSettings, ok := envCfg["ServiceSettings"]
		require.True(t, ok, "ServiceSettings is missing from envConfig")

		serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{})
		require.True(t, ok, "ServiceSettings is not a map in envConfig")

		siteURLInEnv, ok := serviceSettingsAsMap["SiteURL"].(bool)
		require.True(t, ok || siteURLInEnv, "SiteURL should be in envConfig")
	})

	t.Run("empty string setting", func(t *testing.T) {
		os.Setenv("MM_SUPPORTSETTINGS_TERMSOFSERVICELINK", "")
		defer os.Unsetenv("MM_SUPPORTSETTINGS_TERMSOFSERVICELINK")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Empty(t, *cfg.SupportSettings.TermsOfServiceLink)

		supportSettings, ok := envCfg["SupportSettings"]
		require.True(t, ok, "SupportSettings is missing from envConfig")

		supportSettingsAsMap, ok := supportSettings.(map[string]interface{})
		require.True(t, ok, "SupportSettings is not a map in envConfig")

		termsOfServiceLinkInEnv, ok := supportSettingsAsMap["TermsOfServiceLink"].(bool)
		require.True(t, ok || termsOfServiceLinkInEnv, "TermsOfServiceLink should be in envConfig")
	})

	t.Run("plugin directory settings", func(t *testing.T) {
		os.Setenv("MM_PLUGINSETTINGS_ENABLE", "false")
		os.Setenv("MM_PLUGINSETTINGS_DIRECTORY", "/temp/plugins")
		os.Setenv("MM_PLUGINSETTINGS_CLIENTDIRECTORY", "/temp/clientplugins")
		defer os.Unsetenv("MM_PLUGINSETTINGS_ENABLE")
		defer os.Unsetenv("MM_PLUGINSETTINGS_DIRECTORY")
		defer os.Unsetenv("MM_PLUGINSETTINGS_CLIENTDIRECTORY")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, false, *cfg.PluginSettings.Enable)
		assert.Equal(t, "/temp/plugins", *cfg.PluginSettings.Directory)
		assert.Equal(t, "/temp/clientplugins", *cfg.PluginSettings.ClientDirectory)

		pluginSettings, ok := envCfg["PluginSettings"]
		require.True(t, ok, "PluginSettings is missing from envConfig")

		pluginSettingsAsMap, ok := pluginSettings.(map[string]interface{})
		require.True(t, ok, "PluginSettings is not a map in envConfig")

		directory, ok := pluginSettingsAsMap["Directory"].(bool)
		require.True(t, ok || directory, "Directory should be in envConfig")

		clientDirectory, ok := pluginSettingsAsMap["ClientDirectory"].(bool)
		require.True(t, ok || clientDirectory, "ClientDirectory should be in envConfig")
	})

	t.Run("plugin specific settings can be overridden via environment", func(t *testing.T) {
		os.Setenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_ENABLED", "false")
		os.Setenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_SECRET", "env-secret")
		os.Setenv("MM_PLUGINSETTINGS_PLUGINSTATES_JIRA_ENABLE", "false")
		defer os.Unsetenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_ENABLED")
		defer os.Unsetenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_SECRET")
		defer os.Unsetenv("MM_PLUGINSETTINGS_PLUGINSTATES_JIRA_ENABLE")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		pluginsJira, ok := cfg.PluginSettings.Plugins["jira"]
		require.True(t, ok, "PluginSettings.Plugins.jira is missing from config")

		enabled, ok := pluginsJira["enabled"]
		require.True(t, ok, "PluginSettings.Plugins.jira.enabled is missing from config")
		assert.Equal(t, "false", enabled)

		secret, ok := pluginsJira["secret"]
		require.True(t, ok, "PluginSettings.Plugins.jira.secret is missing from config")
		assert.Equal(t, "env-secret", secret)

		pluginStatesJira, ok := cfg.PluginSettings.PluginStates["jira"]
		require.True(t, ok, "PluginSettings.PluginStates.jira is missing from config")
		require.Equal(t, false, pluginStatesJira.Enable)

		pluginSettings, ok := envCfg["PluginSettings"]
		require.True(t, ok, "PluginSettings is missing from envConfig")

		pluginSettingsAsMap, ok := pluginSettings.(map[string]interface{})
		require.True(t, ok, "PluginSettings is not a map in envConfig")

		plugins, ok := pluginSettingsAsMap["Plugins"].(map[string]interface{})
		require.True(t, ok, "PluginSettings.Plugins is not a map in envConfig")

		_, ok = plugins["jira"].(map[string]interface{})
		require.True(t, ok, "PluginSettings.Plugins.jira should be a map in envConfig")

		pluginStates, ok := pluginSettingsAsMap["PluginStates"].(map[string]interface{})
		require.True(t, ok, "PluginSettings.PluginStates is missing from envConfig")

		_, ok = pluginStates["jira"].(map[string]interface{})
		require.True(t, ok, "PluginSettings.PluginStates.jira not be a map in envConfig")
	})
}

func TestReadConfig_ImageProxySettings(t *testing.T) {
	utils.TranslationsPreInit()

	t.Run("deprecated settings should still be read properly", func(t *testing.T) {
		config, _, err := unmarshalConfig(bytes.NewReader([]byte(`{
			"ServiceSettings": {
				"ImageProxyType": "OldImageProxyType",
				"ImageProxyURL": "OldImageProxyURL",
				"ImageProxyOptions": "OldImageProxyOptions"
			}
		}`)), false)

		require.Nil(t, err)

		assert.Equal(t, model.NewString("OldImageProxyType"), config.ServiceSettings.DEPRECATED_DO_NOT_USE_ImageProxyType)
		assert.Equal(t, model.NewString("OldImageProxyURL"), config.ServiceSettings.DEPRECATED_DO_NOT_USE_ImageProxyURL)
		assert.Equal(t, model.NewString("OldImageProxyOptions"), config.ServiceSettings.DEPRECATED_DO_NOT_USE_ImageProxyOptions)
	})
}
