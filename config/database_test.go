// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
)

func getDsn(driver string, source string) string {
	if driver == model.DATABASE_DRIVER_MYSQL {
		return driver + "://" + source
	}
	return source
}

func setupConfigDatabase(t *testing.T, cfg *model.Config, files map[string][]byte) (string, func()) {
	if testing.Short() {
		t.SkipNow()
	}
	t.Helper()
	os.Clearenv()
	truncateTables(t)

	cfgData, err := config.MarshalConfig(cfg)
	require.NoError(t, err)

	db := sqlx.NewDb(mainHelper.GetSQLSupplier().GetMaster().Db, *mainHelper.GetSQLSettings().DriverName)
	err = config.InitializeConfigurationsTable(db)
	require.NoError(t, err)

	id := model.NewId()
	_, err = db.NamedExec("INSERT INTO Configurations (Id, Value, CreateAt, Active) VALUES(:Id, :Value, :CreateAt, TRUE)", map[string]interface{}{
		"Id":       id,
		"Value":    cfgData,
		"CreateAt": model.GetMillis(),
	})
	require.NoError(t, err)

	for name, data := range files {
		params := map[string]interface{}{
			"name":      name,
			"data":      data,
			"create_at": model.GetMillis(),
			"update_at": model.GetMillis(),
		}

		_, err = db.NamedExec("INSERT INTO ConfigurationFiles (Name, Data, CreateAt, UpdateAt) VALUES (:name, :data, :create_at, :update_at)", params)
		require.NoError(t, err)
	}

	return id, func() {
		truncateTables(t)
	}
}

// getActualDatabaseConfig returns the active configuration in the database without relying on a config store.
func getActualDatabaseConfig(t *testing.T) (string, *model.Config) {
	t.Helper()

	if *mainHelper.GetSQLSettings().DriverName == "postgres" {
		var actual struct {
			ID    string `db:"id"`
			Value []byte `db:"value"`
		}
		db := sqlx.NewDb(mainHelper.GetSQLSupplier().GetMaster().Db, *mainHelper.GetSQLSettings().DriverName)
		err := db.Get(&actual, "SELECT Id, Value FROM Configurations WHERE Active")
		require.NoError(t, err)

		var actualCfg *model.Config
		err = json.Unmarshal(actual.Value, &actualCfg)
		require.Nil(t, err)
		return actual.ID, actualCfg
	}
	var actual struct {
		ID    string `db:"Id"`
		Value []byte `db:"Value"`
	}
	db := sqlx.NewDb(mainHelper.GetSQLSupplier().GetMaster().Db, *mainHelper.GetSQLSettings().DriverName)
	err := db.Get(&actual, "SELECT Id, Value FROM Configurations WHERE Active")
	require.NoError(t, err)

	var actualCfg *model.Config
	err = json.Unmarshal(actual.Value, &actualCfg)
	require.Nil(t, err)
	return actual.ID, actualCfg
}

// assertDatabaseEqualsConfig verifies the active in-database configuration equals the given config.
func assertDatabaseEqualsConfig(t *testing.T, expectedCfg *model.Config) {
	t.Helper()

	_, actualCfg := getActualDatabaseConfig(t)
	assert.Equal(t, expectedCfg, actualCfg)
}

// assertDatabaseNotEqualsConfig verifies the in-database configuration does not equal the given config.
func assertDatabaseNotEqualsConfig(t *testing.T, expectedCfg *model.Config) {
	t.Helper()

	_, actualCfg := getActualDatabaseConfig(t)
	assert.NotEqual(t, expectedCfg, actualCfg)
}

func newTestDatabaseStore(t *testing.T) (*config.Store, error) {
	sqlSettings := mainHelper.GetSQLSettings()
	dss, err := config.NewDatabaseStore(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource))
	require.NoError(t, err)

	cStore, err := config.NewStoreFromBacking(dss)
	require.NoError(t, err)

	return cStore, nil
}

