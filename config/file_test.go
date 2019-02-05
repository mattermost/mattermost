// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config_test

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

var emptyConfig = []byte(`{}`)
var readOnlyConfig = []byte(`{"ClusterSettings":{"Enable":true,"ReadOnlyConfig":true}}`)
var minimalConfig = []byte(`{"ServiceSettings":{"SiteURL":"http://minimal"},"SqlSettings":{"AtRestEncryptKey":"abcdefghijklmnopqrstuvwxyz0123456789"},"FileSettings":{"PublicLinkSalt":"abcdefghijklmnopqrstuvwxyz0123456789"},"EmailSettings":{"InviteSalt":"abcdefghijklmnopqrstuvwxyz0123456789"},"LocalizationSettings":{"DefaultServerLocale":"en","DefaultClientLocale":"en"}}`)
var invalidConfig = []byte(`{"ServiceSettings":{"SiteURL":"invalid"}}`)

func setupConfigFile(t *testing.T, cfgData []byte) (string, func()) {
	os.Clearenv()
	t.Helper()

	tempDir, err := ioutil.TempDir("", "setupConfigFile")
	require.NoError(t, err)

	f, err := ioutil.TempFile(tempDir, "setupConfigFile")
	require.NoError(t, err)
	ioutil.WriteFile(f.Name(), cfgData, 0644)

	return f.Name(), func() {
		defer os.RemoveAll(tempDir)
	}
}

func TestFileStoreNew(t *testing.T) {
	utils.TranslationsPreInit()

	var testConfig = []byte(`{"ServiceSettings":{"SiteURL":"http://TestFileStoreNew"}}`)

	t.Run("absolute path", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fs, needsSave, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://TestFileStoreNew", *fs.Get().ServiceSettings.SiteURL)
		assert.True(t, needsSave)
	})

	t.Run("absolute path, already minimally configured", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, needsSave, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://minimal", *fs.Get().ServiceSettings.SiteURL)
		assert.False(t, needsSave)
	})

	t.Run("absolute path, cannot be read", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		os.Chmod(path, 0200)

		_, _, err := config.NewFileStore(path, false)
		if assert.Error(t, err) {
			assert.True(t, strings.HasPrefix(err.Error(), "failed to open"))
		}
	})

	t.Run("relative path, file exists", func(t *testing.T) {
		os.Clearenv()
		tempDir, err := ioutil.TempDir("", "TestFileStoreNew")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		cwd := filepath.Join(tempDir, "a", "b")
		err = os.MkdirAll(filepath.Join(cwd, "c"), 0700)
		require.NoError(t, err)
		err = os.Chdir(cwd)
		require.NoError(t, err)

		ioutil.WriteFile("c/config.json", testConfig, 0644)

		fs, needsSave, err := config.NewFileStore("c/config.json", false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://TestFileStoreNew", *fs.Get().ServiceSettings.SiteURL)
		assert.True(t, needsSave)
	})

	t.Run("relative path, file does not exist", func(t *testing.T) {
		os.Clearenv()
		tempDir, err := ioutil.TempDir("", "TestFileStoreNew")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		cwd := filepath.Join(tempDir, "a", "b")
		err = os.MkdirAll(filepath.Join(cwd, "c"), 0700)
		require.NoError(t, err)
		err = os.Chdir(cwd)
		require.NoError(t, err)

		fs, needsSave, err := config.NewFileStore("c/config.json", false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
		assert.True(t, needsSave)
	})
}

func TestFileStoreGet(t *testing.T) {
	var testConfig = []byte(`{"ServiceSettings":{"SiteURL":"http://TestFileStoreNew"}}`)

	path, tearDown := setupConfigFile(t, testConfig)
	defer tearDown()

	fs, _, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	cfg := fs.Get()
	assert.Equal(t, "http://TestFileStoreNew", *cfg.ServiceSettings.SiteURL)

	cfg2 := fs.Get()
	assert.Equal(t, "http://TestFileStoreNew", *cfg.ServiceSettings.SiteURL)

	assert.True(t, cfg == cfg2, "Get() returned different configuration instances")

	newCfg := &model.Config{}
	oldCfg, err := fs.Set(newCfg)

	assert.True(t, oldCfg == cfg, "returned config after set() changed original")
	assert.False(t, newCfg == cfg, "returned config should have been different from original")
}

func TestFileStoreGetEnivironmentOverrides(t *testing.T) {
	var testConfig = []byte(`{"ServiceSettings":{"SiteURL":"http://TestFileStoreNew"}}`)

	path, tearDown := setupConfigFile(t, testConfig)
	defer tearDown()

	fs, _, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	assert.Equal(t, "http://TestFileStoreNew", *fs.Get().ServiceSettings.SiteURL)
	assert.Empty(t, fs.GetEnvironmentOverrides())

	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")

	fs, _, err = config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	assert.Equal(t, "http://override", *fs.Get().ServiceSettings.SiteURL)
	assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, fs.GetEnvironmentOverrides())
}

