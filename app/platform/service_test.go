// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store/storetest"
	"github.com/stretchr/testify/mock"
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

func TestMetrics(t *testing.T) {
	t.Run("ensure the metrics server is not started by default", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		require.Nil(t, th.Service.metrics)
	})

	t.Run("ensure the metrics server is started", func(t *testing.T) {
		th := Setup(t, StartMetrics())
		defer th.TearDown()

		// there is no config listener for the metrics
		// we handle it on config save step
		th.Service.UpdateConfig(func(c *model.Config) {
			c.MetricsSettings.Enable = model.NewBool(true)
		})
		th.Service.SaveConfig(th.Service.Config(), false)

		require.NotNil(t, th.Service.metrics)
		metricsAddr := strings.Replace(th.Service.metrics.listenAddr, "[::]", "http://localhost", 1)

		resp, err := http.Get(metricsAddr)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		th.Service.UpdateConfig(func(c *model.Config) {
			c.MetricsSettings.Enable = model.NewBool(false)
		})
		th.Service.SaveConfig(th.Service.Config(), false)

		_, err = http.Get(metricsAddr)
		require.Error(t, err)
	})

	t.Run("ensure the metrics server is started with advanced metrics", func(t *testing.T) {
		t.Skip("MM-47635")
		th := Setup(t, StartMetrics())
		defer th.TearDown()

		mockMetricsImpl := &mocks.MetricsInterface{}
		mockMetricsImpl.On("Register").Return()

		th.Service.metricsIFace = mockMetricsImpl
		err := th.Service.resetMetrics()
		require.NoError(t, err)

		mockMetricsImpl.AssertExpectations(t)
	})

	t.Run("ensure advanced metrics have database metrics", func(t *testing.T) {
		mockMetricsImpl := &mocks.MetricsInterface{}
		mockMetricsImpl.On("Register").Return()
		mockMetricsImpl.On("ObserveStoreMethodDuration", mock.Anything, mock.Anything, mock.Anything).Return()

		th := Setup(t, StartMetrics(), func(ps *PlatformService) error {
			ps.metricsIFace = mockMetricsImpl
			return nil
		})
		defer th.TearDown()

		_ = th.CreateUserOrGuest(false)

		mockMetricsImpl.AssertExpectations(t)
	})
}

func TestShutdown(t *testing.T) {
	t.Run("should shutdown gracefully", func(t *testing.T) {
		th := Setup(t)
		rand.Seed(time.Now().UnixNano())

		// we create plenty of go routines to make sure we wait for all of them
		// to finish before shutting down
		for i := 0; i < 1000; i++ {
			th.Service.Go(func() {
				time.Sleep(time.Millisecond * time.Duration(rand.Intn(20)))
			})
		}

		err := th.Service.Shutdown()
		require.NoError(t, err)

		// assert that there are no more go routines running
		require.Zero(t, atomic.LoadInt32(&th.Service.goroutineCount))
	})
}
