// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// packetConfig returns a sanitized default config shaped as nodes send it and packets store it,
// changed by mutate after sanitizing.
func packetConfig(mutate func(*model.Config)) *model.SupportPacketConfig {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.Sanitize(nil, nil)
	if mutate != nil {
		mutate(cfg)
	}
	return &model.SupportPacketConfig{Config: cfg, FeatureFlags: *cfg.FeatureFlags}
}

// overJSON returns cfg as a receiving node or the packet reader decodes it.
func overJSON(t *testing.T, cfg *model.SupportPacketConfig) *model.SupportPacketConfig {
	t.Helper()

	data, err := json.Marshal(cfg)
	require.NoError(t, err)
	var decoded model.SupportPacketConfig
	require.NoError(t, json.Unmarshal(data, &decoded))
	return &decoded
}

func differing(a, b *model.SupportPacketConfig) []string {
	paths := map[string]bool{}
	DifferingSettings(paths, FlattenConfig(a), FlattenConfig(b))
	return SortedSettings(paths)
}

func TestFlattenConfig(t *testing.T) {
	t.Parallel()

	t.Run("settings are keyed by path", func(t *testing.T) {
		t.Parallel()

		settings := FlattenConfig(packetConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "Drifted" }))
		assert.Equal(t, `"Drifted"`, settings["TeamSettings.SiteName"])
		assert.Contains(t, settings, "SqlSettings.MaxOpenConns")
		assert.Contains(t, settings, "FeatureFlags.TestFeature")
	})

	t.Run("a config decoded from JSON flattens like the one sent", func(t *testing.T) {
		t.Parallel()

		cfg := packetConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["com.example.plugin"] = map[string]any{"count": 3, "name": "x"}
		})
		decoded := overJSON(t, cfg)
		require.Nil(t, decoded.Config.FeatureFlags, "SupportPacketConfig's own FeatureFlags hides the embedded one")
		assert.Equal(t, FlattenConfig(cfg), FlattenConfig(decoded))
	})

	t.Run("one changed setting is the only difference", func(t *testing.T) {
		t.Parallel()

		drifted := packetConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize++ })
		assert.Equal(t, []string{"FileSettings.MaxFileSize"}, differing(packetConfig(nil), drifted))
	})

	t.Run("feature flags count", func(t *testing.T) {
		t.Parallel()

		drifted := packetConfig(nil)
		drifted.FeatureFlags.TestFeature = "on"
		assert.Equal(t, []string{"FeatureFlags.TestFeature"}, differing(packetConfig(nil), overJSON(t, drifted)))
	})

	t.Run("plugin settings count, in any key order", func(t *testing.T) {
		t.Parallel()

		a := packetConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["com.example.plugin"] = map[string]any{"b": 1, "a": "x"}
		})
		b := packetConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["com.example.plugin"] = map[string]any{"a": "x", "b": 1}
		})
		assert.Empty(t, differing(a, b))

		b.PluginSettings.Plugins["com.example.plugin"]["b"] = 2
		assert.Equal(t, []string{"PluginSettings.Plugins.com.example.plugin.b"}, differing(a, b))
	})

	t.Run("a setting only one node has differs", func(t *testing.T) {
		t.Parallel()

		withPlugin := packetConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["com.example.plugin"] = map[string]any{"enabled": true}
		})
		assert.Equal(t, []string{"PluginSettings.Plugins.com.example.plugin.enabled"}, differing(packetConfig(nil), withPlugin))
	})

	t.Run("a plugin without settings matches one without an entry", func(t *testing.T) {
		t.Parallel()

		withPlugin := packetConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["com.example.plugin"] = map[string]any{}
		})
		assert.Empty(t, differing(packetConfig(nil), withPlugin))
	})

	t.Run("node-local settings are left out", func(t *testing.T) {
		t.Parallel()

		drifted := packetConfig(func(cfg *model.Config) {
			*cfg.JobSettings.RunJobs = !*cfg.JobSettings.RunJobs
			*cfg.JobSettings.RunScheduler = !*cfg.JobSettings.RunScheduler
			*cfg.ClusterSettings.OverrideHostname = "app-2"
			*cfg.ClusterSettings.NetworkInterface = "eth1"
			*cfg.ClusterSettings.BindAddress = "10.0.0.2"
			*cfg.ClusterSettings.AdvertiseAddress = "10.0.0.2"
			*cfg.ServiceSettings.ListenAddress = ":8066"
			*cfg.MetricsSettings.ListenAddress = ":8068"
		})
		assert.Empty(t, differing(packetConfig(nil), drifted))
	})

	t.Run("secret values do not count, whether one is set does", func(t *testing.T) {
		t.Parallel()

		secret := func(value string) *model.SupportPacketConfig {
			cfg := &model.Config{}
			cfg.SetDefaults()
			*cfg.EmailSettings.SMTPPassword = value
			*cfg.CacheSettings.RedisPassword = value
			*cfg.ElasticsearchSettings.Password = value
			*cfg.ServiceSettings.SplitKey = value
			cfg.Sanitize(nil, nil)
			return &model.SupportPacketConfig{Config: cfg, FeatureFlags: *cfg.FeatureFlags}
		}
		assert.Empty(t, differing(secret("one"), secret("two")))
		assert.Equal(t, []string{
			"CacheSettings.RedisPassword",
			"ElasticsearchSettings.Password",
			"EmailSettings.SMTPPassword",
			"ServiceSettings.SplitKey",
		}, differing(secret(""), secret("one")))
	})

	t.Run("no config", func(t *testing.T) {
		t.Parallel()

		assert.Nil(t, FlattenConfig(nil))
		assert.Nil(t, FlattenConfig(&model.SupportPacketConfig{}))
	})
}

// TestNodeLocalConfigPathsResolve catches a path that no longer names a setting, for example
// after a rename, which would otherwise silently start counting as drift.
func TestNodeLocalConfigPathsResolve(t *testing.T) {
	t.Parallel()

	cfg := packetConfig(nil)
	cfg.Config.FeatureFlags = nil
	data, err := json.Marshal(cfg)
	require.NoError(t, err)
	var tree map[string]any
	require.NoError(t, json.Unmarshal(data, &tree))
	all := map[string]string{}
	flattenSetting(all, "", tree)

	for _, path := range NodeLocalConfigPaths {
		assert.Contains(t, all, path)
	}
}

func TestConfigKey(t *testing.T) {
	t.Parallel()

	assert.Equal(t, ConfigKey(FlattenConfig(packetConfig(nil))), ConfigKey(FlattenConfig(packetConfig(nil))))
	assert.NotEqual(t, ConfigKey(map[string]string{"a": "1"}), ConfigKey(map[string]string{"a": "2"}))
}
