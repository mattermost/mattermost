// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

var emptyConfig, readOnlyConfig, minimalConfig, minimalConfigNoFF, invalidConfig, fixesRequiredConfig, ldapConfig, testConfig, customConfigDefaults *model.Config

func init() {
	emptyConfig = &model.Config{}
	readOnlyConfig = &model.Config{
		ClusterSettings: model.ClusterSettings{
			Enable:         new(true),
			ReadOnlyConfig: new(true),
		},
	}
	minimalConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: new("http://minimal"),
		},
		SqlSettings: model.SqlSettings{
			AtRestEncryptKey: new("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		FileSettings: model.FileSettings{
			PublicLinkSalt: new("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		LocalizationSettings: model.LocalizationSettings{
			DefaultServerLocale: new("en"),
			DefaultClientLocale: new("en"),
		},
	}

	minimalConfig.SetDefaults()

	minimalConfigNoFF = minimalConfig.Clone()
	minimalConfigNoFF.FeatureFlags = nil

	invalidConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: new("invalid"),
		},
	}
	fixesRequiredConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: new("http://trailingslash/"),
		},
		SqlSettings: model.SqlSettings{
			AtRestEncryptKey: new("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		FileSettings: model.FileSettings{
			DriverName:     model.NewPointer(model.ImageDriverLocal),
			Directory:      new("/path/to/directory"),
			PublicLinkSalt: new("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		LocalizationSettings: model.LocalizationSettings{
			DefaultServerLocale: new("garbage"),
			DefaultClientLocale: new("garbage"),
		},
	}
	ldapConfig = &model.Config{
		LdapSettings: model.LdapSettings{
			BindPassword: new("password"),
		},
	}
	testConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: new("http://TestStoreNew"),
		},
	}
	customConfigDefaults = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: new("http://custom.com"),
		},
	}
}

func TestMergeConfigs(t *testing.T) {
	t.Run("merge two default configs with different salts/keys", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := &model.Config{}
		patch.SetDefaults()

		merged, err := Merge(base, patch, nil)
		require.NoError(t, err)

		assert.Equal(t, patch, merged)
	})
	t.Run("merge identical configs", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := base.Clone()

		merged, err := Merge(base, patch, nil)
		require.NoError(t, err)

		assert.Equal(t, base, merged)
		assert.Equal(t, patch, merged)
	})
	t.Run("merge configs with a different setting", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := base.Clone()
		patch.ServiceSettings.SiteURL = new("http://newhost.ca")

		merged, err := Merge(base, patch, nil)
		require.NoError(t, err)

		assert.NotEqual(t, base, merged)
		assert.Equal(t, patch, merged)
	})
	t.Run("merge default config with changes from a mostly nil patch", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := &model.Config{}
		patch.ServiceSettings.SiteURL = new("http://newhost.ca")
		patch.GoogleSettings.Enable = new(true)

		expected := base.Clone()
		expected.ServiceSettings.SiteURL = new("http://newhost.ca")
		expected.GoogleSettings.Enable = new(true)

		merged, err := Merge(base, patch, nil)
		require.NoError(t, err)

		assert.NotEqual(t, base, merged)
		assert.NotEqual(t, patch, merged)
		assert.Equal(t, expected, merged)
	})
}

func TestConfigEnvironmentOverrides(t *testing.T) {
	memstore, err := NewMemoryStore()
	require.NoError(t, err)
	base, err := NewStoreFromBacking(memstore, nil, false)
	require.NoError(t, err)
	originalConfig := &model.Config{}
	originalConfig.ServiceSettings.SiteURL = new("http://notoverridden.ca")

	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://overridden.ca")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

	t.Run("loading config should respect environment variable overrides", func(t *testing.T) {
		err := base.Load()
		require.NoError(t, err)

		assert.Equal(t, "http://overridden.ca", *base.Get().ServiceSettings.SiteURL)
	})

	t.Run("setting config should respect environment variable overrides", func(t *testing.T) {
		_, _, err := base.Set(originalConfig)
		require.NoError(t, err)

		assert.Equal(t, "http://overridden.ca", *base.Get().ServiceSettings.SiteURL)
	})
}

func TestRemoveEnvironmentOverrides(t *testing.T) {
	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://overridden.ca")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

	memstore, err := NewMemoryStore()
	require.NoError(t, err)
	base, err := NewStoreFromBacking(memstore, nil, false)
	require.NoError(t, err)
	oldCfg := base.Get()
	assert.Equal(t, "http://overridden.ca", *oldCfg.ServiceSettings.SiteURL)
	newCfg := base.RemoveEnvironmentOverrides(oldCfg)
	assert.Equal(t, "", *newCfg.ServiceSettings.SiteURL)
}