func TestDatabaseStoreNew(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	sqlSettings := mainHelper.GetSQLSettings()

	t.Run("no existing configuration - initialization required", func(t *testing.T) {
		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("existing config, initialization required", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, testConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "http://TestStoreNew", *ds.Get().ServiceSettings.SiteURL)
		assertDatabaseNotEqualsConfig(t, testConfig)
	})

	t.Run("already minimally configured", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "http://minimal", *ds.Get().ServiceSettings.SiteURL)
		assertDatabaseEqualsConfig(t, minimalConfig)
	})

	t.Run("invalid url", func(t *testing.T) {
		_, err := config.NewDatabaseStore("")
		require.Error(t, err)

		_, err = config.NewDatabaseStore("mysql")
		require.Error(t, err)
	})

	t.Run("unsupported scheme", func(t *testing.T) {
		_, err := config.NewDatabaseStore("invalid")
		require.Error(t, err)
	})

	t.Run("unsupported scheme with valid data source", func(t *testing.T) {
		_, err := config.NewDatabaseStore(fmt.Sprintf("invalid://%s", *sqlSettings.DataSource))
		require.Error(t, err)
	})
}

func TestDatabaseStoreGet(t *testing.T) {
	_, tearDown := setupConfigDatabase(t, testConfig, nil)
	defer tearDown()

	ds, err := newTestDatabaseStore(t)
	require.NoError(t, err)
	defer ds.Close()

	cfg := ds.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	cfg2 := ds.Get()
	assert.Equal(t, "http://TestStoreNew", *cfg.ServiceSettings.SiteURL)

	assert.True(t, cfg == cfg2, "Get() returned different configuration instances")
}

func TestDatabaseStoreGetEnivironmentOverrides(t *testing.T) {
	t.Run("get override for a string variable", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, testConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "http://TestStoreNew", *ds.Get().ServiceSettings.SiteURL)
		assert.Empty(t, ds.GetEnvironmentOverrides())

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		ds, err = newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "http://override", *ds.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, ds.GetEnvironmentOverrides())
	})

	t.Run("get override for a bool variable", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, testConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, false, *ds.Get().PluginSettings.EnableUploads)
		assert.Empty(t, ds.GetEnvironmentOverrides())

		os.Setenv("MM_PLUGINSETTINGS_ENABLEUPLOADS", "true")
		defer os.Unsetenv("MM_PLUGINSETTINGS_ENABLEUPLOADS")

		ds, err = newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, true, *ds.Get().PluginSettings.EnableUploads)
		assert.Equal(t, map[string]interface{}{"PluginSettings": map[string]interface{}{"EnableUploads": true}}, ds.GetEnvironmentOverrides())
	})

	t.Run("get override for an int variable", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, testConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, model.TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM, *ds.Get().TeamSettings.MaxUsersPerTeam)
		assert.Empty(t, ds.GetEnvironmentOverrides())

		os.Setenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM", "3000")
		defer os.Unsetenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM")

		ds, err = newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, 3000, *ds.Get().TeamSettings.MaxUsersPerTeam)
		assert.Equal(t, map[string]interface{}{"TeamSettings": map[string]interface{}{"MaxUsersPerTeam": true}}, ds.GetEnvironmentOverrides())
	})

	t.Run("get override for an int64 variable", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, testConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, int64(63072000), *ds.Get().ServiceSettings.TLSStrictTransportMaxAge)
		assert.Empty(t, ds.GetEnvironmentOverrides())

		os.Setenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE", "123456")
		defer os.Unsetenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE")

		ds, err = newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, int64(123456), *ds.Get().ServiceSettings.TLSStrictTransportMaxAge)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"TLSStrictTransportMaxAge": true}}, ds.GetEnvironmentOverrides())
	})

	t.Run("get override for a slice variable - one value", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, testConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, []string{}, ds.Get().SqlSettings.DataSourceReplicas)
		assert.Empty(t, ds.GetEnvironmentOverrides())

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		ds, err = newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, ds.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, ds.GetEnvironmentOverrides())
	})

	t.Run("get override for a slice variable - three values", func(t *testing.T) {
		// This should work, but Viper (or we) don't parse environment variables to turn strings with spaces into slices.
		t.Skip("not implemented yet")

		_, tearDown := setupConfigDatabase(t, testConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, []string{}, ds.Get().SqlSettings.DataSourceReplicas)
		assert.Empty(t, ds.GetEnvironmentOverrides())

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db user:pwd@db2:5433/test-db2 user:pwd@db3:5434/test-db3")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		ds, err = newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db", "user:pwd@db2:5433/test-db2", "user:pwd@db3:5434/test-db3"}, ds.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, ds.GetEnvironmentOverrides())
	})
}

