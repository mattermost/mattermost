// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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

		if teamSettings, ok := envCfg["TeamSettings"]; !ok {
			t.Fatal("TeamSettings is missing from envConfig")
		} else if teamSettingsAsMap, ok := teamSettings.(map[string]interface{}); !ok {
			t.Fatal("TeamSettings is not a map in envConfig")
		} else {
			if siteNameInEnv, ok := teamSettingsAsMap["SiteName"].(bool); !ok || !siteNameInEnv {
				t.Fatal("SiteName should be in envConfig")
			}

			if customBrandTextInEnv, ok := teamSettingsAsMap["CustomBrandText"].(bool); !ok || !customBrandTextInEnv {
				t.Fatal("SiteName should be in envConfig")
			}
		}

		os.Unsetenv("MM_TEAMSETTINGS_SITENAME")
		os.Unsetenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT")

		cfg, envCfg, err = unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, "Mattermost", *cfg.TeamSettings.SiteName)

		if _, ok := envCfg["TeamSettings"]; ok {
			t.Fatal("TeamSettings should be missing from envConfig")
		}
	})

	t.Run("boolean setting", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_ENABLECOMMANDS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ENABLECOMMANDS")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.ServiceSettings.EnableCommands {
			t.Fatal("Couldn't read config from environment var")
		}

		if serviceSettings, ok := envCfg["ServiceSettings"]; !ok {
			t.Fatal("ServiceSettings is missing from envConfig")
		} else if serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{}); !ok {
			t.Fatal("ServiceSettings is not a map in envConfig")
		} else {
			if enableCommandsInEnv, ok := serviceSettingsAsMap["EnableCommands"].(bool); !ok || !enableCommandsInEnv {
				t.Fatal("EnableCommands should be in envConfig")
			}
		}
	})

	t.Run("integer setting", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_READTIMEOUT", "400")
		defer os.Unsetenv("MM_SERVICESETTINGS_READTIMEOUT")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, 400, *cfg.ServiceSettings.ReadTimeout)

		if serviceSettings, ok := envCfg["ServiceSettings"]; !ok {
			t.Fatal("ServiceSettings is missing from envConfig")
		} else if serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{}); !ok {
			t.Fatal("ServiceSettings is not a map in envConfig")
		} else {
			if readTimeoutInEnv, ok := serviceSettingsAsMap["ReadTimeout"].(bool); !ok || !readTimeoutInEnv {
				t.Fatal("ReadTimeout should be in envConfig")
			}
		}
	})

	t.Run("setting missing from config.json", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_SITEURL", "https://example.com")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Equal(t, "https://example.com", *cfg.ServiceSettings.SiteURL)

		if serviceSettings, ok := envCfg["ServiceSettings"]; !ok {
			t.Fatal("ServiceSettings is missing from envConfig")
		} else if serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{}); !ok {
			t.Fatal("ServiceSettings is not a map in envConfig")
		} else {
			if siteURLInEnv, ok := serviceSettingsAsMap["SiteURL"].(bool); !ok || !siteURLInEnv {
				t.Fatal("SiteURL should be in envConfig")
			}
		}
	})

	t.Run("empty string setting", func(t *testing.T) {
		os.Setenv("MM_SUPPORTSETTINGS_TERMSOFSERVICELINK", "")
		defer os.Unsetenv("MM_SUPPORTSETTINGS_TERMSOFSERVICELINK")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		assert.Empty(t, *cfg.SupportSettings.TermsOfServiceLink)

		if supportSettings, ok := envCfg["SupportSettings"]; !ok {
			t.Fatal("SupportSettings is missing from envConfig")
		} else if supportSettingsAsMap, ok := supportSettings.(map[string]interface{}); !ok {
			t.Fatal("SupportSettings is not a map in envConfig")
		} else {
			if termsOfServiceLinkInEnv, ok := supportSettingsAsMap["TermsOfServiceLink"].(bool); !ok || !termsOfServiceLinkInEnv {
				t.Fatal("TermsOfServiceLink should be in envConfig")
			}
		}
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

		if pluginSettings, ok := envCfg["PluginSettings"]; !ok {
			t.Fatal("PluginSettings is missing from envConfig")
		} else if pluginSettingsAsMap, ok := pluginSettings.(map[string]interface{}); !ok {
			t.Fatal("PluginSettings is not a map in envConfig")
		} else {
			if directory, ok := pluginSettingsAsMap["Directory"].(bool); !ok || !directory {
				t.Fatal("Directory should be in envConfig")
			}
			if clientDirectory, ok := pluginSettingsAsMap["ClientDirectory"].(bool); !ok || !clientDirectory {
				t.Fatal("ClientDirectory should be in envConfig")
			}
		}
	})

	t.Run("plugin specific settings cannot be overridden via environment", func(t *testing.T) {
		os.Setenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_ENABLED", "false")
		os.Setenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_SECRET", "env-secret")
		os.Setenv("MM_PLUGINSETTINGS_PLUGINSTATES_JIRA_ENABLE", "false")
		defer os.Unsetenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_ENABLED")
		defer os.Unsetenv("MM_PLUGINSETTINGS_PLUGINS_JIRA_SECRET")
		defer os.Unsetenv("MM_PLUGINSETTINGS_PLUGINSTATES_JIRA_ENABLE")

		cfg, envCfg, err := unmarshalConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if pluginsJira, ok := cfg.PluginSettings.Plugins["jira"]; !ok {
			t.Fatal("PluginSettings.Plugins.jira is missing from config")
		} else {
			if enabled, ok := pluginsJira["enabled"]; !ok {
				t.Fatal("PluginSettings.Plugins.jira.enabled is missing from config")
			} else {
				assert.Equal(t, "true", enabled)
			}

			if secret, ok := pluginsJira["secret"]; !ok {
				t.Fatal("PluginSettings.Plugins.jira.secret is missing from config")
			} else {
				assert.Equal(t, "config-secret", secret)
			}
		}

		if pluginStatesJira, ok := cfg.PluginSettings.PluginStates["jira"]; !ok {
			t.Fatal("PluginSettings.PluginStates.jira is missing from config")
		} else {
			require.Equal(t, true, pluginStatesJira.Enable)
		}

		if pluginSettings, ok := envCfg["PluginSettings"]; !ok {
			t.Fatal("PluginSettings is missing from envConfig")
		} else if pluginSettingsAsMap, ok := pluginSettings.(map[string]interface{}); !ok {
			t.Fatal("PluginSettings is not a map in envConfig")
		} else {
			if plugins, ok := pluginSettingsAsMap["Plugins"].(map[string]interface{}); !ok {
				t.Fatal("PluginSettings.Plugins is not a map in envConfig")
			} else if _, ok := plugins["jira"].(map[string]interface{}); ok {
				t.Fatal("PluginSettings.Plugins.jira should not be a map in envConfig")
			}

			if pluginStates, ok := pluginSettingsAsMap["PluginStates"].(map[string]interface{}); !ok {
				t.Fatal("PluginSettings.PluginStates is missing from envConfig")
			} else if _, ok := pluginStates["jira"].(map[string]interface{}); ok {
				t.Fatal("PluginSettings.PluginStates.jira should not be a map in envConfig")
			}
		}
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
