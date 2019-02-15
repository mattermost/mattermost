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

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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
		EmailSettings: model.EmailSettings{
			InviteSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		LocalizationSettings: model.LocalizationSettings{
			DefaultServerLocale: sToP("en"),
			DefaultClientLocale: sToP("en"),
		},
	}
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
		EmailSettings: model.EmailSettings{
			InviteSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
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

func setupConfigFile(t *testing.T, cfg *model.Config) (string, func()) {
	os.Clearenv()
	t.Helper()

	tempDir, err := ioutil.TempDir("", "setupConfigFile")
	require.NoError(t, err)

	err = os.Chdir(tempDir)
	require.NoError(t, err)

	var name string
	if cfg != nil {
		f, err := ioutil.TempFile(tempDir, "setupConfigFile")
		require.NoError(t, err)

		cfgData, err := config.MarshalConfig(cfg)
		require.NoError(t, err)

		ioutil.WriteFile(f.Name(), cfgData, 0644)

		name = f.Name()
	}

	return name, func() {
		os.RemoveAll(tempDir)
	}
}

// getActualFileConfig returns the configuration present in the given file without relying a config store.
func getActualFileConfig(t *testing.T, path string) *model.Config {
	t.Helper()

	f, err := os.Open(path)
	require.Nil(t, err)
	defer f.Close()

	actualCfg, _, err := config.UnmarshalConfig(f, false)
	require.Nil(t, err)

	return actualCfg
}

// assertFileEqualsConfig verifies the on disk contents of the given path equal the given config.
func assertFileEqualsConfig(t *testing.T, expectedCfg *model.Config, path string) {
	expectedCfg = prepareExpectedConfig(t, expectedCfg)
	actualCfg := getActualFileConfig(t, path)

	assert.Equal(t, expectedCfg, actualCfg)
}

// assertFileNotEqualsConfig verifies the on disk contents of the given path does not equal the given config.
func assertFileNotEqualsConfig(t *testing.T, expectedCfg *model.Config, path string) {
	expectedCfg = prepareExpectedConfig(t, expectedCfg)
	actualCfg := getActualFileConfig(t, path)

	assert.NotEqual(t, expectedCfg, actualCfg)
}

func TestFileStoreNew(t *testing.T) {
	utils.TranslationsPreInit()

	t.Run("absolute path, initialization required", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://TestStoreNew", *fs.Get().ServiceSettings.SiteURL)
		assertFileNotEqualsConfig(t, testConfig, path)
	})

	t.Run("absolute path, already minimally configured", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://minimal", *fs.Get().ServiceSettings.SiteURL)
		assertFileEqualsConfig(t, minimalConfig, path)
	})

	t.Run("absolute path, file does not exist", func(t *testing.T) {
		_, tearDown := setupConfigFile(t, nil)
		defer tearDown()

		tempDir, err := ioutil.TempDir("", "TestFileStoreNew")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		path := filepath.Join(tempDir, "does_not_exist")
		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
		assertFileNotEqualsConfig(t, testConfig, path)
	})

	t.Run("absolute path, path to file does not exist", func(t *testing.T) {
		_, tearDown := setupConfigFile(t, nil)
		defer tearDown()

		tempDir, err := ioutil.TempDir("", "TestFileStoreNew")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		path := filepath.Join(tempDir, "does/not/exist")
		_, err = config.NewFileStore(path, false)
		require.Error(t, err)
	})

	t.Run("relative path, file exists", func(t *testing.T) {
		_, tearDown := setupConfigFile(t, nil)
		defer tearDown()

		err := os.MkdirAll("TestFileStoreNew/a/b/c", 0700)
		require.NoError(t, err)
		defer os.RemoveAll("TestFileStoreNew")

		path := "TestFileStoreNew/a/b/c/config.json"

		cfgData, err := config.MarshalConfig(testConfig)
		require.NoError(t, err)

		ioutil.WriteFile(path, cfgData, 0644)

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://TestStoreNew", *fs.Get().ServiceSettings.SiteURL)
		assertFileNotEqualsConfig(t, testConfig, path)
	})

	t.Run("relative path, file does not exist", func(t *testing.T) {
		_, tearDown := setupConfigFile(t, nil)
		defer tearDown()

		err := os.MkdirAll("config/TestFileStoreNew/a/b/c", 0700)
		require.NoError(t, err)
		defer os.RemoveAll("config/TestFileStoreNew")

		path := "TestFileStoreNew/a/b/c/config.json"
		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
		assertFileNotEqualsConfig(t, testConfig, filepath.Join("config", path))
	})
}

