// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

var emptyConfig, readOnlyConfig, minimalConfig, invalidConfig, fixesRequiredConfig, ldapConfig, testConfig *model.Config

func init() {
	emptyConfig = &model.Config{}
	readOnlyConfig = &model.Config{
		ClusterSettings: model.ClusterSettings{
			Enable:         bToP(true),
			ReadOnlyConfig: bToP(true),
		},
	}
	minimalConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://minimal"),
		},
		SqlSettings: model.SqlSettings{
			AtRestEncryptKey: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		FileSettings: model.FileSettings{
			PublicLinkSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		LocalizationSettings: model.LocalizationSettings{
			DefaultServerLocale: sToP("en"),
			DefaultClientLocale: sToP("en"),
		},
	}
	minimalConfig.SetDefaults()
	invalidConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("invalid"),
		},
	}
	fixesRequiredConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://trailingslash/"),
		},
		SqlSettings: model.SqlSettings{
			AtRestEncryptKey: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		FileSettings: model.FileSettings{
			DriverName:     sToP(model.IMAGE_DRIVER_LOCAL),
			Directory:      sToP("/path/to/directory"),
			PublicLinkSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		LocalizationSettings: model.LocalizationSettings{
			DefaultServerLocale: sToP("garbage"),
			DefaultClientLocale: sToP("garbage"),
		},
	}
	ldapConfig = &model.Config{
		LdapSettings: model.LdapSettings{
			BindPassword: sToP("password"),
		},
	}
	testConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://TestStoreNew"),
		},
	}
}

func TestMergeConfigs(t *testing.T) {
	t.Run("merge two default configs with different salts/keys", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := &model.Config{}
		patch.SetDefaults()

		merged, err := config.Merge(base, patch, nil)
		require.NoError(t, err)

		assert.Equal(t, patch, merged)
	})
	t.Run("merge identical configs", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := base.Clone()

		merged, err := config.Merge(base, patch, nil)
		require.NoError(t, err)

		assert.Equal(t, base, merged)
		assert.Equal(t, patch, merged)
	})
	t.Run("merge configs with a different setting", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := base.Clone()
		patch.ServiceSettings.SiteURL = newString("http://newhost.ca")

		merged, err := config.Merge(base, patch, nil)
		require.NoError(t, err)

		assert.NotEqual(t, base, merged)
		assert.Equal(t, patch, merged)
	})
	t.Run("merge default config with changes from a mostly nil patch", func(t *testing.T) {
		base := &model.Config{}
		base.SetDefaults()
		patch := &model.Config{}
		patch.ServiceSettings.SiteURL = newString("http://newhost.ca")
		patch.GoogleSettings.Enable = newBool(true)

		expected := base.Clone()
		expected.ServiceSettings.SiteURL = newString("http://newhost.ca")
		expected.GoogleSettings.Enable = newBool(true)

		merged, err := config.Merge(base, patch, nil)
		require.NoError(t, err)

		assert.NotEqual(t, base, merged)
		assert.NotEqual(t, patch, merged)
		assert.Equal(t, expected, merged)
	})
}

func TestConfigEnvironmentOverrides(t *testing.T) {
	memstore, err := config.NewMemoryStore()
	require.NoError(t, err)
	base, err := config.NewStoreFromBacking(memstore)
	require.NoError(t, err)
	originalConfig := &model.Config{}
	originalConfig.ServiceSettings.SiteURL = newString("http://notoverriden.ca")

	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://overridden.ca")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

	t.Run("loading config should respect environment variable overrides", func(t *testing.T) {
		err := base.Load()
		require.NoError(t, err)

		assert.Equal(t, "http://overridden.ca", *base.Get().ServiceSettings.SiteURL)
	})

	t.Run("setting config should respect environment variable overrides", func(t *testing.T) {
		_, err := base.Set(originalConfig)
		require.NoError(t, err)

		assert.Equal(t, "http://overridden.ca", *base.Get().ServiceSettings.SiteURL)
	})
}

func TestRemoveEnvironmentOverrides(t *testing.T) {
	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://overridden.ca")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

	memstore, err := config.NewMemoryStore()
	require.NoError(t, err)
	base, err := config.NewStoreFromBacking(memstore)
	require.NoError(t, err)
	oldCfg := base.Get()
	assert.Equal(t, "http://overridden.ca", *oldCfg.ServiceSettings.SiteURL)
	newCfg := base.RemoveEnvironmentOverrides(oldCfg)
	assert.Equal(t, "", *newCfg.ServiceSettings.SiteURL)
}

func newBool(b bool) *bool       { return &b }
func newString(s string) *string { return &s }
