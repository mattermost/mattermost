// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config_test

import (
	"bytes"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
)

func setupConfigDatabase(t *testing.T, cfg *model.Config) (string, func()) {
	t.Helper()
	os.Clearenv()
	truncateTables(t)

	cfgData, err := config.MarshalConfig(cfg)
	require.NoError(t, err)

	db := sqlx.NewDb(mainHelper.SqlSupplier.GetMaster().Db, *mainHelper.Settings.DriverName)
	err = config.InitializeConfigurationsTable(db)
	require.NoError(t, err)

	id := model.NewId()
	_, err = db.NamedExec("INSERT INTO Configurations (Id, Value, CreateAt, Active) VALUES(:Id, :Value, :CreateAt, TRUE)", map[string]interface{}{
		"Id":       id,
		"Value":    cfgData,
		"CreateAt": model.GetMillis(),
	})
	require.NoError(t, err)

	return id, func() {
		truncateTables(t)
	}
}

// assertDatabaseEqualsConfig verifies the active in-database configuration equals the given config.
func assertDatabaseEqualsConfig(t *testing.T, expectedCfg *model.Config) {
	t.Helper()

	// These fields require special initialization for our tests.
	expectedCfg = expectedCfg.Clone()
	expectedCfg.MessageExportSettings.GlobalRelaySettings = &model.GlobalRelayMessageExportSettings{}
	expectedCfg.PluginSettings.Plugins = make(map[string]map[string]interface{})
	expectedCfg.PluginSettings.PluginStates = make(map[string]*model.PluginState)

	var actualCfgData []byte
	db := sqlx.NewDb(mainHelper.SqlSupplier.GetMaster().Db, *mainHelper.Settings.DriverName)
	err := db.Get(&actualCfgData, "SELECT Value FROM Configurations WHERE Active")
	require.NoError(t, err)

	actualCfg, _, err := config.UnmarshalConfig(bytes.NewReader(actualCfgData), false)
	require.Nil(t, err)

	assert.Equal(t, expectedCfg, actualCfg)
}

// assertDatabaseNotEqualsConfig verifies the in-database configuration does not equal the given config.
func assertDatabaseNotEqualsConfig(t *testing.T, expectedCfg *model.Config) {
	t.Helper()

	// These fields require special initialization for our tests.
	expectedCfg = expectedCfg.Clone()
	expectedCfg.MessageExportSettings.GlobalRelaySettings = &model.GlobalRelayMessageExportSettings{}
	expectedCfg.PluginSettings.Plugins = make(map[string]map[string]interface{})
	expectedCfg.PluginSettings.PluginStates = make(map[string]*model.PluginState)

	var actualCfgData []byte
	db := sqlx.NewDb(mainHelper.SqlSupplier.GetMaster().Db, *mainHelper.Settings.DriverName)
	err := db.Get(&actualCfgData, "SELECT Value FROM Configurations WHERE Active")
	require.NoError(t, err)

	actualCfg, _, err := config.UnmarshalConfig(bytes.NewReader(actualCfgData), false)
	require.Nil(t, err)

	assert.NotEqual(t, expectedCfg, actualCfg)
}

func TestDatabaseStoreNew(t *testing.T) {
	t.Run("no existing configuration - initialization required", func(t *testing.T) {
		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("existing config, initialization required", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, testConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "http://TestStoreNew", *ds.Get().ServiceSettings.SiteURL)
		assertDatabaseNotEqualsConfig(t, testConfig)
	})

	t.Run("already minimally configured", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "http://minimal", *ds.Get().ServiceSettings.SiteURL)
		assertDatabaseEqualsConfig(t, minimalConfig)
	})

	t.Run("invalid url", func(t *testing.T) {
		_, err := config.NewDatabaseStore("")
		require.Error(t, err)
	})

	t.Run("unsupported scheme", func(t *testing.T) {
		_, err := config.NewDatabaseStore("invalid")
		require.Error(t, err)
	})
}

func TestDatabaseStoreGet(t *testing.T) {
	_, tearDown := setupConfigDatabase(t, testConfig)
	defer tearDown()

	ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
	require.NoError(t, err)
	defer ds.Close()

	cfg := ds.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	cfg2 := ds.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	assert.True(t, cfg == cfg2, "Get() returned different configuration instances")

	newCfg := &model.Config{}
	oldCfg, err := ds.Set(newCfg)
	require.NoError(t, err)

	assert.True(t, oldCfg == cfg, "returned config after set() changed original")
	assert.False(t, newCfg == cfg, "returned config should have been different from original")
}

func TestDatabaseStoreGetEnivironmentOverrides(t *testing.T) {
	_, tearDown := setupConfigDatabase(t, testConfig)
	defer tearDown()

	ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
	require.NoError(t, err)
	defer ds.Close()

	assert.Equal(t, "http://TestStoreNew", *ds.Get().ServiceSettings.SiteURL)
	assert.Empty(t, ds.GetEnvironmentOverrides())

	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")

	ds, err = config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
	require.NoError(t, err)
	defer ds.Close()

	assert.Equal(t, "http://override", *ds.Get().ServiceSettings.SiteURL)
	assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, ds.GetEnvironmentOverrides())
}

