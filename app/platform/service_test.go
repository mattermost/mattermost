// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store/storetest"
	"github.com/stretchr/testify/require"
)

func TestReadReplicaDisabledBasedOnLicense(t *testing.T) {
	cfg := model.Config{}
	cfg.SetDefaults()
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DatabaseDriverPostgres
	}
	dsn := ""
	if driverName == model.DatabaseDriverPostgres {
		dsn = os.Getenv("TEST_DATABASE_POSTGRESQL_DSN")
	} else {
		dsn = os.Getenv("TEST_DATABASE_MYSQL_DSN")
	}
	cfg.SqlSettings = *storetest.MakeSqlSettings(driverName, false)
	if dsn != "" {
		cfg.SqlSettings.DataSource = &dsn
	}
	cfg.SqlSettings.DataSourceReplicas = []string{*cfg.SqlSettings.DataSource}
	cfg.SqlSettings.DataSourceSearchReplicas = []string{*cfg.SqlSettings.DataSource}

	t.Run("Read Replicas with no License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		configStore.Set(&cfg)
		ps, err := New(ServiceConfig{
			ConfigStore: configStore,
		})
		require.NoError(t, err)
		require.Same(t, ps.sqlStore.GetMasterX(), ps.sqlStore.GetReplicaX())
		require.Len(t, ps.Config().SqlSettings.DataSourceReplicas, 1)
	})

	t.Run("Read Replicas With License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		configStore.Set(&cfg)
		ps, err := New(ServiceConfig{
			ConfigStore: configStore,
		}, func(ps *PlatformService) error {
			ps.licenseValue.Store(model.NewTestLicense())
			return nil
		})
		require.NoError(t, err)
		require.NotSame(t, ps.sqlStore.GetMasterX(), ps.sqlStore.GetReplicaX())
		require.Len(t, ps.Config().SqlSettings.DataSourceReplicas, 1)
	})

	t.Run("Search Replicas with no License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		configStore.Set(&cfg)
		ps, err := New(ServiceConfig{
			ConfigStore: configStore,
		})
		require.NoError(t, err)
		require.Same(t, ps.sqlStore.GetMasterX(), ps.sqlStore.GetSearchReplicaX())
		require.Len(t, ps.Config().SqlSettings.DataSourceSearchReplicas, 1)
	})

	t.Run("Search Replicas With License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		configStore.Set(&cfg)
		ps, err := New(ServiceConfig{
			ConfigStore: configStore,
		}, func(ps *PlatformService) error {
			ps.licenseValue.Store(model.NewTestLicense())
			return nil
		})
		require.NoError(t, err)
		require.NotSame(t, ps.sqlStore.GetMasterX(), ps.sqlStore.GetSearchReplicaX())
		require.Len(t, ps.Config().SqlSettings.DataSourceSearchReplicas, 1)
	})
}
