// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"bytes"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestConfig(t *testing.T) {
	utils.TranslationsPreInit()
	_, _, _, err := LoadConfig("config.json")
	require.Nil(t, err)
}

func TestReadConfig(t *testing.T) {
	utils.TranslationsPreInit()

	_, _, err := ReadConfig(bytes.NewReader([]byte(``)), false)
	require.EqualError(t, err, "parsing error at line 1, character 1: unexpected end of JSON input")

	_, _, err = ReadConfig(bytes.NewReader([]byte(`
		{
			malformed
	`)), false)
	require.EqualError(t, err, "parsing error at line 3, character 5: invalid character 'm' looking for beginning of object key string")
}

func TestReadConfig_PluginSettings(t *testing.T) {
	utils.TranslationsPreInit()

	config, _, err := ReadConfig(bytes.NewReader([]byte(`{
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
	utils.TranslationsPreInit()

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

		cfg, envCfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.TeamSettings.SiteName != "From Environment" {
			t.Fatal("Couldn't read config from environment var")
		}

		if *cfg.TeamSettings.CustomBrandText != "Custom Brand" {
			t.Fatal("Couldn't read config from environment var")
		}

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

		cfg, envCfg, err = ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.TeamSettings.SiteName != "Mattermost" {
			t.Fatal("should have been reset")
		}

		if _, ok := envCfg["TeamSettings"]; ok {
			t.Fatal("TeamSettings should be missing from envConfig")
		}
	})

	t.Run("boolean setting", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_ENABLECOMMANDS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ENABLECOMMANDS")

		cfg, envCfg, err := ReadConfig(strings.NewReader(config), true)
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

		cfg, envCfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.ServiceSettings.ReadTimeout != 400 {
			t.Fatal("Couldn't read config from environment var")
		}

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

		cfg, envCfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.ServiceSettings.SiteURL != "https://example.com" {
			t.Fatal("Couldn't read config from environment var")
		}

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

		cfg, envCfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.SupportSettings.TermsOfServiceLink != "" {
			t.Fatal("Couldn't read empty TermsOfServiceLink from environment var")
		}

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

		cfg, envCfg, err := ReadConfig(strings.NewReader(config), true)
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

		cfg, envCfg, err := ReadConfig(strings.NewReader(config), true)
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

func TestValidateLocales(t *testing.T) {
	utils.TranslationsPreInit()
	cfg, _, _, err := LoadConfig("config.json")
	require.Nil(t, err)

	*cfg.LocalizationSettings.DefaultServerLocale = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "en"
	*cfg.LocalizationSettings.AvailableLocales = ""

	// t.Logf("*cfg.LocalizationSettings.DefaultClientLocale: %+v", *cfg.LocalizationSettings.DefaultClientLocale)
	if err := ValidateLocales(cfg); err != nil {
		t.Fatal("Should have not returned an error")
	}

	// validate DefaultServerLocale
	*cfg.LocalizationSettings.DefaultServerLocale = "junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultServerLocale != "en" {
			t.Fatal("DefaultServerLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultServerLocale")
	}

	*cfg.LocalizationSettings.DefaultServerLocale = ""
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultServerLocale != "en" {
			t.Fatal("DefaultServerLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultServerLocale")
	}

	*cfg.LocalizationSettings.AvailableLocales = "en"
	*cfg.LocalizationSettings.DefaultServerLocale = "de"
	if err := ValidateLocales(cfg); err != nil {
		if strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultServerLocale) {
			t.Fatal("DefaultServerLocale should not be added to AvailableLocales")
		}
		t.Fatal("Should have not returned an error validating DefaultServerLocale")
	}

	// validate DefaultClientLocale
	*cfg.LocalizationSettings.AvailableLocales = ""
	*cfg.LocalizationSettings.DefaultClientLocale = "junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultClientLocale != "en" {
			t.Fatal("DefaultClientLocale should have assigned to en as a default value")
		}
	} else {

		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	*cfg.LocalizationSettings.DefaultClientLocale = ""
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultClientLocale != "en" {
			t.Fatal("DefaultClientLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	*cfg.LocalizationSettings.AvailableLocales = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "de"
	if err := ValidateLocales(cfg); err != nil {
		if !strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultClientLocale) {
			t.Fatal("DefaultClientLocale should have added to AvailableLocales")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	// validate AvailableLocales
	*cfg.LocalizationSettings.DefaultServerLocale = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "en"
	*cfg.LocalizationSettings.AvailableLocales = "junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.AvailableLocales != "" {
			t.Fatal("AvailableLocales should have assigned to empty string as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}

	*cfg.LocalizationSettings.AvailableLocales = "en,de,junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.AvailableLocales != "" {
			t.Fatal("AvailableLocales should have assigned to empty string as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}

	*cfg.LocalizationSettings.DefaultServerLocale = "fr"
	*cfg.LocalizationSettings.DefaultClientLocale = "de"
	*cfg.LocalizationSettings.AvailableLocales = "en"
	if err := ValidateLocales(cfg); err != nil {
		if strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultServerLocale) {
			t.Fatal("DefaultServerLocale should not be added to AvailableLocales")
		}
		if !strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultClientLocale) {
			t.Fatal("DefaultClientLocale should have added to AvailableLocales")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}
}

func TestGetClientConfig(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		description    string
		config         *model.Config
		diagnosticId   string
		license        *model.License
		expectedFields map[string]string
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        sToP("ws://mattermost.example.com:8065"),
					WebsocketPort:       iToP(80),
					WebsocketSecurePort: iToP(443),
				},
			},
			"",
			nil,
			map[string]string{
				"DiagnosticId":                     "",
				"EmailNotificationContentsType":    "full",
				"AllowCustomThemes":                "true",
				"EnforceMultifactorAuthentication": "false",
				"WebsocketURL":                     "ws://mattermost.example.com:8065",
				"WebsocketPort":                    "80",
				"WebsocketSecurePort":              "443",
			},
		},
		{
			"licensed, but not for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					ThemeManagement: bToP(false),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag1",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "true",
			},
		},
		{
			"licensed for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					AllowCustomThemes: bToP(false),
				},
			},
			"tag2",
			&model.License{
				Features: &model.Features{
					ThemeManagement: bToP(true),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag2",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "false",
			},
		},
		{
			"licensed for enforcement",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					EnforceMultifactorAuthentication: bToP(true),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					MFA: bToP(true),
				},
			},
			map[string]string{
				"EnforceMultifactorAuthentication": "true",
			},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.description, func(t *testing.T) {
			t.Parallel()

			testCase.config.SetDefaults()
			if testCase.license != nil {
				testCase.license.Features.SetDefaults()
			}

			configMap := GenerateClientConfig(testCase.config, testCase.diagnosticId, testCase.license)
			for expectedField, expectedValue := range testCase.expectedFields {
				actualValue, ok := configMap[expectedField]
				if assert.True(t, ok, fmt.Sprintf("config does not contain %v", expectedField)) {
					assert.Equal(t, expectedValue, actualValue)
				}
			}
		})
	}
}

func TestGetLimitedClientConfig(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		description    string
		config         *model.Config
		diagnosticId   string
		license        *model.License
		expectedFields map[string]string
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        sToP("ws://mattermost.example.com:8065"),
					WebsocketPort:       iToP(80),
					WebsocketSecurePort: iToP(443),
				},
			},
			"",
			nil,
			map[string]string{
				"DiagnosticId":                     "",
				"EnforceMultifactorAuthentication": "false",
				"WebsocketURL":                     "ws://mattermost.example.com:8065",
				"WebsocketPort":                    "80",
				"WebsocketSecurePort":              "443",
			},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.description, func(t *testing.T) {
			t.Parallel()

			testCase.config.SetDefaults()
			if testCase.license != nil {
				testCase.license.Features.SetDefaults()
			}

			configMap := GenerateLimitedClientConfig(testCase.config, testCase.diagnosticId, testCase.license)
			for expectedField, expectedValue := range testCase.expectedFields {
				actualValue, ok := configMap[expectedField]
				if assert.True(t, ok, fmt.Sprintf("config does not contain %v", expectedField)) {
					assert.Equal(t, expectedValue, actualValue)
				}
			}
		})
	}
}

func sToP(s string) *string {
	return &s
}

func bToP(b bool) *bool {
	return &b
}

func iToP(i int) *int {
	return &i
}

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