func TestFileStoreSet(t *testing.T) {
	t.Run("set same pointer value", func(t *testing.T) {
		t.Skip("not yet implemented")

		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		_, err = fs.Set(fs.Get())
		if assert.Error(t, err) {
			assert.EqualError(t, err, "old configuration modified instead of cloning")
		}
	})

	t.Run("defaults required", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		oldCfg := fs.Get()

		newCfg := &model.Config{}

		retCfg, err := fs.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("desanitization required", func(t *testing.T) {
		var ldapConfig = []byte(`{"LdapSettings":{"BindPassword":"password"}}`)

		path, tearDown := setupConfigFile(t, ldapConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		oldCfg := fs.Get()

		newCfg := &model.Config{}
		newCfg.LdapSettings.BindPassword = sToP(model.FAKE_SETTING)

		retCfg, err := fs.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		assert.Equal(t, "password", *fs.Get().LdapSettings.BindPassword)
	})

	t.Run("invalid", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		newCfg := &model.Config{}
		newCfg.ServiceSettings.SiteURL = sToP("invalid")

		_, err = fs.Set(newCfg)
		if assert.Error(t, err) {
			assert.EqualError(t, err, "new configuration is invalid: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("read-only", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, readOnlyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		newCfg := &model.Config{}

		_, err = fs.Set(newCfg)
		if assert.Error(t, err) {
			assert.Equal(t, err, config.ReadOnlyConfigurationError)
		}

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("persist failed", func(t *testing.T) {
		t.Skip("skipping persistence test inside Set")
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		os.Chmod(path, 0500)

		newCfg := &model.Config{}

		_, err = fs.Set(newCfg)
		if assert.Error(t, err) {
			assert.True(t, strings.HasPrefix(err.Error(), "failed to persist: failed to write file"))
		}

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notified", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		oldCfg := fs.Get()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		newCfg := &model.Config{}

		retCfg, err := fs.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config written")
		}
	})

	t.Run("watcher restarted", func(t *testing.T) {
		if testing.Short() {
			t.Skip("skipping watcher test in short mode")
		}

		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		_, err = fs.Set(&model.Config{})
		require.NoError(t, err)

		// Let the initial call to invokeConfigListeners finish.
		time.Sleep(1 * time.Second)

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		// Rewrite the config to the file on disk
		ioutil.WriteFile(path, emptyConfig, 0644)
		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config written")
		}
	})
}

func TestFileStorePatch(t *testing.T) {
	path, tearDown := setupConfigFile(t, emptyConfig)
	defer tearDown()

	fs, _, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	assert.Panics(t, func() {
		fs.Patch(&model.Config{})
	})
}

func TestFileStoreLoad(t *testing.T) {
	t.Run("file no longer exists", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		os.Remove(path)

		needsSave, err := fs.Load()
		require.NoError(t, err)
		require.True(t, needsSave)
	})

	t.Run("file cannot be read", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		os.Chmod(path, 0200)

		_, err = fs.Load()
		if assert.Error(t, err) {
			assert.True(t, strings.HasPrefix(err.Error(), "failed to open"))
		}
	})

	t.Run("honour environment", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")

		_, err = fs.Load()
		require.NoError(t, err)
		assert.Equal(t, "http://override", *fs.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("invalid", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		ioutil.WriteFile(path, invalidConfig, 0644)

		_, err = fs.Load()
		if assert.Error(t, err) {
			assert.EqualError(t, err, "invalid config: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}
	})

	t.Run("fixes required", func(t *testing.T) {
		var trailingSlashConfig = []byte(`{"ServiceSettings":{"SiteURL":"http://trailingslash/"},"SqlSettings":{"AtRestEncryptKey":"abcdefghijklmnopqrstuvwxyz0123456789"},"FileSettings":{"PublicLinkSalt":"abcdefghijklmnopqrstuvwxyz0123456789"},"EmailSettings":{"InviteSalt":"abcdefghijklmnopqrstuvwxyz0123456789"},"LocalizationSettings":{"DefaultServerLocale":"en","DefaultClientLocale":"en"}}`)

		path, tearDown := setupConfigFile(t, trailingSlashConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		needsSave, err := fs.Load()
		require.NoError(t, err)
		assert.True(t, needsSave)
		assert.Equal(t, "http://trailingslash", *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notifed", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		_, err = fs.Load()
		require.NoError(t, err)

		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config loaded")
		}
	})
}

func TestFileStoreWatcherEmitter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping watcher test in short mode")
	}

	t.Parallel()

	path, tearDown := setupConfigFile(t, emptyConfig)
	defer tearDown()

	t.Run("disabled", func(t *testing.T) {
		fs, _, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		// Let the initial call to invokeConfigListeners finish.
		time.Sleep(1 * time.Second)

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		// Rewrite the config to the file on disk
		ioutil.WriteFile(path, emptyConfig, 0644)
		select {
		case <-called:
			t.Fatal("callback should not have been called since watching disabled")
		case <-time.After(1 * time.Second):
		}
	})

	t.Run("enabled", func(t *testing.T) {
		fs, _, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		// Rewrite the config to the file on disk
		ioutil.WriteFile(path, emptyConfig, 0644)
		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config written")
		}
	})
}

func TestFileStoreString(t *testing.T) {
	path, tearDown := setupConfigFile(t, emptyConfig)
	defer tearDown()

	fs, _, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	assert.Equal(t, "file://"+path, fs.String())
}
