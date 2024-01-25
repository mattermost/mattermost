// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package metrics

import (
	"fmt"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/app"

	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"

	"github.com/prometheus/client_golang/prometheus"
	prometheusModels "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
)

func configureMetrics(th *api4.TestHelper) {
	th.App.Srv().SetLicense(nil) // clear license
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MetricsSettings.Enable = true
		*cfg.MetricsSettings.ListenAddress = ":0"
	})
	th.App.Srv().SetLicense(model.NewTestLicense("metrics"))
}

func TestMetrics(t *testing.T) {
	th := api4.SetupEnterpriseWithStoreMock(t, app.StartMetrics)
	defer th.TearDown()

	mockStore := th.App.Srv().Platform().Store.(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	configureMetrics(th)
	mi := th.App.Metrics()

	_, ok := mi.(*MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))

	mi.IncrementHTTPRequest()
	mi.IncrementHTTPError()

	mi.IncrementPostFileAttachment(5)
	mi.IncrementPostCreate()
	mi.IncrementPostSentEmail()
	mi.IncrementPostSentPush()
	mi.IncrementPostBroadcast()

	mi.IncrementLogin()
	mi.IncrementLoginFail()

	mi.IncrementClusterRequest()
	mi.ObserveClusterRequestDuration(2.0)
	mi.IncrementClusterEventType(model.ClusterEventPublish)

	loggerCollector := mi.GetLoggerMetricsCollector()
	g, err := loggerCollector.QueueSizeGauge("_logr")
	require.NoError(t, err)
	g.Set(59)

	c, err := loggerCollector.LoggedCounter("_logr")
	require.NoError(t, err)
	c.Inc()

	c, err = loggerCollector.ErrorCounter("_logr")
	require.NoError(t, err)
	c.Inc()

	c, err = loggerCollector.DroppedCounter("_logr")
	require.NoError(t, err)
	c.Inc()

	c, err = loggerCollector.BlockedCounter("_logr")
	require.NoError(t, err)
	c.Inc()
}

func TestPluginMetrics(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)
	defer th.TearDown()

	configureMetrics(th)
	mi := th.App.Metrics()

	miImpl, ok := mi.(*MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))

	t.Run("test ObservePluginHookDuration", func(t *testing.T) {
		pluginID := "id_"
		hookName := "hook_"
		elapsed := 999.1
		m := &prometheusModels.Metric{}

		for _, success := range []bool{true, false} {
			actualMetric, err := miImpl.PluginHookTimeHistogram.GetMetricWith(prometheus.Labels{"plugin_id": pluginID, "hook_name": hookName, "success": strconv.FormatBool(success)})
			require.NoError(t, err)
			require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
			require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
			require.Equal(t, 0.0, m.Histogram.GetSampleSum())

			mi.ObservePluginHookDuration(pluginID, hookName, success, elapsed)
			actualMetric, err = miImpl.PluginHookTimeHistogram.GetMetricWith(prometheus.Labels{"plugin_id": pluginID, "hook_name": hookName, "success": strconv.FormatBool(success)})
			require.NoError(t, err)
			require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
			require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
			require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
		}
	})

	t.Run("test ObservePluginAPIDuration", func(t *testing.T) {
		pluginID := "id_"
		apiName := "api_"
		elapsed := 999.1
		m := &prometheusModels.Metric{}

		for _, success := range []bool{true, false} {
			actualMetric, err := miImpl.PluginAPITimeHistogram.GetMetricWith(prometheus.Labels{"plugin_id": pluginID, "api_name": apiName, "success": strconv.FormatBool(success)})
			require.NoError(t, err)
			require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
			require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
			require.Equal(t, 0.0, m.Histogram.GetSampleSum())

			mi.ObservePluginAPIDuration(pluginID, apiName, success, elapsed)
			actualMetric, err = miImpl.PluginAPITimeHistogram.GetMetricWith(prometheus.Labels{"plugin_id": pluginID, "api_name": apiName, "success": strconv.FormatBool(success)})
			require.NoError(t, err)
			require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
			require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
			require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
		}
	})

	t.Run("test ObservePluginMultiHookIterationDuration", func(t *testing.T) {
		pluginID := "id_"
		elapsed := 999.1
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.PluginMultiHookTimeHistogram.GetMetricWith(prometheus.Labels{"plugin_id": pluginID})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
		require.Equal(t, 0.0, m.Histogram.GetSampleSum())

		mi.ObservePluginMultiHookIterationDuration(pluginID, elapsed)
		actualMetric, err = miImpl.PluginMultiHookTimeHistogram.GetMetricWith(prometheus.Labels{"plugin_id": pluginID})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
		require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
	})

	t.Run("test ObservePluginMultiHookDuration", func(t *testing.T) {
		elapsed := 50.0
		m := &prometheusModels.Metric{}

		require.NoError(t, miImpl.PluginMultiHookServerTimeHistogram.Write(m))
		require.InDelta(t, 0.0, m.Histogram.GetSampleSum(), 0.001)

		mi.ObservePluginMultiHookDuration(elapsed)
		require.NoError(t, miImpl.PluginMultiHookServerTimeHistogram.Write(m))
		require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
	})
}

func TestExtractDBCluster(t *testing.T) {
	testCases := []struct {
		description         string
		driver              string
		connectionStr       string
		expectedClusterName string
	}{
		{
			description:         "postgres full",
			driver:              "postgres",
			connectionStr:       "postgres://user1234:password1234@rds-cluster-multitenant-1234-postgres.cluster-abcd.us-east-1.rds.amazonaws.com:5432/cloud?connect_timeout=10",
			expectedClusterName: "rds-cluster-multitenant-1234-postgres",
		},
		{
			description:         "postgres no credentials",
			driver:              "postgres",
			connectionStr:       "postgres://rds-cluster-multitenant-1234-postgres.cluster-abcd.us-east-1.rds.amazonaws.com:5432/cloud?connect_timeout=10",
			expectedClusterName: "rds-cluster-multitenant-1234-postgres",
		},
		{
			description:         "mysql full",
			driver:              "mysql",
			connectionStr:       "mysql://user1234:password1234@tcp(rds-cluster-multitenant-1234-mysql.cluster-abcd.us-east-1.rds.amazonaws.com:3306)/cloud?charset=utf8mb4%2Cutf8&readTimeout=30s&writeTimeout=30s&tls=skip-verify",
			expectedClusterName: "rds-cluster-multitenant-1234-mysql",
		},
		{
			description:         "mysql no credentials",
			driver:              "mysql",
			connectionStr:       "mysql://tcp(rds-cluster-multitenant-1234-mysql.cluster-abcd.us-east-1.rds.amazonaws.com:3306)/cloud?charset=utf8mb4%2Cutf8&readTimeout=30s&writeTimeout=30s&tls=skip-verify",
			expectedClusterName: "rds-cluster-multitenant-1234-mysql",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			host, err := extractDBCluster(tc.driver, tc.connectionStr)
			require.NoError(t, err)

			require.Equal(t, tc.expectedClusterName, host)
		})
	}
}