func TestDatabaseStoreSet(t *testing.T) {
	t.Run("set same pointer value", func(t *testing.T) {
		t.Skip("not yet implemented")

		_, tearDown := setupConfigDatabase(t, emptyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		_, err = ds.Set(ds.Get())
		if assert.Error(t, err) {
			assert.EqualError(t, err, "old configuration modified instead of cloning")
		}
	})

	t.Run("defaults required", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		oldCfg := ds.Get()

		newCfg := &model.Config{}

		retCfg, err := ds.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("desanitization required", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, ldapConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		oldCfg := ds.Get()

		newCfg := &model.Config{}
		newCfg.LdapSettings.BindPassword = sToP(model.FAKE_SETTING)

		retCfg, err := ds.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		assert.Equal(t, "password", *ds.Get().LdapSettings.BindPassword)
	})

	t.Run("invalid", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		newCfg := &model.Config{}
		newCfg.ServiceSettings.SiteURL = sToP("invalid")

		_, err = ds.Set(newCfg)
		if assert.Error(t, err) {
			assert.EqualError(t, err, "new configuration is invalid: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("read-only ignored", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, readOnlyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		newCfg := &model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: sToP("http://new"),
			},
		}

		_, err = ds.Set(newCfg)
		require.NoError(t, err)

		assert.Equal(t, "http://new", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("persist failed", func(t *testing.T) {
		t.Skip("skipping persistence test inside Set")
		_, tearDown := setupConfigDatabase(t, emptyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		db := sqlx.NewDb(mainHelper.SqlSupplier.GetMaster().Db, *mainHelper.Settings.DriverName)
		_, err = db.Exec("DROP TABLE Configurations")
		require.NoError(t, err)

		newCfg := &model.Config{}

		_, err = ds.Set(newCfg)
		if assert.Error(t, err) {
			assert.True(t, strings.HasPrefix(err.Error(), "failed to persist: failed to write to database"))
		}

		assert.Equal(t, model.SERVICE_SETTINGS_DEFAULT_SITE_URL, *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notified", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		oldCfg := ds.Get()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		ds.AddListener(callback)

		newCfg := &model.Config{}

		retCfg, err := ds.Set(newCfg)
		require.NoError(t, err)
		assert.Equal(t, oldCfg, retCfg)

		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config written")
		}
	})
}

func TestDatabaseStoreLoad(t *testing.T) {
	t.Run("active configuration no longer exists", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		truncateTables(t)

		err = ds.Load()
		require.NoError(t, err)
		assertDatabaseNotEqualsConfig(t, emptyConfig)
	})

	t.Run("honour environment", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")

		err = ds.Load()
		require.NoError(t, err)
		assert.Equal(t, "http://override", *ds.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, ds.GetEnvironmentOverrides())
	})

	t.Run("invalid", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		cfgData, err := config.MarshalConfig(invalidConfig)
		require.NoError(t, err)

		db := sqlx.NewDb(mainHelper.SqlSupplier.GetMaster().Db, *mainHelper.Settings.DriverName)
		truncateTables(t)
		id := model.NewId()
		_, err = db.NamedExec("INSERT INTO Configurations (Id, Value, CreateAt, Active) VALUES(:Id, :Value, :CreateAt, TRUE)", map[string]interface{}{
			"Id":       id,
			"Value":    cfgData,
			"CreateAt": model.GetMillis(),
		})
		require.NoError(t, err)

		err = ds.Load()
		if assert.Error(t, err) {
			assert.EqualError(t, err, "invalid config: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}
	})

	t.Run("fixes required", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, fixesRequiredConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		err = ds.Load()
		require.NoError(t, err)
		assertDatabaseNotEqualsConfig(t, fixesRequiredConfig)
		assert.Equal(t, "http://trailingslash", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notifed", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig)
		defer tearDown()

		ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
		require.NoError(t, err)
		defer ds.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		ds.AddListener(callback)

		err = ds.Load()
		require.NoError(t, err)

		select {
		case <-called:
		case <-time.After(5 * time.Second):
			t.Fatal("callback should have been called when config loaded")
		}
	})
}

func TestDatabaseStoreSave(t *testing.T) {
	_, tearDown := setupConfigDatabase(t, minimalConfig)
	defer tearDown()

	ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
	require.NoError(t, err)
	defer ds.Close()

	newCfg := &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://new"),
		},
	}

	t.Run("set without save", func(t *testing.T) {
		_, err = ds.Set(newCfg)
		require.NoError(t, err)

		err = ds.Load()
		require.NoError(t, err)

		assert.Equal(t, "http://minimal", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("set with save", func(t *testing.T) {
		_, err = ds.Set(newCfg)
		require.NoError(t, err)

		err = ds.Save()
		require.NoError(t, err)

		err = ds.Load()
		require.NoError(t, err)

		assert.Equal(t, "http://new", *ds.Get().ServiceSettings.SiteURL)
	})
}

func TestDatabaseStoreString(t *testing.T) {
	_, tearDown := setupConfigDatabase(t, emptyConfig)
	defer tearDown()

	ds, err := config.NewDatabaseStore(fmt.Sprintf("%s://%s", *mainHelper.Settings.DriverName, *mainHelper.Settings.DataSource))
	require.NoError(t, err)
	defer ds.Close()

	actualStringURL, err := url.Parse(ds.String())
	require.NoError(t, err)

	assert.Equal(t, *mainHelper.Settings.DriverName, actualStringURL.Scheme)
	actualUsername := actualStringURL.User.Username()
	actualPassword, _ := actualStringURL.User.Password()
	assert.NotEmpty(t, actualUsername)
	assert.Empty(t, actualPassword, "should mask password")
}