func TestDatabaseStoreSet(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	t.Run("set same pointer value", func(t *testing.T) {
		t.Skip("not yet implemented")

		_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		_, err = ds.Set(ds.Get())
		if assert.Error(t, err) {
			assert.EqualError(t, err, "old configuration modified instead of cloning")
		}
	})

	t.Run("defaults required", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		newCfg := &model.Config{}

		_, err = ds.Set(newCfg)
		require.NoError(t, err)

		assert.Equal(t, "", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("desanitization required", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, ldapConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		newCfg := &model.Config{}
		newCfg.LdapSettings.BindPassword = sToP(model.FAKE_SETTING)

		_, err = ds.Set(newCfg)
		require.NoError(t, err)

		assert.Equal(t, "password", *ds.Get().LdapSettings.BindPassword)
	})

	t.Run("invalid", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		newCfg := &model.Config{}
		newCfg.ServiceSettings.SiteURL = sToP("invalid")

		_, err = ds.Set(newCfg)
		if assert.Error(t, err) {
			assert.EqualError(t, err, "new configuration is invalid: Config.IsValid: model.config.is_valid.site_url.app_error, ")
		}

		assert.Equal(t, "", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("duplicate ignored", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		beforeID, _ := getActualDatabaseConfig(t)
		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		afterID, _ := getActualDatabaseConfig(t)
		assert.Equal(t, beforeID, afterID, "new record should not have been written")
	})

	t.Run("read-only ignored", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, readOnlyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
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

	t.Run("set with automatic save", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		newCfg := &model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: sToP("http://new"),
			},
		}

		_, err = ds.Set(newCfg)
		require.NoError(t, err)

		err = ds.Load()
		require.NoError(t, err)

		assert.Equal(t, "http://new", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("persist failed", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		sqlSettings := mainHelper.GetSQLSettings()
		db := sqlx.NewDb(mainHelper.GetSQLSupplier().GetMaster().Db, *sqlSettings.DriverName)
		_, err = db.Exec("DROP TABLE Configurations")
		require.NoError(t, err)

		newCfg := &model.Config{}

		_, err = ds.Set(newCfg)
		require.Error(t, err)
		assert.True(t, strings.HasPrefix(err.Error(), "failed to persist: failed to query active configuration"), "unexpected error: "+err.Error())

		assert.Equal(t, "", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("persist failed: too long", func(t *testing.T) {
		if *mainHelper.Settings.DriverName == "postgres" {
			t.Skip("No limit for postgres")
		}
		_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		longSiteURL := fmt.Sprintf("http://%s", strings.Repeat("a", config.MaxWriteLength))
		newCfg := emptyConfig.Clone()
		newCfg.ServiceSettings.SiteURL = sToP(longSiteURL)

		_, err = ds.Set(newCfg)
		require.Error(t, err)
		assert.True(t, strings.HasPrefix(err.Error(), "failed to persist: marshalled configuration failed length check: value is too long"), "unexpected error: "+err.Error())
	})

	t.Run("listeners notified", func(t *testing.T) {
		activeID, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		ds.AddListener(callback)

		newCfg := &model.Config{}

		_, err = ds.Set(newCfg)
		require.NoError(t, err)

		id, _ := getActualDatabaseConfig(t)
		assert.NotEqual(t, activeID, id, "new record should have been written")

		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config written")
	})
}

func TestDatabaseStoreLoad(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	t.Run("active configuration no longer exists", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		truncateTables(t)

		err = ds.Load()
		require.NoError(t, err)
		assertDatabaseNotEqualsConfig(t, emptyConfig)
	})

	t.Run("honour environment", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, "http://minimal", *ds.Get().ServiceSettings.SiteURL)

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://override")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		err = ds.Load()
		require.NoError(t, err)
		assert.Equal(t, "http://override", *ds.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, ds.GetEnvironmentOverrides())
	})

	t.Run("do not persist environment variables - string", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://overridePersistEnvVariables")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		assert.Equal(t, "http://overridePersistEnvVariables", *ds.Get().ServiceSettings.SiteURL)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"SiteURL": true}}, ds.GetEnvironmentOverrides())
		// check that in DB config does not include overwritten variable
		_, actualConfig := getActualDatabaseConfig(t)
		assert.Equal(t, "http://minimal", *actualConfig.ServiceSettings.SiteURL)
	})

	t.Run("do not persist environment variables - boolean", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		os.Setenv("MM_PLUGINSETTINGS_ENABLEUPLOADS", "true")
		defer os.Unsetenv("MM_PLUGINSETTINGS_ENABLEUPLOADS")

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, true, *ds.Get().PluginSettings.EnableUploads)

		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		assert.Equal(t, true, *ds.Get().PluginSettings.EnableUploads)
		assert.Equal(t, map[string]interface{}{"PluginSettings": map[string]interface{}{"EnableUploads": true}}, ds.GetEnvironmentOverrides())
		// check that in DB config does not include overwritten variable
		_, actualConfig := getActualDatabaseConfig(t)
		assert.Equal(t, false, *actualConfig.PluginSettings.EnableUploads)
	})

	t.Run("do not persist environment variables - int", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		os.Setenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM", "3000")
		defer os.Unsetenv("MM_TEAMSETTINGS_MAXUSERSPERTEAM")

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, 3000, *ds.Get().TeamSettings.MaxUsersPerTeam)

		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		assert.Equal(t, 3000, *ds.Get().TeamSettings.MaxUsersPerTeam)
		assert.Equal(t, map[string]interface{}{"TeamSettings": map[string]interface{}{"MaxUsersPerTeam": true}}, ds.GetEnvironmentOverrides())
		// check that in DB config does not include overwritten variable
		_, actualConfig := getActualDatabaseConfig(t)
		assert.Equal(t, model.TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM, *actualConfig.TeamSettings.MaxUsersPerTeam)
	})

	t.Run("do not persist environment variables - int64", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		os.Setenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE", "123456")
		defer os.Unsetenv("MM_SERVICESETTINGS_TLSSTRICTTRANSPORTMAXAGE")

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, int64(123456), *ds.Get().ServiceSettings.TLSStrictTransportMaxAge)

		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		assert.Equal(t, int64(123456), *ds.Get().ServiceSettings.TLSStrictTransportMaxAge)
		assert.Equal(t, map[string]interface{}{"ServiceSettings": map[string]interface{}{"TLSStrictTransportMaxAge": true}}, ds.GetEnvironmentOverrides())
		// check that in DB config does not include overwritten variable
		_, actualConfig := getActualDatabaseConfig(t)
		assert.Equal(t, int64(63072000), *actualConfig.ServiceSettings.TLSStrictTransportMaxAge)
	})

	t.Run("do not persist environment variables - string slice beginning with default", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, ds.Get().SqlSettings.DataSourceReplicas)

		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, ds.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, ds.GetEnvironmentOverrides())
		// check that in DB config does not include overwritten variable
		_, actualConfig := getActualDatabaseConfig(t)
		assert.Equal(t, []string{}, actualConfig.SqlSettings.DataSourceReplicas)
	})

	t.Run("do not persist environment variables - string slice beginning with slice of three", func(t *testing.T) {
		modifiedMinimalConfig := minimalConfig.Clone()
		modifiedMinimalConfig.SqlSettings.DataSourceReplicas = []string{"user:pwd@db:5432/test-db", "user:pwd@db2:5433/test-db2", "user:pwd@db3:5434/test-db3"}
		_, tearDown := setupConfigDatabase(t, modifiedMinimalConfig, nil)
		defer tearDown()

		os.Setenv("MM_SQLSETTINGS_DATASOURCEREPLICAS", "user:pwd@db:5432/test-db")
		defer os.Unsetenv("MM_SQLSETTINGS_DATASOURCEREPLICAS")

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, ds.Get().SqlSettings.DataSourceReplicas)

		_, err = ds.Set(ds.Get())
		require.NoError(t, err)

		assert.Equal(t, []string{"user:pwd@db:5432/test-db"}, ds.Get().SqlSettings.DataSourceReplicas)
		assert.Equal(t, map[string]interface{}{"SqlSettings": map[string]interface{}{"DataSourceReplicas": true}}, ds.GetEnvironmentOverrides())
		// check that in DB config does not include overwritten variable
		_, actualConfig := getActualDatabaseConfig(t)
		assert.Equal(t, []string{"user:pwd@db:5432/test-db", "user:pwd@db2:5433/test-db2", "user:pwd@db3:5434/test-db3"}, actualConfig.SqlSettings.DataSourceReplicas)
	})

	t.Run("invalid", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		cfgData, err := config.MarshalConfig(invalidConfig)
		require.NoError(t, err)

		sqlSettings := mainHelper.GetSQLSettings()
		db := sqlx.NewDb(mainHelper.GetSQLSupplier().GetMaster().Db, *sqlSettings.DriverName)
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
		_, tearDown := setupConfigDatabase(t, fixesRequiredConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		err = ds.Load()
		require.NoError(t, err)
		assertDatabaseNotEqualsConfig(t, fixesRequiredConfig)
		assert.Equal(t, "http://trailingslash", *ds.Get().ServiceSettings.SiteURL)
	})

	t.Run("listeners notifed", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		called := make(chan bool, 1)
		callback := func(oldfg, newCfg *model.Config) {
			called <- true
		}
		ds.AddListener(callback)

		err = ds.Load()
		require.NoError(t, err)

		require.True(t, wasCalled(called, 5*time.Second), "callback should have been called when config loaded")
	})
}

