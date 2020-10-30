// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

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

// getActualFileConfig returns the configuration present in the given file without relying on a config store.
func getActualFileConfig(t *testing.T, path string) *model.Config {
	t.Helper()

	f, err := os.Open(path)
	require.Nil(t, err)
	defer f.Close()

	var actualCfg *model.Config
	err = json.NewDecoder(f).Decode(&actualCfg)
	require.Nil(t, err)

	return actualCfg
}

// assertFileEqualsConfig verifies the on disk contents of the given path equal the given config.
func assertFileEqualsConfig(t *testing.T, expectedCfg *model.Config, path string) {
	t.Helper()

	actualCfg := getActualFileConfig(t, path)

	assert.Equal(t, expectedCfg, actualCfg)
}

// assertFileNotEqualsConfig verifies the on disk contents of the given path does not equal the given config.
func assertFileNotEqualsConfig(t *testing.T, expectedCfg *model.Config, path string) {
	t.Helper()

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
		configStore, err := config.NewStoreFromBacking(fs)
		require.NoError(t, err)
		defer configStore.Close()

		assert.Equal(t, "http://TestStoreNew", *configStore.Get().ServiceSettings.SiteURL)
		assertFileNotEqualsConfig(t, testConfig, path)
	})

	t.Run("absolute path, already minimally configured", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		configStore, err := config.NewStoreFromBacking(fs)
		require.NoError(t, err)
		defer configStore.Close()

		assert.Equal(t, "http://minimal", *configStore.Get().ServiceSettings.SiteURL)
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
		configStore, err := config.NewStoreFromBacking(fs)
		require.NoError(t, err)
		defer configStore.Close()

		assert.Equal(t, "", *configStore.Get().ServiceSettings.SiteURL)
		assertFileNotEqualsConfig(t, testConfig, path)
	})

	t.Run("absolute path, path to file does not exist", func(t *testing.T) {
		_, tearDown := setupConfigFile(t, nil)
		defer tearDown()

		tempDir, err := ioutil.TempDir("", "TestFileStoreNew")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)

		path := filepath.Join(tempDir, "does/not/exist")
		fs, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		configStore, err := config.NewStoreFromBacking(fs)
		require.Nil(t, configStore)
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
		configStore, err := config.NewStoreFromBacking(fs)
		require.NoError(t, err)
		defer configStore.Close()

		assert.Equal(t, "http://TestStoreNew", *configStore.Get().ServiceSettings.SiteURL)
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
		configStore, err := config.NewStoreFromBacking(fs)
		require.NoError(t, err)
		defer configStore.Close()

		assert.Equal(t, "", *configStore.Get().ServiceSettings.SiteURL)
		assertFileNotEqualsConfig(t, testConfig, filepath.Join("config", path))
	})
}

func TestFileStoreGet(t *testing.T) {
	path, tearDown := setupConfigFile(t, testConfig)
	defer tearDown()

	fs, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	configStore, err := config.NewStoreFromBacking(fs)
	require.NoError(t, err)
	defer configStore.Close()

	cfg := configStore.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	cfg2 := configStore.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	assert.True(t, cfg == cfg2, "Get() returned different configuration instances")

	newCfg := &model.Config{}
	_, err = configStore.Set(newCfg)
	require.NoError(t, err)

	assert.False(t, newCfg == cfg, "returned config should have been different from original")
}

