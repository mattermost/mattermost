// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/model"

	"github.com/stretchr/testify/require"
)

func defaultConfigGen() *model.Config {
	cfg := &model.Config{}
	cfg.SetDefaults()
	return cfg
}

func BenchmarkDiff(b *testing.B) {
	b.Run("equal empty", func(b *testing.B) {
		baseCfg := &model.Config{}
		actualCfg := &model.Config{}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = Diff(baseCfg, actualCfg)
		}
	})

	b.Run("equal with defaults", func(b *testing.B) {
		baseCfg := defaultConfigGen()
		actualCfg := defaultConfigGen()
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = Diff(baseCfg, actualCfg)
		}
	})

	b.Run("actual empty", func(b *testing.B) {
		baseCfg := defaultConfigGen()
		actualCfg := &model.Config{}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = Diff(baseCfg, actualCfg)
		}
	})

	b.Run("base empty", func(b *testing.B) {
		baseCfg := &model.Config{}
		actualCfg := defaultConfigGen()
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = Diff(baseCfg, actualCfg)
		}
	})

	b.Run("some diffs", func(b *testing.B) {
		baseCfg := defaultConfigGen()
		actualCfg := defaultConfigGen()
		baseCfg.ServiceSettings.SiteURL = model.NewString("http://localhost")
		baseCfg.ServiceSettings.ReadTimeout = model.NewInt(300)
		baseCfg.SqlSettings.QueryTimeout = model.NewInt(0)
		actualCfg.PluginSettings.EnableUploads = nil
		actualCfg.TeamSettings.MaxChannelsPerTeam = model.NewInt64(100000)
		actualCfg.FeatureFlags = nil
		actualCfg.SqlSettings.DataSourceReplicas = []string{
			"ds0",
			"ds1",
			"ds2",
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = Diff(baseCfg, actualCfg)
		}
	})
}

