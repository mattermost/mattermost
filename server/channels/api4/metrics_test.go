// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func setupMetricsMock() *mocks.MetricsInterface {
	metricsMock := &mocks.MetricsInterface{}
	metricsMock.On("IncrementWebsocketEvent", mock.AnythingOfType("model.WebsocketEventType")).Return()
	metricsMock.On("IncrementWebSocketBroadcastBufferSize", mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()
	metricsMock.On("DecrementWebSocketBroadcastBufferSize", mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()
	metricsMock.On("IncrementMemCacheInvalidationCounter", mock.AnythingOfType("string")).Return()
	metricsMock.On("IncrementMemCacheMissCounter", mock.AnythingOfType("string")).Return()
	metricsMock.On("IncrementMemCacheHitCounter", mock.AnythingOfType("string")).Return()
	metricsMock.On("GetLoggerMetricsCollector").Return(nil)
	metricsMock.On("IncrementMemCacheHitCounterSession").Return()
	metricsMock.On("IncrementHTTPError").Return()
	metricsMock.On("IncrementHTTPRequest").Return()
	metricsMock.On("ObserveAPIEndpointDuration", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()
	metricsMock.On("ObserveRedisEndpointDuration", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()
	metricsMock.On("Register").Return()

	return metricsMock
}
func TestSubmitMetrics(t *testing.T) {
	t.Run("unauthenticated user should not submit metrics", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		_, err := th.Client.Logout(th.Context.Context())
		require.NoError(t, err)

		resp, err := th.Client.SubmitClientMetrics(th.Context.Context(), nil)

		require.Error(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	// if the metrics is not enabled on server, we don't want to return
	// an error code.
	t.Run("metrics not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		resp, err := th.Client.SubmitClientMetrics(th.Context.Context(), nil)

		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("metrics enabled but invalid version", func(t *testing.T) {
		metricsMock := setupMetricsMock()

		platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
			return metricsMock
		})
		t.Cleanup(func() {
			platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
				return nil
			})
		})

		th := SetupEnterpriseWithServerOptions(t, []app.Option{app.StartMetrics})
		defer th.TearDown()

		// enable metrics and add the license
		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.ListenAddress = ":0" })

		resp, err := th.Client.SubmitClientMetrics(th.Context.Context(), &model.PerformanceReport{
			Version: "0.1",
		})

		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("metrics enabled and valid", func(t *testing.T) {
		metricsMock := setupMetricsMock()
		metricsMock.On("IncrementClientLongTasks", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()

		platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
			return metricsMock
		})
		t.Cleanup(func() {
			platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
				return nil
			})
		})

		th := SetupEnterpriseWithServerOptions(t, []app.Option{app.StartMetrics})
		defer th.TearDown()

		// enable metrics and add the license
		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.ListenAddress = ":0" })

		resp, err := th.Client.SubmitClientMetrics(th.Context.Context(), &model.PerformanceReport{
			Version: "0.1",
			Start:   float64(time.Now().Add(-1 * time.Minute).UnixMilli()),
			End:     float64(time.Now().UnixMilli()),
			Counters: []*model.MetricSample{
				{Metric: model.ClientLongTasks, Value: 1},
			},
		})

		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("metrics enabled but client metrics are disabled", func(t *testing.T) {
		metricsMock := setupMetricsMock()

		platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
			return metricsMock
		})
		t.Cleanup(func() {
			platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
				return nil
			})
		})

		th := SetupEnterpriseWithServerOptions(t, []app.Option{app.StartMetrics})
		defer th.TearDown()

		// enable metrics and add the license
		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.EnableClientMetrics = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.ListenAddress = ":0" })

		resp, err := th.Client.SubmitClientMetrics(th.Context.Context(), &model.PerformanceReport{
			Version: "0.1",
			Start:   float64(time.Now().Add(-1 * time.Minute).UnixMilli()),
			End:     float64(time.Now().UnixMilli()),
			Counters: []*model.MetricSample{
				{Metric: model.ClientLongTasks, Value: 1},
			},
		})

		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("metrics recorded for API errors", func(t *testing.T) {
		metricsMock := setupMetricsMock()
		metricsMock.On("IncrementClientLongTasks", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()

		platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
			return metricsMock
		})
		t.Cleanup(func() {
			platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
				return nil
			})
		})

		th := SetupEnterpriseWithServerOptions(t, []app.Option{app.StartMetrics})
		defer th.TearDown()

		// enable metrics and add the license
		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.ListenAddress = ":0" })

		_, resp, err := th.Client.CreatePost(th.Context.Context(), &model.Post{
			ChannelId: model.NewId(),
		})

		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		metricsMock.AssertCalled(t, "IncrementHTTPRequest")
		metricsMock.AssertCalled(t, "IncrementHTTPError")
	})

	t.Run("metrics recorded for URL length limit errors", func(t *testing.T) {
		metricsMock := setupMetricsMock()
		metricsMock.On("IncrementClientLongTasks", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()

		platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
			return metricsMock
		})
		t.Cleanup(func() {
			platform.RegisterMetricsInterface(func(_ *platform.PlatformService, _, _ string) einterfaces.MetricsInterface {
				return nil
			})
		})

		th := SetupEnterpriseWithServerOptions(t, []app.Option{app.StartMetrics})
		defer th.TearDown()

		// enable metrics and add the license
		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.MetricsSettings.ListenAddress = ":0" })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MaximumURLLength = 1 })

		_, resp, err := th.Client.CreatePost(th.Context.Context(), &model.Post{
			ChannelId: model.NewId(),
		})

		require.Error(t, err)
		require.Equal(t, http.StatusRequestURITooLong, resp.StatusCode)
		metricsMock.AssertCalled(t, "IncrementHTTPRequest")
		metricsMock.AssertCalled(t, "IncrementHTTPError")
	})
}