func TestFileStoreGetEnivironmentOverrides(t *testing.T) {
	t.Run("get override for a string variable", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://TestStoreNew", *fs.Get().ServiceSettings.SiteURL)
		assert.Empty(t, fs.GetEnvironmentOverrides())

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		fsInner, err = config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err = config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://override", *fs.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("get override for a bool variable", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, false, *fs.Get().PluginSettings.EnableUploads)
		assert.Empty(t, fs.GetEnvironmentOverrides())

		os.Setenv("MM_PLUGINSETTINGS_ENABLEUPLOADS", "true")
		defer os.Unsetenv("MM_PLUGINSETTINGS_ENABLEUPLOADS")

		fsInner, err = config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err = config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, true, *fs.Get().PluginSettings.EnableUploads)
		assert.Equal(t, map[string]interface{}{"PluginSettings": map[string]interface{}{"EnableUploads": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("get override for an int variable", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, model.TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM, *fs.Get().TeamSettings.MaxUsersPerTeam)
		assert.Empty(t, fs.GetEnvironmentOverrides())

		os.Setenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM", "3000")
		defer os.Unsetenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM")

		fsInner, err = config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err = config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, 3000, *fs.Get().TeamSettings.MaxUsersPerTeam)
		assert.Equal(t, map[string]interface{}{"TeamSettings": map[string]interface{}{"MaxUsersPerTeam": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("get override for an int64 variable", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, int64(63072000), *fs.Get().ServiceSettings.TLSStrictTransportMaxAge)
		assert.Empty(t, fs.GetEnvironmentOverrides())

		os.Setenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE", "123456")
		defer os.Unsetenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE")

		fsInner, err = config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err = config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, int64(123456), *fs.Get().ServiceSettings.TLSStrictTransportMaxAge)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"TLSStrictTransportMaxAge": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("get override for a slice variable - one value", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, []string{}, fs.Get().SqlSettings.DataSourceReplicas)
		assert.Empty(t, fs.GetEnvironmentOverrides())

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		fsInner, err = config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err = config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, fs.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("get override for a slice variable - three values", func(t *testing.T) {
		// This should work, but Viper (or we) don't parse environment variables to turn strings with spaces into slices.
		t.Skip("not implemented yet")

		path, tearDown := setupConfigFile(t, testConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, []string{}, fs.Get().SqlSettings.DataSourceReplicas)
		assert.Empty(t, fs.GetEnvironmentOverrides())

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db user:pwd@db2:5433/test-db2 user:pwd@db3:5434/test-db3")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		fsInner, err = config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err = config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db", "user:pwd@db2:5433/test-db2", "user:pwd@db3:5434/test-db3"}, fs.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, fs.GetEnvironmentOverrides())
	})
}

func TestFileStoreSet(t *testing.T) {
	t.Run("defaults required", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		oldCfg := fs.Get().Clone()

		newCfg := &model.Config{}

		retCfg, err := fs.Set(newCfg)
		require.NoError(t, err)
		require.Equal(t, oldCfg, retCfg)

		assert.Equal(t, "", *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("desanitization required", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, ldapConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		newCfg := &model.Config{}
		newCfg.LdapSettings.BindPassword = sToP(model.FAKE_SETTING)

		_, err = fs.Set(newCfg)
		require.NoError(t, err)

		assert.Equal(t, "password", *fs.Get().LdapSettings.BindPassword)
	})

	t.Run("invalid", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		newCfg := &model.Config{}
		newCfg.ServiceSettings.SiteURL = sToP("invalid")

		_, err = fs.Set(newCfg)
		if assert.Error(t, err) {
			assert.EqualError(t, err, "new configuration is invalid: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}

		assert.Equal(t, "", *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("read-only", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, readOnlyConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		_, err = fs.Set(readOnlyConfig)
		if assert.Error(t, err) {
			assert.Equal(t, config.ErrReadOnlyConfiguration, errors.Cause(err))
		}

		assert.Equal(t, "", *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("persist failed", func(t *testing.T) {
		t.Skip("skipping persistence test inside Set")
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		os.Chmod(path, 0500)

		newCfg := &model.Config{}

		_, err = fs.Set(newCfg)
		if assert.Error(t, err) {
			assert.True(t, strings.HasPrefix(err.Error(), "failed to persist: failed to write file"))
		}

		assert.Equal(t, "", *fs.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notified", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		newCfg := &model.Config{}

		_, err = fs.Set(newCfg)
		require.NoError(t, err)

		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config written")
	})

	t.Run("watcher restarted", func(t *testing.T) {
		if testing.Short() {
			t.Skip("skipping watcher test in short mode")
		}

		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
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
		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config written")
	})
}

func TestFileStoreLoad(t *testing.T) {
	t.Run("file no longer exists", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
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

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://minimal", *fs.Get().ServiceSettings.SiteURL)

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		err = fs.Load()
		require.NoError(t, err)
		assert.Equal(t, "http://override", *fs.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, fs.GetEnvironmentOverrides())
	})

	t.Run("do not persist environment variables - string", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://overridePersistEnvVariables")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, "http://overridePersistEnvVariables", *fs.Get().ServiceSettings.SiteURL)

		_, err = fs.Set(fs.Get())
		require.NoError(t, err)

		assert.Equal(t, "http://overridePersistEnvVariables", *fs.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, fs.GetEnvironmentOverrides())
		// check that on disk config does not include overwritten variable
		actualConfig := getActualFileConfig(t, path)
		assert.Equal(t, "http://minimal", *actualConfig.ServiceSettings.SiteURL)
	})

	t.Run("do not persist environment variables - boolean", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		os.Setenv("MM_PLUGINSETTINGS_ENABLEUPLOADS", "true")
		defer os.Unsetenv("MM_PLUGINSETTINGS_ENABLEUPLOADS")

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, true, *fs.Get().PluginSettings.EnableUploads)

		_, err = fs.Set(fs.Get())
		require.NoError(t, err)

		assert.Equal(t, true, *fs.Get().PluginSettings.EnableUploads)
		assert.Equal(t, map[string]interface{}{"PluginSettings": map[string]interface{}{"EnableUploads": true}}, fs.GetEnvironmentOverrides())
		// check that on disk config does not include overwritten variable
		actualConfig := getActualFileConfig(t, path)
		assert.Equal(t, false, *actualConfig.PluginSettings.EnableUploads)
	})

	t.Run("do not persist environment variables - int", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		os.Setenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM", "3000")
		defer os.Unsetenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM")

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, 3000, *fs.Get().TeamSettings.MaxUsersPerTeam)

		_, err = fs.Set(fs.Get())
		require.NoError(t, err)

		assert.Equal(t, 3000, *fs.Get().TeamSettings.MaxUsersPerTeam)
		assert.Equal(t, map[string]interface{}{"TeamSettings": map[string]interface{}{"MaxUsersPerTeam": true}}, fs.GetEnvironmentOverrides())
		// check that on disk config does not include overwritten variable
		actualConfig := getActualFileConfig(t, path)
		assert.Equal(t, model.TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM, *actualConfig.TeamSettings.MaxUsersPerTeam)
	})

	t.Run("do not persist environment variables - int64", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		os.Setenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE", "123456")
		defer os.Unsetenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE")

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, int64(123456), *fs.Get().ServiceSettings.TLSStrictTransportMaxAge)

		_, err = fs.Set(fs.Get())
		require.NoError(t, err)

		assert.Equal(t, int64(123456), *fs.Get().ServiceSettings.TLSStrictTransportMaxAge)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"TLSStrictTransportMaxAge": true}}, fs.GetEnvironmentOverrides())
		// check that on disk config does not include overwritten variable
		actualConfig := getActualFileConfig(t, path)
		assert.Equal(t, int64(63072000), *actualConfig.ServiceSettings.TLSStrictTransportMaxAge)
	})

	t.Run("do not persist environment variables - string slice beginning with default", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, fs.Get().SqlSettings.DataSourceReplicas)

		_, err = fs.Set(fs.Get())
		require.NoError(t, err)

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, fs.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, fs.GetEnvironmentOverrides())
		// check that on disk config does not include overwritten variable
		actualConfig := getActualFileConfig(t, path)
		assert.Equal(t, []string{}, actualConfig.SqlSettings.DataSourceReplicas)
	})

	t.Run("do not persist environment variables - string slice beginning with slice of three", func(t *testing.T) {
		modifiedMinimalConfig := minimalConfig.Clone()
		modifiedMinimalConfig.SqlSettings.DataSourceReplicas = []string{"user:pwd@db:5432/test-db", "user:pwd@db2:5433/test-db2", "user:pwd@db3:5434/test-db3"}
		path, tearDown := setupConfigFile(t, modifiedMinimalConfig)
		defer tearDown()

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, fs.Get().SqlSettings.DataSourceReplicas)

		_, err = fs.Set(fs.Get())
		require.NoError(t, err)

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, fs.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, fs.GetEnvironmentOverrides())
		// check that on disk config does not include overwritten variable
		actualConfig := getActualFileConfig(t, path)
		assert.Equal(t, []string{"user:pwd@db:5432/test-db", "user:pwd@db2:5433/test-db2", "user:pwd@db3:5434/test-db3"}, actualConfig.SqlSettings.DataSourceReplicas)
	})

	t.Run("invalid", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, emptyConfig)
		defer tearDown()

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
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

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
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

		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
		require.NoError(t, err)
		defer fs.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		fs.AddListener(callback)

		err = fs.Load()
		require.NoError(t, err)

		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config loaded")
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
		fsInner, err := config.NewFileStore(path, false)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
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
		require.False(t, wasCalled(called, 1*time.Second), "callback should not have been called since watching disabled")
	})

	t.Run("enabled", func(t *testing.T) {
		fsInner, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		fs, err := config.NewStoreFromBacking(fsInner)
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
		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config written")
	})
}