func TestFileStoreGet(t *testing.T) {
	path, tearDown := setupConfigFile(t, testConfig)
	defer tearDown()

	fs, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	cfg := fs.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	cfg2 := fs.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	assert.True(t, cfg == cfg2, "Get() returned different configuration instances")

	newCfg := &model.Config{}
	oldCfg, err := fs.Set(newCfg)

	assert.True(t, oldCfg == cfg, "returned config after set() changed original")
	assert.False(t, newCfg == cfg, "returned config should have been different from original")
}

func TestFileStoreGetEnivironmentOverrides(t *testing.T) {
	path, tearDown := setupConfigFile(t, testConfig)
	defer tearDown()

	fs, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	assert.Equal(t, "http://TestStoreNew", *fs.Get().ServiceSettings.SiteURL)
	assert.Empty(t, fs.GetEnvironmentOverrides())

	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")

	fs, err = config.NewFileStore(path, false)
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

		fs, err := config.NewFileStore(path, false)
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

		fs, err := config.NewFileStore(path, false)
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
		path, tearDown := setupConfigFile(t, ldapConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
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

		fs, err := config.NewFileStore(path, false)
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

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		newCfg := &model.Config{}

		_, err = fs.Set(newCfg)
		if assert.Error(t, err) {
			assert.Equal(t, config.ErrReadOnlyConfiguration, errors.Cause(err))
		}

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("persist failed", func(t *testing.T) {
		t.Skip("skipping persistence test inside Set")
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
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

		fs, err := config.NewFileStore(path, false)
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

		fs, err := config.NewFileStore(path, true)
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
		cfgData, err := config.MarshalConfig(emptyConfig)
		require.NoError(t, err)

		ioutil.WriteFile(path, cfgData, 0644)
		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config written")
		}
	})
}

func TestFileStoreLoad(t *testing.T) {
	t.Run("file no longer exists", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		os.Remove(path)

		err = fs.Load()
		require.NoError(t, err)
		assertFileNotEqualsConfig(t, emptyConfig, path)
	})

	t.Run("honour environment", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")

		err = fs.Load()
		require.NoError(t, err)
		assert.Equal(t, "http://override", *fs.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("invalid", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		cfgData, err := config.MarshalConfig(invalidConfig)
		require.NoError(t, err)

		ioutil.WriteFile(path, cfgData, 0644)

		err = fs.Load()
		if assert.Error(t, err) {
			assert.EqualError(t, err, "invalid config: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}
	})

	t.Run("fixes required", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, fixesRequiredConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		err = fs.Load()
		require.NoError(t, err)
		assertFileNotEqualsConfig(t, fixesRequiredConfig, path)
		assert.Equal(t, "http://trailingslash", *fs.Get().ServiceSettings.SiteURL)
		assert.Equal(t, "/path/to/directory/", *fs.Get().FileSettings.Directory)
		assert.Equal(t, "en", *fs.Get().LocalizationSettings.DefaultServerLocale)
		assert.Equal(t, "en", *fs.Get().LocalizationSettings.DefaultClientLocale)
	})

	t.Run("listeners notifed", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		defer fs.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		err = fs.Load()
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
		fs, err := config.NewFileStore(path, false)
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
		cfgData, err := config.MarshalConfig(emptyConfig)
		require.NoError(t, err)

		ioutil.WriteFile(path, cfgData, 0644)
		select {
		case <-called:
			t.Fatal("callback should not have been called since watching disabled")
		case <-time.After(1 * time.Second):
		}
	})

	t.Run("enabled", func(t *testing.T) {
		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		// Rewrite the config to the file on disk
		cfgData, err := config.MarshalConfig(emptyConfig)
		require.NoError(t, err)

		ioutil.WriteFile(path, cfgData, 0644)
		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config written")
		}
	})
}

