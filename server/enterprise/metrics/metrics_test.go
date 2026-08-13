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
	seMocks "github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"

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

func TestMobileMetrics(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)

	configureMetrics(th)
	mi := th.App.Metrics()

	miImpl, ok := mi.(*MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))

	ttcc := []struct {
		name         string
		histogramVec *prometheus.HistogramVec
		observeFunc  func(string, float64)
	}{
		{
			name:         "load duration",
			histogramVec: miImpl.MobileClientLoadDuration,
			observeFunc:  mi.ObserveMobileClientLoadDuration,
		},
		{
			name:         "channel switch duration",
			histogramVec: miImpl.MobileClientChannelSwitchDuration,
			observeFunc:  mi.ObserveMobileClientChannelSwitchDuration,
		},
		{
			name:         "team switch duration",
			histogramVec: miImpl.MobileClientTeamSwitchDuration,
			observeFunc:  mi.ObserveMobileClientTeamSwitchDuration,
		},
	}

	for _, tc := range ttcc {
		t.Run(tc.name, func(t *testing.T) {
			m := &prometheusModels.Metric{}
			elapsed := 999.1

			for _, platform := range []string{"ios", "android"} {
				actualMetric, err := tc.histogramVec.GetMetricWith(prometheus.Labels{"platform": platform})
				require.NoError(t, err)
				require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
				require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
				require.Equal(t, 0.0, m.Histogram.GetSampleSum())

				tc.observeFunc(platform, elapsed)
				actualMetric, err = tc.histogramVec.GetMetricWith(prometheus.Labels{"platform": platform})
				require.NoError(t, err)
				require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
				require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
				require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
			}
		})
	}
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
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			host, err := extractDBCluster(tc.driver, tc.connectionStr)
			require.NoError(t, err)

			require.Equal(t, tc.expectedClusterName, host)
		})
	}
}

func TestSearchEngineStatusGauge(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)

	configureMetrics(th)
	mi := th.App.Metrics()

	miImpl, ok := mi.(*MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))

	readGauge := func() float64 {
		m := &prometheusModels.Metric{}
		require.NoError(t, miImpl.SearchEngineStatusGauge.Write(m))
		return m.Gauge.GetValue()
	}

	setEngine := func(t *testing.T, engine *seMocks.SearchEngineInterface) {
		t.Helper()
		miImpl.Platform.SearchEngine.ElasticsearchEngine = engine
		t.Cleanup(func() {
			miImpl.Platform.SearchEngine.ElasticsearchEngine = nil
		})
	}

	t.Run("nil engine returns 1", func(t *testing.T) {
		miImpl.Platform.SearchEngine.ElasticsearchEngine = nil
		require.Equal(t, 1.0, readGauge())
	})

	t.Run("disabled engine returns 1", func(t *testing.T) {
		esMock := &seMocks.SearchEngineInterface{}
		esMock.On("IsEnabled").Return(false)
		setEngine(t, esMock)
		require.Equal(t, 1.0, readGauge())
	})

	t.Run("enabled healthy engine returns 1", func(t *testing.T) {
		esMock := &seMocks.SearchEngineInterface{}
		esMock.On("IsEnabled").Return(true)
		esMock.On("IsHealthy").Return(true)
		setEngine(t, esMock)
		require.Equal(t, 1.0, readGauge())
	})

	t.Run("enabled unhealthy engine returns 0", func(t *testing.T) {
		esMock := &seMocks.SearchEngineInterface{}
		esMock.On("IsEnabled").Return(true)
		esMock.On("IsHealthy").Return(false)
		setEngine(t, esMock)
		require.Equal(t, 0.0, readGauge())
	})
}

func TestObserveClusterReliableFallbackLength(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)

	configureMetrics(th)
	mi := th.App.Metrics()

	miImpl, ok := mi.(*MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))

	event := model.ClusterEvent("ws_event")
	length := 42
	m := &prometheusModels.Metric{}

	t.Run("labels are correct", func(t *testing.T) {
		_, err := miImpl.ClusterReliableFallbackLength.GetMetricWith(prometheus.Labels{"event": "x"})
		require.NoError(t, err, "expected 'event' to be a registered label")
		_, err = miImpl.ClusterReliableFallbackLength.GetMetricWith(prometheus.Labels{"wrong_label": "x"})
		require.Error(t, err, "expected no label other than 'event' to be registered")
	})

	t.Run("metric is registered and initialized at 0", func(t *testing.T) {
		actualMetric, err := miImpl.ClusterReliableFallbackLength.GetMetricWith(prometheus.Labels{"event": string(event)})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
		require.Equal(t, 0.0, m.Histogram.GetSampleSum())
	})

	t.Run("metric can be observed and the registered value is correct", func(t *testing.T) {
		mi.ObserveClusterReliableFallbackLength(event, length)

		actualMetric, err := miImpl.ClusterReliableFallbackLength.GetMetricWith(prometheus.Labels{"event": string(event)})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
		require.InDelta(t, float64(length), m.Histogram.GetSampleSum(), 0.001)
	})
}

func TestMergeLabels(t *testing.T) {
	t.Run("combines both maps", func(t *testing.T) {
		got := mergeLabels(map[string]string{"a": "1"}, map[string]string{"b": "2"})
		require.Equal(t, prometheus.Labels{"a": "1", "b": "2"}, got)
	})

	t.Run("extra takes precedence over base", func(t *testing.T) {
		got := mergeLabels(map[string]string{"a": "1"}, map[string]string{"a": "2"})
		require.Equal(t, prometheus.Labels{"a": "2"}, got)
	})

	t.Run("handles nil maps", func(t *testing.T) {
		require.Equal(t, prometheus.Labels{}, mergeLabels(nil, nil))
	})
}

func TestServerInfo(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)

	configureMetrics(th)
	mi := th.App.Metrics()

	miImpl, ok := mi.(*MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))

	m := &prometheusModels.Metric{}
	require.NoError(t, miImpl.ServerInfo.Write(m))

	t.Run("gauge value is always 1", func(t *testing.T) {
		require.Equal(t, 1.0, m.Gauge.GetValue())
	})

	t.Run("carries the build information as labels", func(t *testing.T) {
		labels := map[string]string{}
		for _, pair := range m.GetLabel() {
			labels[pair.GetName()] = pair.GetValue()
		}
		for key, want := range map[string]string{
			"version":               model.CurrentVersion,
			"build_number":          model.BuildNumber,
			"build_hash":            model.BuildHash,
			"build_hash_enterprise": model.BuildHashEnterprise,
		} {
			require.Contains(t, labels, key)
			require.Equal(t, want, labels[key])
		}
	})
}