func TestFileStoreSave(t *testing.T) {
	path, tearDown := setupConfigFile(t, minimalConfig)
	defer tearDown()

	fsInner, err := config.NewFileStore(path, false)
	require.NoError(t, err)
	fs, err := config.NewStoreFromBacking(fsInner)
	require.NoError(t, err)
	defer fs.Close()

	newCfg := &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://new"),
		},
	}

	t.Run("set with automatic save", func(t *testing.T) {
		_, err = fs.Set(newCfg)
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

	t.Run("get via absolute path", func(t *testing.T) {
		err := fs.SetFile("new", []byte("new file"))
		require.NoError(t, err)

		data, err := fs.GetFile(filepath.Join(filepath.Dir(path), "new"))

		require.NoError(t, err)
		require.Equal(t, []byte("new file"), data)
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

	t.Run("set via absolute path", func(t *testing.T) {
		absolutePath := filepath.Join(filepath.Dir(path), "new")
		err := fs.SetFile(absolutePath, []byte("new file"))
		require.NoError(t, err)

		data, err := fs.GetFile("new")

		require.NoError(t, err)
		require.Equal(t, []byte("new file"), data)
	})

	t.Run("should set right permissions", func(t *testing.T) {
		absolutePath := filepath.Join(filepath.Dir(path), "new")
		err := fs.SetFile(absolutePath, []byte("data"))
		require.NoError(t, err)
		fi, err := os.Stat(absolutePath)
		require.NoError(t, err)
		require.Equal(t, os.FileMode(0600), fi.Mode().Perm())
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

	t.Run("has empty string", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		has, err := fs.HasFile("")
		require.NoError(t, err)
		require.False(t, has)
	})

	t.Run("has via absolute path", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		err = fs.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		has, err := fs.HasFile(filepath.Join(filepath.Dir(path), "existing"))
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

	t.Run("don't remove via absolute path", func(t *testing.T) {
		path, tearDown := setupConfigFile(t, minimalConfig)
		defer tearDown()

		fs, err := config.NewFileStore(path, true)
		require.NoError(t, err)
		defer fs.Close()

		err = fs.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		filename := filepath.Join(filepath.Dir(path), "existing")
		err = fs.RemoveFile(filename)
		require.NoError(t, err)

		has, err := fs.HasFile(filename)
		require.NoError(t, err)
		require.True(t, has)

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

// wasCalled reports whether a given callback channel was called
// within the specified time duration or not.
func wasCalled(c chan bool, duration time.Duration) bool {
	select {
	case <-c:
		return true
	case <-time.After(duration):
	}
	return false
}