func TestFileStoreSave(t *testing.T) {
	path, tearDown := setupConfigFile(t, minimalConfig)
	defer tearDown()

	fs, err := config.NewFileStore(path, true)
	require.NoError(t, err)
	defer fs.Close()

	newCfg := &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://new"),
		},
	}

	t.Run("set without save", func(t *testing.T) {
		_, err = fs.Set(newCfg)
		require.NoError(t, err)

		err = fs.Load()
		require.NoError(t, err)

		assert.Equal(t, "http://minimal", *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("set with save", func(t *testing.T) {
		_, err = fs.Set(newCfg)
		require.NoError(t, err)

		err = fs.Save()
		require.NoError(t, err)

		err = fs.Load()
		require.NoError(t, err)

		assert.Equal(t, "http://new", *fs.Get().ServiceSettings.SiteURL)
	})
}

func TestFileGetFile(t *testing.T) {
	path, tearDown := setupConfigFile(t, minimalConfig)
	defer tearDown()

	fs, err := config.NewFileStore(path, true)
	require.NoError(t, err)
	defer fs.Close()

	t.Run("get empty filename", func(t *testing.T) {
		_, err := fs.GetFile("")
		require.Error(t, err)
	})

	t.Run("get non-existent file", func(t *testing.T) {
		_, err := fs.GetFile("unknown")
		require.Error(t, err)
	})

	t.Run("get empty file", func(t *testing.T) {
		err := os.MkdirAll("config", 0700)
		require.NoError(t, err)

		f, err := ioutil.TempFile("config", "empty-file")
		require.NoError(t, err)
		defer os.Remove(f.Name())

		err = ioutil.WriteFile(f.Name(), nil, 0777)
		require.NoError(t, err)

		data, err := fs.GetFile(f.Name())
		require.NoError(t, err)
		require.Empty(t, data)
	})

	t.Run("get non-empty file", func(t *testing.T) {
		err := os.MkdirAll("config", 0700)
		require.NoError(t, err)

		f, err := ioutil.TempFile("config", "test-file")
		require.NoError(t, err)
		defer os.Remove(f.Name())

		err = ioutil.WriteFile(f.Name(), []byte("test"), 0777)
		require.NoError(t, err)

		data, err := fs.GetFile(f.Name())
		require.NoError(t, err)
		require.Equal(t, []byte("test"), data)
	})
}

func TestFileSetFile(t *testing.T) {
	path, tearDown := setupConfigFile(t, minimalConfig)
	defer tearDown()

	fs, err := config.NewFileStore(path, true)
	require.NoError(t, err)
	defer fs.Close()

	t.Run("set new file", func(t *testing.T) {
		err := fs.SetFile("new", []byte("new file"))
		require.NoError(t, err)

		data, err := fs.GetFile("new")
		require.NoError(t, err)
		require.Equal(t, []byte("new file"), data)
	})

	t.Run("overwrite existing file", func(t *testing.T) {
		err := fs.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = fs.SetFile("existing", []byte("overwritten file"))
		require.NoError(t, err)

		data, err := fs.GetFile("existing")
		require.NoError(t, err)
		require.Equal(t, []byte("overwritten file"), data)
	})
}

func TestFileHasFile(t *testing.T) {

	t.Run("has non-existent", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		has, err := fs.HasFile("non-existent")
		require.NoError(t, err)
		require.False(t, has)
	})

	t.Run("has existing", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		err = fs.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		has, err := fs.HasFile("existing")
		require.NoError(t, err)
		require.True(t, has)
	})

	t.Run("has manually created file", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		err = os.MkdirAll("config", 0700)
		require.NoError(t, err)

		f, err := ioutil.TempFile("config", "test-file")
		require.NoError(t, err)
		defer os.Remove(f.Name())

		err = ioutil.WriteFile(f.Name(), []byte("test"), 0777)
		require.NoError(t, err)

		has, err := fs.HasFile(f.Name())
		require.NoError(t, err)
		require.True(t, has)
	})
}

func TestFileRemoveFile(t *testing.T) {
	t.Run("remove non-existent", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		err = fs.RemoveFile("non-existent")
		require.NoError(t, err)
	})

	t.Run("remove existing", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		err = fs.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = fs.RemoveFile("existing")
		require.NoError(t, err)

		has, err := fs.HasFile("existing")
		require.NoError(t, err)
		require.False(t, has)

		_, err = fs.GetFile("existing")
		require.Error(t, err)
	})

	t.Run("remove manually created file", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		err = os.MkdirAll("config", 0700)
		require.NoError(t, err)

		f, err := ioutil.TempFile("config", "test-file")
		require.NoError(t, err)
		defer os.Remove(f.Name())

		err = ioutil.WriteFile(f.Name(), []byte("test"), 0777)
		require.NoError(t, err)

		err = fs.RemoveFile(f.Name())
		require.NoError(t, err)

		has, err := fs.HasFile("existing")
		require.NoError(t, err)
		require.False(t, has)

		_, err = fs.GetFile("existing")
		require.Error(t, err)
	})
}

func TestFileStoreString(t *testing.T) {
	path, tearDown := setupConfigFile(t, emptyConfig)
	defer tearDown()

	fs, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	defer fs.Close()

	assert.Equal(t, "file://"+path, fs.String())
}
