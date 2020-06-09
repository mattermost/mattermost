// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
)

func setupConfigMemory(t *testing.T) {
	t.Helper()
	os.Clearenv()
}

func TestMemoryStoreNew(t *testing.T) {
	t.Run("no existing configuration - initialization required", func(t *testing.T) {
		ms, err := config.NewMemoryStore()
		require.NoError(t, err)
		defer ms.Close()

		assert.Equal(t, "", *ms.Get().ServiceSettings.SiteURL)
	})

	t.Run("existing config, initialization required", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: testConfig})
		require.NoError(t, err)
		defer ms.Close()

		assert.Equal(t, "http://TestStoreNew", *ms.Get().ServiceSettings.SiteURL)
	})

	t.Run("already minimally configured", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: minimalConfig})
		require.NoError(t, err)
		defer ms.Close()

		assert.Equal(t, "http://minimal", *ms.Get().ServiceSettings.SiteURL)
	})

	t.Run("invalid config, validation enabled", func(t *testing.T) {
		_, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: invalidConfig})
		require.Error(t, err)
	})

	t.Run("invalid config, validation disabled", func(t *testing.T) {
		_, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: invalidConfig, SkipValidation: true})
		require.NoError(t, err)
	})
}

func TestMemoryStoreGet(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: testConfig})
	require.NoError(t, err)
	defer ms.Close()

	cfg := ms.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	cfg2 := ms.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	assert.True(t, cfg == cfg2, "Get() returned different configuration instances")

	newCfg := &model.Config{}
	oldCfg, err := ms.Set(newCfg)
	require.NoError(t, err)

	assert.True(t, oldCfg == cfg, "returned config after set() changed original")
	assert.False(t, newCfg == cfg, "returned config should have been different from original")
}

func TestMemoryStoreGetEnivironmentOverrides(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: testConfig})
	require.NoError(t, err)
	defer ms.Close()

	assert.Equal(t, "http://TestStoreNew", *ms.Get().ServiceSettings.SiteURL)
	assert.Empty(t, ms.GetEnvironmentOverrides())

	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

	ms, err = config.NewMemoryStore()
	require.NoError(t, err)
	defer ms.Close()

	assert.Equal(t, "http://override", *ms.Get().ServiceSettings.SiteURL)
	assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, ms.GetEnvironmentOverrides())
}

func TestMemoryStoreSet(t *testing.T) {
	t.Run("set same pointer value", func(t *testing.T) {
		t.Skip("not yet implemented")

		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: emptyConfig})
		require.NoError(t, err)
		defer ms.Close()

		_, err = ms.Set(ms.Get())
		if assert.Error(t, err) {
			assert.EqualError(t, err, "old configuration modified instead of cloning")
		}
	})

	t.Run("defaults required", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: minimalConfig})
		require.NoError(t, err)
		defer ms.Close()

		oldCfg := ms.Get()

		newCfg := &model.Config{}

		retCfg, err := ms.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		assert.Equal(t, "", *ms.Get().ServiceSettings.SiteURL)
	})

	t.Run("desanitization required", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: ldapConfig})
		require.NoError(t, err)
		defer ms.Close()

		oldCfg := ms.Get()

		newCfg := &model.Config{}
		newCfg.LdapSettings.BindPassword = sToP(model.FAKE_SETTING)

		retCfg, err := ms.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		assert.Equal(t, "password", *ms.Get().LdapSettings.BindPassword)
	})

	t.Run("invalid", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: emptyConfig})
		require.NoError(t, err)
		defer ms.Close()

		newCfg := &model.Config{}
		newCfg.ServiceSettings.SiteURL = sToP("invalid")

		_, err = ms.Set(newCfg)
		if assert.Error(t, err) {
			assert.EqualError(t, err, "new configuration is invalid: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}

		assert.Equal(t, "", *ms.Get().ServiceSettings.SiteURL)
	})

	t.Run("read-only ignored", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: readOnlyConfig})
		require.NoError(t, err)
		defer ms.Close()

		newCfg := &model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: sToP("http://new"),
			},
		}

		_, err = ms.Set(newCfg)
		require.NoError(t, err)

		assert.Equal(t, "http://new", *ms.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notified", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: emptyConfig})
		require.NoError(t, err)
		defer ms.Close()

		oldCfg := ms.Get()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		ms.AddListener(callback)

		newCfg := &model.Config{}

		retCfg, err := ms.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config written")
	})
}