func TestDatabaseGetFile(t *testing.T) {
	_, tearDown := setupConfigDatabase(t, minimalConfig, map[string][]byte{
		"empty-file": {},
		"test-file":  []byte("test"),
	})
	defer tearDown()

	ds, err := newTestDatabaseStore(t)
	require.NoError(t, err)
	defer ds.Close()

	t.Run("get empty filename", func(t *testing.T) {
		_, err := ds.GetFile("")
		require.Error(t, err)
	})

	t.Run("get non-existent file", func(t *testing.T) {
		_, err := ds.GetFile("unknown")
		require.Error(t, err)
	})

	t.Run("get empty file", func(t *testing.T) {
		data, err := ds.GetFile("empty-file")
		require.NoError(t, err)
		require.Empty(t, data)
	})

	t.Run("get non-empty file", func(t *testing.T) {
		data, err := ds.GetFile("test-file")
		require.NoError(t, err)
		require.Equal(t, []byte("test"), data)
	})
}

func TestDatabaseSetFile(t *testing.T) {
	_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
	defer tearDown()

	ds, err := newTestDatabaseStore(t)
	require.NoError(t, err)
	defer ds.Close()

	t.Run("set new file", func(t *testing.T) {
		err := ds.SetFile("new", []byte("new file"))
		require.NoError(t, err)

		data, err := ds.GetFile("new")
		require.NoError(t, err)
		require.Equal(t, []byte("new file"), data)
	})

	t.Run("overwrite existing file", func(t *testing.T) {
		err := ds.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = ds.SetFile("existing", []byte("overwritten file"))
		require.NoError(t, err)

		data, err := ds.GetFile("existing")
		require.NoError(t, err)
		require.Equal(t, []byte("overwritten file"), data)
	})

	t.Run("max length", func(t *testing.T) {
		if *mainHelper.Settings.DriverName == "postgres" {
			t.Skip("No limit for postgres")
		}
		longFile := bytes.Repeat([]byte("a"), config.MaxWriteLength)

		err := ds.SetFile("toolong", longFile)
		require.NoError(t, err)
	})

	t.Run("too long", func(t *testing.T) {
		if *mainHelper.Settings.DriverName == "postgres" {
			t.Skip("No limit for postgres")
		}
		longFile := bytes.Repeat([]byte("a"), config.MaxWriteLength+1)

		err := ds.SetFile("toolong", longFile)
		if assert.Error(t, err) {
			assert.True(t, strings.HasPrefix(err.Error(), "file data failed length check: value is too long"))
		}
	})
}