func TestDiffSanitized(t *testing.T) {
	tcs := []struct {
		name   string
		base   *model.Config
		actual *model.Config
		diffs  ConfigDiffs
		err    string
	}{
		{
			"nil",
			nil,
			nil,
			nil,
			"input configs should not be nil",
		},
		{
			"empty",
			&model.Config{},
			&model.Config{},
			nil,
			"",
		},
		{
			"defaults",
			defaultConfigGen(),
			defaultConfigGen(),
			nil,
			"",
		},
		{
			"default base, actual empty",
			defaultConfigGen(),
			&model.Config{},
			ConfigDiffs{
				{
					Path: "",
					BaseVal: func() model.Config {
						cfg := defaultConfigGen()
						cfg.Sanitize()
						return *cfg
					}(),
					ActualVal: model.Config{},
				},
			},
			"",
		},
		{
			"empty base, actual default",
			&model.Config{},
			defaultConfigGen(),
			ConfigDiffs{
				{
					Path:    "",
					BaseVal: model.Config{},
					ActualVal: func() model.Config {
						cfg := defaultConfigGen()
						cfg.Sanitize()
						return *cfg
					}(),
				},
			},
			"",
		},
		{
			"sensitive LdapSettings.BindPassword",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.LdapSettings.BindPassword = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.LdapSettings.BindPassword = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "LdapSettings.BindPassword",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive FileSettings.PublicLinkSalt",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.FileSettings.PublicLinkSalt = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.FileSettings.PublicLinkSalt = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "FileSettings.PublicLinkSalt",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive FileSettings.AmazonS3SecretAccessKey",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.FileSettings.AmazonS3SecretAccessKey = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.FileSettings.AmazonS3SecretAccessKey = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "FileSettings.AmazonS3SecretAccessKey",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive SqlSettings.DataSource",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSource = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSource = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "SqlSettings.DataSource",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive SqlSettings.AtRestEncryptKey",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.AtRestEncryptKey = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.AtRestEncryptKey = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "SqlSettings.AtRestEncryptKey",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive SqlSettings.DataSourceReplicas",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceReplicas = []string{
					"ds0",
					"ds1",
				}
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceReplicas = []string{
					"ds0",
					"ds1",
					"ds2",
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "SqlSettings.DataSourceReplicas",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive SqlSettings.DataSourceSearchReplicas",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceSearchReplicas = []string{
					"ds0",
					"ds1",
				}
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceSearchReplicas = []string{
					"ds0",
					"ds1",
					"ds2",
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "SqlSettings.DataSourceSearchReplicas",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive EmailSettings.SMTPPassword",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.EmailSettings.SMTPPassword = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.EmailSettings.SMTPPassword = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "EmailSettings.SMTPPassword",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive GitLabSettings.Secret",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.GitLabSettings.Secret = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.GitLabSettings.Secret = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "GitLabSettings.Secret",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive GoogleSettings.Secret",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.GoogleSettings.Secret = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.GoogleSettings.Secret = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "GoogleSettings.Secret",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive Office365Settings.Secret",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.Office365Settings.Secret = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.Office365Settings.Secret = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "Office365Settings.Secret",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive OpenIdSettings.Secret",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.OpenIdSettings.Secret = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.OpenIdSettings.Secret = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "OpenIdSettings.Secret",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive ElasticsearchSettings.Password",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ElasticsearchSettings.Password = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ElasticsearchSettings.Password = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "ElasticsearchSettings.Password",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive MessageExportSettings.GlobalRelaySettings",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.MessageExportSettings.GlobalRelaySettings = &model.GlobalRelayMessageExportSettings{
					SMTPUsername: model.NewString("base"),
					SMTPPassword: model.NewString("base"),
					EmailAddress: model.NewString("base"),
				}
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.MessageExportSettings.GlobalRelaySettings = &model.GlobalRelayMessageExportSettings{
					SMTPUsername: model.NewString("actual"),
					SMTPPassword: model.NewString("actual"),
					EmailAddress: model.NewString("actual"),
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "MessageExportSettings.GlobalRelaySettings.SMTPUsername",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
				{
					Path:      "MessageExportSettings.GlobalRelaySettings.SMTPPassword",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
				{
					Path:      "MessageExportSettings.GlobalRelaySettings.EmailAddress",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive ServiceSettings.GfycatAPISecret",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.GfycatAPISecret = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.GfycatAPISecret = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "ServiceSettings.GfycatAPISecret",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"sensitive ServiceSettings.SplitKey",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.SplitKey = model.NewString("base")
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.SplitKey = model.NewString("actual")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "ServiceSettings.SplitKey",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
		{
			"plugin config",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.Plugins = map[string]map[string]any{
					"com.mattermost.newplugin": {
						"key": true,
					},
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "PluginSettings.Plugins",
					BaseVal:   model.FakeSetting,
					ActualVal: model.FakeSetting,
				},
			},
			"",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			diffs, err := Diff(tc.base, tc.actual)
			if tc.err != "" {
				require.EqualError(t, err, tc.err)
				require.Nil(t, diffs)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.diffs, diffs.Sanitize())
		})
	}
}

func TestDiff(t *testing.T) {
	tcs := []struct {
		name   string
		base   *model.Config
		actual *model.Config
		diffs  ConfigDiffs
		err    string
	}{
		{
			"nil",
			nil,
			nil,
			nil,
			"input configs should not be nil",
		},
		{
			"empty",
			&model.Config{},
			&model.Config{},
			nil,
			"",
		},
		{
			"defaults",
			defaultConfigGen(),
			defaultConfigGen(),
			nil,
			"",
		},
		{
			"default base, actual empty",
			defaultConfigGen(),
			&model.Config{},
			ConfigDiffs{
				{
					Path:      "",
					BaseVal:   *defaultConfigGen(),
					ActualVal: model.Config{},
				},
			},
			"",
		},
		{
			"empty base, actual default",
			&model.Config{},
			defaultConfigGen(),
			ConfigDiffs{
				{
					Path:      "",
					BaseVal:   model.Config{},
					ActualVal: *defaultConfigGen(),
				},
			},
			"",
		},
		{
			"string change",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.SiteURL = model.NewString("http://changed")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "ServiceSettings.SiteURL",
					BaseVal:   *defaultConfigGen().ServiceSettings.SiteURL,
					ActualVal: "http://changed",
				},
			},
			"",
		},
		{
			"string nil",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.SiteURL = nil
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "ServiceSettings.SiteURL",
					BaseVal: defaultConfigGen().ServiceSettings.SiteURL,
					ActualVal: func() *string {
						return nil
					}(),
				},
			},
			"",
		},
		{
			"bool change",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.Enable = model.NewBool(!*cfg.PluginSettings.Enable)
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "PluginSettings.Enable",
					BaseVal:   true,
					ActualVal: false,
				},
			},
			"",
		},
		{
			"bool nil",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.Enable = nil
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "PluginSettings.Enable",
					BaseVal: defaultConfigGen().PluginSettings.Enable,
					ActualVal: func() *bool {
						return nil
					}(),
				},
			},
			"",
		},
		{
			"int change",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.ReadTimeout = model.NewInt(0)
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:      "ServiceSettings.ReadTimeout",
					BaseVal:   *defaultConfigGen().ServiceSettings.ReadTimeout,
					ActualVal: 0,
				},
			},
			"",
		},
		{
			"int nil",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.ServiceSettings.ReadTimeout = nil
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "ServiceSettings.ReadTimeout",
					BaseVal: defaultConfigGen().ServiceSettings.ReadTimeout,
					ActualVal: func() *int {
						return nil
					}(),
				},
			},
			"",
		},
		{
			"slice addition",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceReplicas = []string{
					"ds0",
					"ds1",
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "SqlSettings.DataSourceReplicas",
					BaseVal: defaultConfigGen().SqlSettings.DataSourceReplicas,
					ActualVal: []string{
						"ds0",
						"ds1",
					},
				},
			},
			"",
		},
		{
			"slice deletion",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceReplicas = []string{
					"ds0",
					"ds1",
				}
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceReplicas = []string{
					"ds0",
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path: "SqlSettings.DataSourceReplicas",
					BaseVal: []string{
						"ds0",
						"ds1",
					},
					ActualVal: []string{
						"ds0",
					},
				},
			},
			"",
		},
		{
			"slice nil",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceReplicas = []string{
					"ds0",
					"ds1",
				}
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.SqlSettings.DataSourceReplicas = nil
				return cfg
			}(),
			ConfigDiffs{
				{
					Path: "SqlSettings.DataSourceReplicas",
					BaseVal: []string{
						"ds0",
						"ds1",
					},
					ActualVal: func() []string {
						return nil
					}(),
				},
			},
			"",
		},
		{
			"map change",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.PluginStates["com.mattermost.nps"] = &model.PluginState{
					Enable: !cfg.PluginSettings.PluginStates["com.mattermost.nps"].Enable,
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "PluginSettings.PluginStates",
					BaseVal: defaultConfigGen().PluginSettings.PluginStates,
					ActualVal: map[string]*model.PluginState{
						"com.mattermost.nps": {
							Enable: !defaultConfigGen().PluginSettings.PluginStates["com.mattermost.nps"].Enable,
						},
						"focalboard": {
							Enable: false,
						},
						"playbooks": {
							Enable: true,
						},
						"com.mattermost.apps": {
							Enable: true,
						},
						"com.mattermost.calls": {
							Enable: true,
						},
					},
				},
			},
			"",
		},
		{
			"map addition",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.PluginStates["com.mattermost.newplugin"] = &model.PluginState{
					Enable: true,
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "PluginSettings.PluginStates",
					BaseVal: defaultConfigGen().PluginSettings.PluginStates,
					ActualVal: map[string]*model.PluginState{
						"com.mattermost.nps": {
							Enable: defaultConfigGen().PluginSettings.PluginStates["com.mattermost.nps"].Enable,
						},
						"com.mattermost.newplugin": {
							Enable: true,
						},
						"focalboard": {
							Enable: false,
						},
						"playbooks": {
							Enable: true,
						},
						"com.mattermost.apps": {
							Enable: true,
						},
						"com.mattermost.calls": {
							Enable: true,
						},
					},
				},
			},
			"",
		},
		{
			"map deletion",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				delete(cfg.PluginSettings.PluginStates, "com.mattermost.nps")
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "PluginSettings.PluginStates",
					BaseVal: defaultConfigGen().PluginSettings.PluginStates,
					ActualVal: map[string]*model.PluginState{
						"focalboard": {
							Enable: false,
						},
						"playbooks": {
							Enable: true,
						},
						"com.mattermost.apps": {
							Enable: true,
						},
						"com.mattermost.calls": {
							Enable: true,
						},
					},
				},
			},
			"",
		},
		{
			"map nil",
			defaultConfigGen(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.PluginStates = nil
				return cfg
			}(),
			ConfigDiffs{
				{
					Path:    "PluginSettings.PluginStates",
					BaseVal: defaultConfigGen().PluginSettings.PluginStates,
					ActualVal: func() map[string]*model.PluginState {
						return nil
					}(),
				},
			},
			"",
		},
		{
			"map type change",
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.Plugins = map[string]map[string]any{
					"com.mattermost.newplugin": {
						"key": true,
					},
				}
				return cfg
			}(),
			func() *model.Config {
				cfg := defaultConfigGen()
				cfg.PluginSettings.Plugins = map[string]map[string]any{
					"com.mattermost.newplugin": {
						"key": "string",
					},
				}
				return cfg
			}(),
			ConfigDiffs{
				{
					Path: "PluginSettings.Plugins",
					BaseVal: func() any {
						return map[string]map[string]any{
							"com.mattermost.newplugin": {
								"key": true,
							},
						}
					}(),
					ActualVal: func() any {
						return map[string]map[string]any{
							"com.mattermost.newplugin": {
								"key": "string",
							},
						}
					}(),
				},
			},
			"",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			diffs, err := Diff(tc.base, tc.actual)
			if tc.err != "" {
				require.EqualError(t, err, tc.err)
				require.Nil(t, diffs)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.diffs, diffs)
		})
	}
}