func TestMemoryStoreLoad(t *testing.T) {
	t.Run("honour environment", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: minimalConfig})
		require.NoError(t, err)
		defer ms.Close()

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		err = ms.Load()
		require.NoError(t, err)
		assert.Equal(t, "http://override", *ms.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, ms.GetEnvironmentOverrides())
	})

	t.Run("fixes required", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: fixesRequiredConfig})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.Load()
		require.NoError(t, err)
		assert.Equal(t, "http://trailingslash", *ms.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notifed", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: emptyConfig})
		require.NoError(t, err)
		defer ms.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		ms.AddListener(callback)

		err = ms.Load()
		require.NoError(t, err)

		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config loaded")
	})
}

func TestMemoryGetFile(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
		InitialConfig: minimalConfig,
		InitialFiles: map[string][]byte{
			"empty-file": {},
			"test-file":  []byte("test"),
		},
	})
	require.NoError(t, err)
	defer ms.Close()

	t.Run("get empty filename", func(t *testing.T) {
		_, err := ms.GetFile("")
		require.Error(t, err)
	})

	t.Run("get non-existent file", func(t *testing.T) {
		_, err := ms.GetFile("unknown")
		require.Error(t, err)
	})

	t.Run("get empty file", func(t *testing.T) {
		data, err := ms.GetFile("empty-file")
		require.NoError(t, err)
		require.Empty(t, data)
	})

	t.Run("get non-empty file", func(t *testing.T) {
		data, err := ms.GetFile("test-file")
		require.NoError(t, err)
		require.Equal(t, []byte("test"), data)
	})
}

func TestMemorySetFile(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
		InitialConfig: minimalConfig,
	})
	require.NoError(t, err)
	defer ms.Close()

	t.Run("set new file", func(t *testing.T) {
		err := ms.SetFile("new", []byte("new file"))
		require.NoError(t, err)

		data, err := ms.GetFile("new")
		require.NoError(t, err)
		require.Equal(t, []byte("new file"), data)
	})

	t.Run("overwrite existing file", func(t *testing.T) {
		err := ms.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = ms.SetFile("existing", []byte("overwritten file"))
		require.NoError(t, err)

		data, err := ms.GetFile("existing")
		require.NoError(t, err)
		require.Equal(t, []byte("overwritten file"), data)
	})
}

func TestMemoryHasFile(t *testing.T) {
	t.Run("has non-existent", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		has, err := ms.HasFile("non-existent")
		require.NoError(t, err)
		require.False(t, has)
	})

	t.Run("has existing", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		has, err := ms.HasFile("existing")
		require.NoError(t, err)
		require.True(t, has)
	})

	t.Run("has manually created file", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
			InitialFiles: map[string][]byte{
				"manual": []byte("manual file"),
			},
		})
		require.NoError(t, err)
		defer ms.Close()

		has, err := ms.HasFile("manual")
		require.NoError(t, err)
		require.True(t, has)
	})
}

func TestMemoryRemoveFile(t *testing.T) {
	t.Run("remove non-existent", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.RemoveFile("non-existent")
		require.NoError(t, err)
	})

	t.Run("remove existing", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = ms.RemoveFile("existing")
		require.NoError(t, err)

		has, err := ms.HasFile("existing")
		require.NoError(t, err)
		require.False(t, has)

		_, err = ms.GetFile("existing")
		require.Error(t, err)
	})

	t.Run("remove manually created file", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
			InitialFiles: map[string][]byte{
				"manual": []byte("manual file"),
			},
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.RemoveFile("manual")
		require.NoError(t, err)

		has, err := ms.HasFile("manual")
		require.NoError(t, err)
		require.False(t, has)

		_, err = ms.GetFile("manual")
		require.Error(t, err)
	})
}

func TestMemoryStoreString(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: emptyConfig})
	require.NoError(t, err)
	defer ms.Close()

	assert.Equal(t, "memory://", ms.String())
}
