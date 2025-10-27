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

func TestAutoTranslationMetrics(t *testing.T) {
	th := api4.SetupEnterprise(t, app.StartMetrics)

	configureMetrics(th)
	mi := th.App.Metrics()

	miImpl, ok := mi.(*MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))

	t.Run("test ObserveAutoTranslateRequestDuration", func(t *testing.T) {
		path := string(model.AutoTranslationPathCreate)
		provider := "libretranslate"
		dstLang := "es"
		contentLength := "medium"
		fieldCountBucket := "1-5"
		elapsed := 0.8
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateRequestDuration.GetMetricWith(prometheus.Labels{
			"path":           path,
			"provider":       provider,
			"dst_lang":       dstLang,
			"content_length": contentLength,
			"field_count":    fieldCountBucket,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
		require.Equal(t, 0.0, m.Histogram.GetSampleSum())

		mi.ObserveAutoTranslateRequestDuration(path, provider, dstLang, contentLength, fieldCountBucket, elapsed)
		actualMetric, err = miImpl.AutoTranslateRequestDuration.GetMetricWith(prometheus.Labels{
			"path":           path,
			"provider":       provider,
			"dst_lang":       dstLang,
			"content_length": contentLength,
			"field_count":    fieldCountBucket,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
		require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
	})

	t.Run("test IncrementAutoTranslateResult", func(t *testing.T) {
		state := "ready"
		path := string(model.AutoTranslationPathCreate)
		provider := "libretranslate"
		dstLang := "fr"
		fieldCountBucket := "1-5"
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateResultsCounter.GetMetricWith(prometheus.Labels{
			"state":       state,
			"path":        path,
			"provider":    provider,
			"dst_lang":    dstLang,
			"field_count": fieldCountBucket,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 0.0, m.Counter.GetValue())

		mi.IncrementAutoTranslateResult(state, path, provider, dstLang, fieldCountBucket)
		actualMetric, err = miImpl.AutoTranslateResultsCounter.GetMetricWith(prometheus.Labels{
			"state":       state,
			"path":        path,
			"provider":    provider,
			"dst_lang":    dstLang,
			"field_count": fieldCountBucket,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 1.0, m.Counter.GetValue())
	})

	t.Run("test IncrementAutoTranslateProviderCall", func(t *testing.T) {
		provider := "libretranslate"
		dstLang := "de"
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateProviderCalls.GetMetricWith(prometheus.Labels{
			"provider": provider,
			"dst_lang": dstLang,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 0.0, m.Counter.GetValue())

		mi.IncrementAutoTranslateProviderCall(provider, dstLang)
		actualMetric, err = miImpl.AutoTranslateProviderCalls.GetMetricWith(prometheus.Labels{
			"provider": provider,
			"dst_lang": dstLang,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 1.0, m.Counter.GetValue())
	})

	t.Run("test IncrementAutoTranslateDedupeInflight", func(t *testing.T) {
		m := &prometheusModels.Metric{}

		require.NoError(t, miImpl.AutoTranslateDedupeInflight.Write(m))
		initialValue := m.Counter.GetValue()

		mi.IncrementAutoTranslateDedupeInflight()
		require.NoError(t, miImpl.AutoTranslateDedupeInflight.Write(m))
		require.Equal(t, initialValue+1.0, m.Counter.GetValue())
	})

	t.Run("test IncrementAutoTranslateUpsert", func(t *testing.T) {
		operation := "insert"
		dstLang := "pt"
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateUpserts.GetMetricWith(prometheus.Labels{
			"operation": operation,
			"dst_lang":  dstLang,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 0.0, m.Counter.GetValue())

		mi.IncrementAutoTranslateUpsert(operation, dstLang)
		actualMetric, err = miImpl.AutoTranslateUpserts.GetMetricWith(prometheus.Labels{
			"operation": operation,
			"dst_lang":  dstLang,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 1.0, m.Counter.GetValue())
	})

	t.Run("test IncrementAutoTranslateProviderError", func(t *testing.T) {
		provider := "libretranslate"
		dstLang := "ja"
		errorType := "rate_limit"
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateProviderErrors.GetMetricWith(prometheus.Labels{
			"provider":   provider,
			"dst_lang":   dstLang,
			"error_type": errorType,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 0.0, m.Counter.GetValue())

		mi.IncrementAutoTranslateProviderError(provider, dstLang, errorType)
		actualMetric, err = miImpl.AutoTranslateProviderErrors.GetMetricWith(prometheus.Labels{
			"provider":   provider,
			"dst_lang":   dstLang,
			"error_type": errorType,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.Write(m))
		require.Equal(t, 1.0, m.Counter.GetValue())
	})

	t.Run("test ObserveAutoTranslateRateLimitWait", func(t *testing.T) {
		provider := "libretranslate"
		elapsed := 2.5
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateRateLimitWait.GetMetricWith(prometheus.Labels{
			"provider": provider,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
		require.Equal(t, 0.0, m.Histogram.GetSampleSum())

		mi.ObserveAutoTranslateRateLimitWait(provider, elapsed)
		actualMetric, err = miImpl.AutoTranslateRateLimitWait.GetMetricWith(prometheus.Labels{
			"provider": provider,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
		require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
	})

	t.Run("test ObserveAutoTranslateConcurrencyWait", func(t *testing.T) {
		provider := "libretranslate"
		elapsed := 0.15
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateConcurrencyWait.GetMetricWith(prometheus.Labels{
			"provider": provider,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
		require.Equal(t, 0.0, m.Histogram.GetSampleSum())

		mi.ObserveAutoTranslateConcurrencyWait(provider, elapsed)
		actualMetric, err = miImpl.AutoTranslateConcurrencyWait.GetMetricWith(prometheus.Labels{
			"provider": provider,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
		require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
	})

	t.Run("test ObserveAutoTranslateProviderBatchDuration", func(t *testing.T) {
		provider := "libretranslate"
		dstLang := "zh"
		fieldCountBucket := "6-20"
		elapsed := 1.2
		m := &prometheusModels.Metric{}

		actualMetric, err := miImpl.AutoTranslateProviderBatchDuration.GetMetricWith(prometheus.Labels{
			"provider":    provider,
			"dst_lang":    dstLang,
			"field_count": fieldCountBucket,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
		require.Equal(t, 0.0, m.Histogram.GetSampleSum())

		mi.ObserveAutoTranslateProviderBatchDuration(provider, dstLang, fieldCountBucket, elapsed)
		actualMetric, err = miImpl.AutoTranslateProviderBatchDuration.GetMetricWith(prometheus.Labels{
			"provider":    provider,
			"dst_lang":    dstLang,
			"field_count": fieldCountBucket,
		})
		require.NoError(t, err)
		require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
		require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
		require.InDelta(t, elapsed, m.Histogram.GetSampleSum(), 0.001)
	})
}
