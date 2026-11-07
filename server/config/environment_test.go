// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func modifiedDefault(modify func(*model.Config)) *model.Config {
	def := defaultConfig()
	modify(def)
	return def
}

func defaultConfig() *model.Config {
	def := &model.Config{}
	def.SetDefaults()
	return def
}

func TestRemoveEnvOverrides(t *testing.T) {
	var tests = []struct {
		name           string
		inputConfig    *model.Config
		env            map[string]string
		expectedConfig *model.Config
	}{
		{
			name: "config override",
			inputConfig: modifiedDefault(func(in *model.Config) {
				*in.ServiceSettings.TLSMinVer = "1.4"
				in.PluginSettings.PluginStates = map[string]*model.PluginState{
					"plugin1": {
						Enable: false,
					},
				}
				in.PluginSettings.Plugins = map[string]map[string]any{
					"com.mattermost.plugin-1": {
						"key1": "value1",
					},
					"com_mattermost_plugin-2": {
						"key2": "value2",
					},
				}
			}),
			env: map[string]string{
				"MM_SERVICESETTINGS_TLSMINVER": "1.5",
				"MM_PLUGINSETTINGS_PLUGINSTATES": `{
					"plugin1": {
						"Enable": true
					}
				}`,
				"MM_PLUGINSETTINGS_PLUGINS": `{
					"com.mattermost.plugin-1": {
						"key1": "other-value"
					},
					"com_mattermost_plugin-2": {
						"key2": "other-value"
					}
				}`,
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
				*in.ServiceSettings.TLSMinVer = "1.5"
				in.PluginSettings.PluginStates = map[string]*model.PluginState{
					"plugin1": {
						Enable: true,
					},
				}
				in.PluginSettings.Plugins = map[string]map[string]any{
					"com.mattermost.plugin-1": {
						"key1": "other-value",
					},
					"com_mattermost_plugin-2": {
						"key2": "other-value",
					},
				}
			}),
		},
		{
			name: "feature flags",
			inputConfig: modifiedDefault(func(in *model.Config) {
				in.FeatureFlags.TestFeature = "somevalue"
			}),
			env: map[string]string{
				"MM_FEATUREFLAGS_TESTFEATURE": "correctvalue",
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
				in.FeatureFlags.TestFeature = "correctvalue"
			}),
		},
		{
			name: "int setting",
			inputConfig: modifiedDefault(func(in *model.Config) {
				*in.ClusterSettings.GossipPort = 500
			}),
			env: map[string]string{
				"MM_CLUSTERSETTINGS_GOSSIPPORT": "600",
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
				*in.ClusterSettings.GossipPort = 600
			}),
		},
		{
			name: "int64 setting",
			inputConfig: modifiedDefault(func(in *model.Config) {
				*in.ServiceSettings.TLSStrictTransportMaxAge = 500
			}),
			env: map[string]string{
				"MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE": "4294967294",
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
				*in.ServiceSettings.TLSStrictTransportMaxAge = 4294967294
			}),
		},
		{
			name: "bool setting",
			inputConfig: modifiedDefault(func(in *model.Config) {
				*in.ClusterSettings.UseIPAddress = false
			}),
			env: map[string]string{
				"MM_CLUSTERSETTINGS_USEIPADDRESS": "true",
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
				*in.ClusterSettings.UseIPAddress = true
			}),
		},
		{
			name: "[]string setting",
			inputConfig: modifiedDefault(func(in *model.Config) {
				in.SqlSettings.DataSourceReplicas = []string{"something"}
			}),
			env: map[string]string{
				"MM_SQLSETTINGS_DATASOURCEREPLICAS": "otherthing alsothis",
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
				in.SqlSettings.DataSourceReplicas = []string{"otherthing", "alsothis"}
			}),
		},
		{
			name: "complex env settings",
			inputConfig: modifiedDefault(func(in *model.Config) {
			}),
			env: map[string]string{
				"MM_PLUGINSETTINGS_PLUGINSTATES": `{
					"com.mattermost.plugin-1": {
						"enable": true
					}
				}`,
				"MM_PLUGINSETTINGS_PLUGINS": `{
					"com.mattermost.plugin-1": {
						"key": {
							"key":  "(?P<key>KEY)-(?P<id>\\d{1,6})(?P<comma>[,;]*)",
							"value": "[$key-$id](https://example.com/?$project-$id)$comma"
						}
					}
				}`,
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
				in.PluginSettings.PluginStates = map[string]*model.PluginState{
					"com.mattermost.plugin-1": {
						Enable: true,
					},
				}
				in.PluginSettings.Plugins = map[string]map[string]any{
					"com.mattermost.plugin-1": {
						"key": map[string]any{
							"key":   "(?P<key>KEY)-(?P<id>\\d{1,6})(?P<comma>[,;]*)",
							"value": "[$key-$id](https://example.com/?$project-$id)$comma",
						},
					},
				}
			}),
		},
		{
			name: "bad env",
			inputConfig: modifiedDefault(func(in *model.Config) {
			}),
			env: map[string]string{
				"MM_SERVICESETTINGS":        "huh?",
				"NOTMM":                     "huh?",
				"MM_NOTEXIST":               "huh?",
				"MM_NOTEXIST_MORE_AND_MORE": "huh?",
				"MM_":                       "huh?",
				"MM":                        "huh?",
				"MM__":                      "huh?",
				"_":                         "huh?",
			},
			expectedConfig: modifiedDefault(func(in *model.Config) {
			}),
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			require.Equal(t, testCase.expectedConfig, applyEnvironmentMap(testCase.inputConfig, testCase.env))
		})
	}
}