func TestDatabaseHasFile(t *testing.T) {
	t.Run("has non-existent", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		has, err := ds.HasFile("non-existent")
		require.NoError(t, err)
		require.False(t, has)
	})

	t.Run("has existing", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		err = ds.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		has, err := ds.HasFile("existing")
		require.NoError(t, err)
		require.True(t, has)
	})

	t.Run("has manually created file", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, map[string][]byte{
			"manual": []byte("manual file"),
		})
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		has, err := ds.HasFile("manual")
		require.NoError(t, err)
		require.True(t, has)
	})

	t.Run("has non-existent empty string", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		has, err := ds.HasFile("")
		require.NoError(t, err)
		require.False(t, has)
	})
}

func TestDatabaseRemoveFile(t *testing.T) {
	t.Run("remove non-existent", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		err = ds.RemoveFile("non-existent")
		require.NoError(t, err)
	})

	t.Run("remove existing", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, nil)
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		err = ds.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = ds.RemoveFile("existing")
		require.NoError(t, err)

		has, err := ds.HasFile("existing")
		require.NoError(t, err)
		require.False(t, has)

		_, err = ds.GetFile("existing")
		require.Error(t, err)
	})

	t.Run("remove manually created file", func(t *testing.T) {
		_, tearDown := setupConfigDatabase(t, minimalConfig, map[string][]byte{
			"manual": []byte("manual file"),
		})
		defer tearDown()

		ds, err := newTestDatabaseStore(t)
		require.NoError(t, err)
		defer ds.Close()

		err = ds.RemoveFile("manual")
		require.NoError(t, err)

		has, err := ds.HasFile("manual")
		require.NoError(t, err)
		require.False(t, has)

		_, err = ds.GetFile("manual")
		require.Error(t, err)
	})
}

func TestDatabaseStoreString(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	_, tearDown := setupConfigDatabase(t, emptyConfig, nil)
	defer tearDown()

	ds, err := newTestDatabaseStore(t)
	require.NoError(t, err)
	require.NotNil(t, ds)
	defer ds.Close()

	if *mainHelper.GetSQLSettings().DriverName == "postgres" {
		maskedDSN := ds.String()
		assert.True(t, strings.HasPrefix(maskedDSN, "postgres://"))
		assert.True(t, strings.Contains(maskedDSN, "mmuser"))
		assert.False(t, strings.Contains(maskedDSN, "mostest"))
	} else {
		maskedDSN := ds.String()
		assert.True(t, strings.HasPrefix(maskedDSN, "mysql://"))
		assert.True(t, strings.Contains(maskedDSN, "mmuser"))
		assert.False(t, strings.Contains(maskedDSN, "mostest"))
	}
}
