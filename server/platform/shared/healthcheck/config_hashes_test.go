// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func defaultConfig() *model.Config {
	cfg := &model.Config{}
	cfg.SetDefaults()
	return cfg
}

// changedSections lists the sections whose hash differs between the two configs.
func changedSections(t *testing.T, a, b *model.Config) []string {
	t.Helper()

	hashesA, hashesB := ConfigSectionHashes(a), ConfigSectionHashes(b)
	require.Equal(t, len(hashesA), len(hashesB))

	var changed []string
	for section, hash := range hashesA {
		if hashesB[section] != hash {
			changed = append(changed, section)
		}
	}
	return changed
}

func TestConfigSectionHashes(t *testing.T) {
	t.Parallel()

	t.Run("covers every section", func(t *testing.T) {
		t.Parallel()

		hashes := ConfigSectionHashes(defaultConfig())
		for _, section := range []string{"ServiceSettings", "TeamSettings", "SqlSettings", "FileSettings", "PluginSettings", "FeatureFlags"} {
			assert.Len(t, hashes[section], configSectionHashLength, section)
		}
	})

	t.Run("equal configs hash equally", func(t *testing.T) {
		t.Parallel()

		assert.Equal(t, ConfigSectionHashes(defaultConfig()), ConfigSectionHashes(defaultConfig()))
	})

	t.Run("a setting changes only its own section", func(t *testing.T) {
		t.Parallel()

		changed := defaultConfig()
		*changed.TeamSettings.SiteName = "Drifted"
		assert.Equal(t, []string{"TeamSettings"}, changedSections(t, defaultConfig(), changed))
	})

	t.Run("server-only settings count", func(t *testing.T) {
		t.Parallel()

		changed := defaultConfig()
		*changed.FileSettings.MaxFileSize++
		assert.Equal(t, []string{"FileSettings"}, changedSections(t, defaultConfig(), changed))
	})

	t.Run("plugin settings count", func(t *testing.T) {
		t.Parallel()

		a, b := defaultConfig(), defaultConfig()
		a.PluginSettings.Plugins["com.example.plugin"] = map[string]any{"b": 1, "a": "x"}
		b.PluginSettings.Plugins["com.example.plugin"] = map[string]any{"a": "x", "b": 1}
		assert.Empty(t, changedSections(t, a, b), "map order does not matter")

		b.PluginSettings.Plugins["com.example.plugin"]["b"] = 2
		assert.Equal(t, []string{"PluginSettings"}, changedSections(t, a, b))
	})

	t.Run("node-local settings are left out", func(t *testing.T) {
		t.Parallel()

		changed := defaultConfig()
		*changed.JobSettings.RunJobs = !*changed.JobSettings.RunJobs
		*changed.JobSettings.RunScheduler = !*changed.JobSettings.RunScheduler
		*changed.ClusterSettings.OverrideHostname = "app-2"
		*changed.ClusterSettings.NetworkInterface = "eth1"
		*changed.ClusterSettings.BindAddress = "10.0.0.2"
		*changed.ClusterSettings.AdvertiseAddress = "10.0.0.2"
		*changed.ServiceSettings.ListenAddress = ":8066"
		*changed.MetricsSettings.ListenAddress = ":8068"
		assert.Empty(t, changedSections(t, defaultConfig(), changed))
	})

	t.Run("the config is not modified", func(t *testing.T) {
		t.Parallel()

		cfg := defaultConfig()
		*cfg.JobSettings.RunJobs = false
		ConfigSectionHashes(cfg)
		assert.False(t, *cfg.JobSettings.RunJobs)
	})

	t.Run("nil config", func(t *testing.T) {
		t.Parallel()

		assert.Nil(t, ConfigSectionHashes(nil))
	})
}

// TestNodeLocalConfigPathsResolve catches a path that no longer names a setting, for example
// after a rename, which would otherwise silently start counting as drift.
func TestNodeLocalConfigPathsResolve(t *testing.T) {
	t.Parallel()

	cfg := defaultConfig()
	for _, path := range NodeLocalConfigPaths {
		_, ok := configField(cfg, path)
		assert.True(t, ok, path)
	}
}