func TestGenerateEnvironmentMapPointerToStruct(t *testing.T) {
	env := map[string]string{
		"MM_MESSAGEEXPORTSETTINGS_ENABLEEXPORT":                             "true",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_CUSTOMERTYPE":         "CUSTOM",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_SMTPUSERNAME":         "envUser",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_SMTPPASSWORD":         "envPassword",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_EMAILADDRESS":         "env@example.com",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_CUSTOMSMTPSERVERNAME": "feeds.example.com",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_CUSTOMSMTPPORT":       "2525",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_CUSTOMHEADERNAME":     "X-Custom",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_CUSTOMHEADERVALUE":    "Message",
	}

	overrides := generateEnvironmentMap(env, nil)
	require.NotNil(t, overrides)

	messageExportSettings, ok := overrides["MessageExportSettings"].(map[string]any)
	require.True(t, ok, "expected MessageExportSettings override map")
	assert.Equal(t, true, messageExportSettings["EnableExport"])

	globalRelaySettings, ok := messageExportSettings["GlobalRelaySettings"].(map[string]any)
	require.True(t, ok, "expected nested GlobalRelaySettings override map for pointer-to-struct fields")
	assert.Equal(t, map[string]any{
		"CustomerType":         true,
		"SMTPUsername":         true,
		"SMTPPassword":         true,
		"EmailAddress":         true,
		"CustomSMTPServerName": true,
		"CustomSMTPPort":       true,
		"CustomHeaderName":     true,
		"CustomHeaderValue":    true,
	}, globalRelaySettings)
}

func TestRemoveEnvOverridesPointerToStruct(t *testing.T) {
	cfgWithoutEnv := modifiedDefault(func(in *model.Config) {
		*in.MessageExportSettings.GlobalRelaySettings.SMTPUsername = "storedUser"
		*in.MessageExportSettings.GlobalRelaySettings.EmailAddress = "stored@example.com"
	})

	cfgWithEnv := cfgWithoutEnv.Clone()
	*cfgWithEnv.MessageExportSettings.GlobalRelaySettings.SMTPUsername = "envUser"
	*cfgWithEnv.MessageExportSettings.GlobalRelaySettings.EmailAddress = "env@example.com"

	envOverrides := generateEnvironmentMap(map[string]string{
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_SMTPUSERNAME": "envUser",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_EMAILADDRESS": "env@example.com",
	}, nil)
	require.NotNil(t, envOverrides)

	cleaned := removeEnvOverrides(cfgWithEnv, cfgWithoutEnv, envOverrides)
	assert.Equal(t, "storedUser", *cleaned.MessageExportSettings.GlobalRelaySettings.SMTPUsername)
	assert.Equal(t, "stored@example.com", *cleaned.MessageExportSettings.GlobalRelaySettings.EmailAddress)
}

func TestApplyEnvironmentMapPointerToStruct(t *testing.T) {
	input := modifiedDefault(func(in *model.Config) {
		*in.MessageExportSettings.GlobalRelaySettings.SMTPUsername = "storedUser"
		*in.MessageExportSettings.GlobalRelaySettings.CustomerType = "A9"
	})

	applied := applyEnvironmentMap(input, map[string]string{
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_SMTPUSERNAME": "envUser",
		"MM_MESSAGEEXPORTSETTINGS_GLOBALRELAYSETTINGS_CUSTOMERTYPE": "CUSTOM",
	})

	assert.Equal(t, "envUser", *applied.MessageExportSettings.GlobalRelaySettings.SMTPUsername)
	assert.Equal(t, "CUSTOM", *applied.MessageExportSettings.GlobalRelaySettings.CustomerType)
}
