// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package metrics

import (
	"fmt"
	"strconv"
	"strings"
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
		*cfg.MetricsSettings.EnableClientMetrics = true
		*cfg.MetricsSettings.EnableNotificationMetrics = true
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

func TestMobileMetrics(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)
	defer th.TearDown()

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

type MetricsSection struct {
	Title   string
	Metrics []*prometheusModels.MetricFamily
}

// This needs the docker containers running (make start-docker is enough)
func TestGather(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)
	defer th.TearDown()

	configureMetrics(th)
	mi := th.App.Srv().Platform().Metrics()

	// We need to register the DB collector explicitly to get the go_sql_* metrics
	mi.RegisterDBCollector(th.Server.GetStore().GetInternalMasterDB(), "master")

	sections := make(map[string]*MetricsSection)

	// Custom, by MM
	sections["mattermost_api"] = &MetricsSection{"API metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_cache"] = &MetricsSection{"Caching metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_cluster"] = &MetricsSection{"Cluster metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_db"] = &MetricsSection{"Database metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_http"] = &MetricsSection{"HTTP metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_login"] = &MetricsSection{"Login and session metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_post"] = &MetricsSection{"Mattermost channels metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_search"] = &MetricsSection{"Search metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_websocket"] = &MetricsSection{"WebSocket metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_logging"] = &MetricsSection{"Logging metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_system"] = &MetricsSection{"Debugging metrics - system", []*prometheusModels.MetricFamily{}}
	sections["mattermost_jobs"] = &MetricsSection{"Debugging metrics - jobs", []*prometheusModels.MetricFamily{}}
	sections["mattermost_plugin"] = &MetricsSection{"Plugin metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_shared"] = &MetricsSection{"Shared metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_remote"] = &MetricsSection{"Remote cluster metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_notifications"] = &MetricsSection{"Notification metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_mobileapp"] = &MetricsSection{"Mobile app metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_webapp"] = &MetricsSection{"Web app metrics", []*prometheusModels.MetricFamily{}}
	// Custom, by other collectors
	sections["go_sql"] = &MetricsSection{"Database connection metrics", []*prometheusModels.MetricFamily{}}
	sections["mattermost_process"] = &MetricsSection{"Process metrics", []*prometheusModels.MetricFamily{}}

	sectionsByTitle := make(map[string]*MetricsSection)
	for _, section := range sections {
		sectionsByTitle[section.Title] = section
	}

	// The *Vec metrics need to be observed at least once in order to Gather to report them back.
	// This is error-prone, since we can (we will) definitely forget some
	// Notifications
	mi.IncrementNotificationAckCounter("", "")
	mi.IncrementNotificationCounter("", "")
	mi.IncrementNotificationErrorCounter("", "", "")
	mi.IncrementNotificationNotSentCounter("", "", "")
	mi.IncrementNotificationSuccessCounter("", "")
	mi.IncrementNotificationUnsupportedCounter("", "", "")
	// RemoteCluster
	mi.IncrementRemoteClusterConnStateChangeCounter("", true)
	mi.IncrementRemoteClusterMsgErrorsCounter("", true)
	mi.IncrementRemoteClusterMsgReceivedCounter("")
	mi.IncrementRemoteClusterMsgSentCounter("")
	mi.ObserveRemoteClusterClockSkew("", 0)
	mi.ObserveRemoteClusterPingDuration("", 0)
	// MobileClient
	mi.ObserveMobileClientChannelSwitchDuration("", 0)
	mi.ObserveMobileClientLoadDuration("", 0)
	mi.ObserveMobileClientTeamSwitchDuration("", 0)
	// API
	mi.ObserveAPIEndpointDuration("", "", "", "", "", 0)
	// Webapp
	mi.IncrementClientLongTasks("", "", 0)
	mi.ObserveClientChannelSwitchDuration("", "", 0)
	mi.ObserveClientCumulativeLayoutShift("", "", 0)
	mi.ObserveClientFirstContentfulPaint("", "", 0)
	mi.ObserveClientInteractionToNextPaint("", "", "", 0)
	mi.ObserveClientLargestContentfulPaint("", "", "", 0)
	mi.ObserveClientPageLoadDuration("", "", 0)
	mi.ObserveClientRHSLoadDuration("", "", 0)
	mi.ObserveClientTeamSwitchDuration("", "", 0)
	mi.ObserveClientTimeToFirstByte("", "", 0)
	mi.ObserveGlobalThreadsLoadDuration("", "", 0)
	// Jobs
	mi.IncrementJobActive("")
	// Cache
	mi.IncrementEtagHitCounter("")
	mi.IncrementEtagMissCounter("")
	// DB
	mi.ObserveStoreMethodDuration("", "", 0)
	// Redis
	mi.ObserveRedisEndpointDuration("", "", 0)
	// Plugins
	mi.ObservePluginAPIDuration("", "", true, 0)
	mi.ObservePluginHookDuration("", "", true, 0)
	mi.ObservePluginMultiHookDuration(0)
	mi.ObservePluginMultiHookIterationDuration("", 0)
	// Shared channels
	mi.IncrementSharedChannelsSyncCounter("")
	mi.ObserveSharedChannelsQueueSize(0)
	mi.ObserveSharedChannelsSyncCollectionDuration("", 0)
	mi.ObserveSharedChannelsSyncCollectionStepDuration("", "", 0)
	mi.ObserveSharedChannelsSyncSendDuration("", 0)
	mi.ObserveSharedChannelsSyncSendStepDuration("", "", 0)
	mi.ObserveSharedChannelsTaskInQueueDuration(0)
	// Replica
	mi.SetReplicaLagAbsolute("", 0)
	mi.SetReplicaLagTime("", 0)
	// Cache
	mi.AddMemCacheHitCounter("", 0)
	mi.AddMemCacheMissCounter("", 0)
	mi.IncrementMemCacheHitCounter("")
	mi.IncrementMemCacheHitCounterSession()
	mi.IncrementMemCacheInvalidationCounter("")
	mi.IncrementMemCacheInvalidationCounterSession()
	mi.IncrementMemCacheMissCounter("")
	mi.IncrementMemCacheMissCounterSession()
	// Cluster
	mi.IncrementClusterEventType("")
	// Websockets
	mi.DecrementHTTPWebSockets("")
	mi.DecrementWebSocketBroadcastBufferSize("", 0)
	mi.DecrementWebSocketBroadcastUsersRegistered("", 0)
	mi.IncrementHTTPWebSockets("")
	mi.IncrementWebSocketBroadcast("")
	mi.IncrementWebSocketBroadcastBufferSize("", 0)
	mi.IncrementWebSocketBroadcastUsersRegistered("", 0)
	mi.IncrementWebsocketEvent("")
	mi.IncrementWebsocketReconnectEvent("")
	// Logger
	mi.GetLoggerMetricsCollector().LoggedCounter("")
	mi.GetLoggerMetricsCollector().BlockedCounter("")
	mi.GetLoggerMetricsCollector().DroppedCounter("")
	mi.GetLoggerMetricsCollector().ErrorCounter("")
	mi.GetLoggerMetricsCollector().QueueSizeGauge("")

	metrics, err := mi.Gather()
	require.NoError(t, err)
	require.NotEmpty(t, metrics)
	for _, metric := range metrics {
		require.NotNil(t, metric)

		// Skip standard Go metrics (go_sql is not standard, but its prefix is still go :shrug:)
		if strings.HasPrefix(metric.GetName(), "go") && !strings.HasPrefix(metric.GetName(), "go_sql") {
			continue
		}

		// Get prefix and verify it is covered by the sections map
		fields := strings.Split(metric.GetName(), "_")
		require.GreaterOrEqual(t, len(fields), 2)
		prefix := strings.Join(fields[:2], "_")
		require.Contains(t, sections, prefix)

		// Add the metric to its corresponding section
		section := sections[prefix]
		section.Metrics = append(section.Metrics, metric)
	}

	// Verify that all specified sections have at least one metric
	for _, section := range sections {
		require.NotEmpty(t, section.Metrics, "If a section has no metrics it means we need to observe it; i.e., call its Increment/Decrement/Observe function.")
	}

	// Specify the current order in the docs
	order := []string{
		"API metrics",
		"Caching metrics",
		"Cluster metrics",
		"Database metrics",
		"Database connection metrics",
		"HTTP metrics",
		"Login and session metrics",
		"Mattermost channels metrics",
		"Process metrics",
		"Search metrics",
		"WebSocket metrics",
		"Logging metrics",
		"Debugging metrics - system",
		"Debugging metrics - jobs",
		"Plugin metrics",
		"Shared metrics",
		"Remote cluster metrics",
		"Notification metrics",
		"Mobile app metrics",
		"Web app metrics",
	}

	for _, title := range order {
		fmt.Println(title)
		fmt.Println(strings.Repeat("~", len(title)))

		section := sectionsByTitle[title]
		fmt.Println("")
		for _, metric := range section.Metrics {
			dot := "."
			if strings.HasSuffix(metric.GetHelp(), ".") {
				dot = ""
			}
			fmt.Printf("- ``%s``: %s%s\n", metric.GetName(), metric.GetHelp(), dot)
		}
		fmt.Println()
	}
}
