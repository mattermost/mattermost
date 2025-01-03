// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// A copy of validTestLicense from channels/utils/license_test.go
var validTestLicense = []byte("eyJpZCI6InpvZ3c2NW44Z2lmajVkbHJoYThtYnUxcGl3IiwiaXNzdWVkX2F0IjoxNjg0Nzg3MzcxODY5LCJzdGFydHNfYXQiOjE2ODQ3ODczNzE4NjksImV4cGlyZXNfYXQiOjIwMDA0MDY1MzgwMDAsInNrdV9uYW1lIjoiUHJvZmVzc2lvbmFsIiwic2t1X3Nob3J0X25hbWUiOiJwcm9mZXNzaW9uYWwiLCJjdXN0b21lciI6eyJpZCI6InA5dW4zNjlhNjdnaW1qNHlkNmk2aWIzOXdoIiwibmFtZSI6Ik1hdHRlcm1vc3QiLCJlbWFpbCI6ImpvcmFtQG1hdHRlcm1vc3QuY29tIiwiY29tcGFueSI6Ik1hdHRlcm1vc3QifSwiZmVhdHVyZXMiOnsidXNlcnMiOjIwMDAwMCwibGRhcCI6dHJ1ZSwibGRhcF9ncm91cHMiOmZhbHNlLCJtZmEiOnRydWUsImdvb2dsZV9vYXV0aCI6dHJ1ZSwib2ZmaWNlMzY1X29hdXRoIjp0cnVlLCJjb21wbGlhbmNlIjpmYWxzZSwiY2x1c3RlciI6dHJ1ZSwibWV0cmljcyI6dHJ1ZSwibWhwbnMiOnRydWUsInNhbWwiOnRydWUsImVsYXN0aWNfc2VhcmNoIjp0cnVlLCJhbm5vdW5jZW1lbnQiOnRydWUsInRoZW1lX21hbmFnZW1lbnQiOmZhbHNlLCJlbWFpbF9ub3RpZmljYXRpb25fY29udGVudHMiOmZhbHNlLCJkYXRhX3JldGVudGlvbiI6ZmFsc2UsIm1lc3NhZ2VfZXhwb3J0IjpmYWxzZSwiY3VzdG9tX3Blcm1pc3Npb25zX3NjaGVtZXMiOmZhbHNlLCJjdXN0b21fdGVybXNfb2Zfc2VydmljZSI6ZmFsc2UsImd1ZXN0X2FjY291bnRzIjp0cnVlLCJndWVzdF9hY2NvdW50c19wZXJtaXNzaW9ucyI6dHJ1ZSwiaWRfbG9hZGVkIjpmYWxzZSwibG9ja190ZWFtbWF0ZV9uYW1lX2Rpc3BsYXkiOmZhbHNlLCJjbG91ZCI6ZmFsc2UsInNoYXJlZF9jaGFubmVscyI6ZmFsc2UsInJlbW90ZV9jbHVzdGVyX3NlcnZpY2UiOmZhbHNlLCJvcGVuaWQiOnRydWUsImVudGVycHJpc2VfcGx1Z2lucyI6dHJ1ZSwiYWR2YW5jZWRfbG9nZ2luZyI6dHJ1ZSwiZnV0dXJlX2ZlYXR1cmVzIjpmYWxzZX0sImlzX3RyaWFsIjp0cnVlLCJpc19nb3Zfc2t1IjpmYWxzZX0bEOVk2GdE1kSWKJ3dENWnkj0htY6QyXTtNA5hqnQ71Uc6teqXc7htHAxrnT/hV42xu+G24OMrAIsQtX4NjFSX6jvehIMRL5II3RPXYhHKUd2wruQ5ITEh1htFb5DgOJW3tvBdMmXt09nXjLRS1UYJ7ZsX3mU0uQndt7qfMriGAkk71veYuUJgztB3MsV7lRWB+8ZTp6WJ7RH+uWnuDspiA8B85mLnyuoCDokYksF2uIb+CtPGBTUB6qSOgxBBJxu5qftQXISCDAWY4O8lCrN3p5HCA/zf/rSRRNtet06QFobbjUDI4B7ZEAescKBKoHpP6nZPhg4KmhnkUi/o04ox")

func TestSetLicenseOnStart(t *testing.T) {
	oldValue := model.BuildEnterpriseReady
	defer func() { model.BuildEnterpriseReady = oldValue }()
	model.BuildEnterpriseReady = "true"

	cfg := model.Config{}
	cfg.SetDefaults()

	f, err := os.CreateTemp("", "TestSetLicenseOnStart")
	require.NoError(t, err)
	defer os.Remove(f.Name())
	require.NoError(t, os.WriteFile(f.Name(), validTestLicense, 0777))

	*cfg.ServiceSettings.LicenseFileLocation = f.Name()

	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DatabaseDriverPostgres
	}
	cfg.SqlSettings = *storetest.MakeSqlSettings(driverName, false)

	configStore := config.NewTestMemoryStore()
	_, _, err = configStore.Set(&cfg)
	require.NoError(t, err)
	// It should not panic when ps.LoadLicense gets called from platform.New
	_, err = New(
		ServiceConfig{},
		ConfigStore(configStore),
	)
	require.NoError(t, err)
}

