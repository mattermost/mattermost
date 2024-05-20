package app

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/enterprise/metrics"
	"github.com/prometheus/client_golang/prometheus"
	prometheusModels "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
)

func configureMetrics(th *TestHelper) {
	th.App.Srv().SetLicense(nil) // clear license
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MetricsSettings.Enable = true
		*cfg.MetricsSettings.ListenAddress = ":0"
	})
	th.App.Srv().SetLicense(model.NewTestLicense("metrics"))
}
func TestMobileMetrics(t *testing.T) {
	th := SetupEnterprise(t, StartMetrics)
	defer th.TearDown()

	configureMetrics(th)
	mi := th.App.Metrics()

	miImpl, ok := mi.(*metrics.MetricsInterfaceImpl)
	require.True(t, ok, fmt.Sprintf("App.Metrics is not *MetricsInterfaceImpl, but %T", mi))
	m := &prometheusModels.Metric{}

	agent := "rnapp"

	for _, platform := range []string{"ios", "android"} {
		ttcc := []struct {
			name         string
			histogramVec *prometheus.HistogramVec
			elapsed      float64
			metricName   model.MetricType
		}{
			{
				name:         "load duration",
				histogramVec: miImpl.MobileClientLoadDuration,
				elapsed:      5.1,
				metricName:   model.MobileClientLoadDuration,
			},
			{
				name:         "channel switch duration",
				histogramVec: miImpl.MobileClientChannelSwitchDuration,
				elapsed:      0.501,
				metricName:   model.MobileClientChannelSwitchDuration,
			},
			{
				name:         "team switch duration",
				histogramVec: miImpl.MobileClientTeamSwitchDuration,
				elapsed:      0.301,
				metricName:   model.MobileClientTeamSwitchDuration,
			},
		}

		histograms := []*model.MetricSample{}
		var start int64 = 125
		var end int64 = start + int64(len(ttcc))
		// Precheck
		for i, tc := range ttcc {
			actualMetric, err := tc.histogramVec.GetMetricWith(prometheus.Labels{"platform": platform, "agent": agent})
			require.NoError(t, err)
			require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
			require.Equal(t, uint64(0), m.Histogram.GetSampleCount())
			require.Equal(t, 0.0, m.Histogram.GetSampleSum())
			histograms = append(histograms, &model.MetricSample{
				Metric:    tc.metricName,
				Value:     tc.elapsed,
				Timestamp: start + int64(i),
			})
		}

		appErr := th.App.RegisterPerformanceReport(th.Context, &model.PerformanceReport{
			Version:  "0.1.0",
			ClientID: "",
			Labels: map[string]string{
				"agent":    agent,
				"platform": platform,
			},
			Start:      start,
			End:        end,
			Counters:   []*model.MetricSample{},
			Histograms: histograms,
		})
		require.Nil(t, appErr)

		// After check
		for _, tc := range ttcc {
			actualMetric, err := tc.histogramVec.GetMetricWith(prometheus.Labels{"platform": platform, "agent": agent})
			require.NoError(t, err)
			require.NoError(t, actualMetric.(prometheus.Histogram).Write(m))
			require.Equal(t, uint64(1), m.Histogram.GetSampleCount())
			require.InDelta(t, tc.elapsed, m.Histogram.GetSampleSum(), 0.001, "not equal value in %s", tc.name)
		}
	}
}