func TestReadReplicaDisabledBasedOnLicense(t *testing.T) {
	cfg := model.Config{}
	cfg.SetDefaults()
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DatabaseDriverPostgres
	}
	cfg.SqlSettings = *storetest.MakeSqlSettings(driverName, false)
	cfg.SqlSettings.DataSourceReplicas = []string{*cfg.SqlSettings.DataSource}
	cfg.SqlSettings.DataSourceSearchReplicas = []string{*cfg.SqlSettings.DataSource}

	t.Run("Read Replicas with no License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		_, _, err := configStore.Set(&cfg)
		require.NoError(t, err)
		ps, err := New(
			ServiceConfig{},
			ConfigStore(configStore),
		)
		require.NoError(t, err)
		require.Same(t, ps.sqlStore.GetMaster(), ps.sqlStore.GetReplica())
		require.Len(t, ps.Config().SqlSettings.DataSourceReplicas, 1)
	})

	t.Run("Read Replicas With License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		_, _, err := configStore.Set(&cfg)
		require.NoError(t, err)
		ps, err := New(
			ServiceConfig{},
			ConfigStore(configStore),
			func(ps *PlatformService) error {
				ps.licenseValue.Store(model.NewTestLicense())
				return nil
			},
		)
		require.NoError(t, err)
		require.NotSame(t, ps.sqlStore.GetMaster(), ps.sqlStore.GetReplica())
		require.Len(t, ps.Config().SqlSettings.DataSourceReplicas, 1)
	})

	t.Run("Search Replicas with no License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		_, _, err := configStore.Set(&cfg)
		require.NoError(t, err)
		ps, err := New(
			ServiceConfig{},
			ConfigStore(configStore),
		)
		require.NoError(t, err)
		require.Same(t, ps.sqlStore.GetMaster(), ps.sqlStore.GetSearchReplicaX())
		require.Len(t, ps.Config().SqlSettings.DataSourceSearchReplicas, 1)
	})

	t.Run("Search Replicas With License", func(t *testing.T) {
		configStore := config.NewTestMemoryStore()
		_, _, err := configStore.Set(&cfg)
		require.NoError(t, err)
		ps, err := New(
			ServiceConfig{},
			ConfigStore(configStore),
			func(ps *PlatformService) error {
				ps.licenseValue.Store(model.NewTestLicense())
				return nil
			},
		)
		require.NoError(t, err)
		require.NotSame(t, ps.sqlStore.GetMaster(), ps.sqlStore.GetSearchReplicaX())
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
		cfg := th.Service.Config().Clone()
		cfg.MetricsSettings.Enable = model.NewPointer(true)
		_, _, appErr := th.Service.SaveConfig(cfg, false)
		require.Nil(t, appErr)

		require.NotNil(t, th.Service.metrics)
		metricsAddr := strings.Replace(th.Service.metrics.listenAddr, "[::]", "http://localhost", 1)
		metricsAddr = strings.Replace(metricsAddr, "127.0.0.1", "http://localhost", 1)

		resp, err := http.Get(metricsAddr)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		cfg.MetricsSettings.Enable = model.NewPointer(false)
		_, _, appErr = th.Service.SaveConfig(cfg, false)
		require.Nil(t, appErr)

		_, err = http.Get(metricsAddr)
		require.Error(t, err)
	})

	t.Run("ensure the metrics server is started with advanced metrics", func(t *testing.T) {
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
		mockMetricsImpl.On("RegisterDBCollector", mock.AnythingOfType("*sql.DB"), "master")

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

func TestSetTelemetryId(t *testing.T) {
	t.Run("ensure client config is regenerated after setting the telemetry id", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		clientConfig := th.Service.LimitedClientConfig()
		require.Empty(t, clientConfig["DiagnosticId"])

		id := model.NewId()
		th.Service.SetTelemetryId(id)

		clientConfig = th.Service.LimitedClientConfig()
		require.Equal(t, clientConfig["DiagnosticId"], id)
	})
}

func TestDatabaseTypeAndMattermostVersion(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	databaseType, schemaVersion, err := th.Service.DatabaseTypeAndSchemaVersion()
	require.NoError(t, err)
	if *th.Service.Config().SqlSettings.DriverName == model.DatabaseDriverPostgres {
		assert.Equal(t, "postgres", databaseType)
	} else {
		assert.Equal(t, "mysql", databaseType)
	}

	// It's hard to check wheather the schema version is correct or not.
	// So, we just check if it's greater than 1.
	assert.GreaterOrEqual(t, schemaVersion, strconv.Itoa(1))
}
