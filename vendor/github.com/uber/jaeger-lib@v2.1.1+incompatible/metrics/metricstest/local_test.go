package metricstest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uber/jaeger-lib/metrics"
)

func TestLocalMetrics(t *testing.T) {
	tags := map[string]string{
		"x": "y",
	}

	f := NewFactory(0)
	defer f.Stop()
	f.Counter(metrics.Options{
		Name: "my-counter",
		Tags: tags,
	}).Inc(4)
	f.Counter(metrics.Options{
		Name: "my-counter",
		Tags: tags,
	}).Inc(6)
	f.Counter(metrics.Options{
		Name: "my-counter",
	}).Inc(6)
	f.Counter(metrics.Options{
		Name: "other-counter",
	}).Inc(8)
	f.Gauge(metrics.Options{
		Name: "my-gauge",
	}).Update(25)
	f.Gauge(metrics.Options{
		Name: "my-gauge",
	}).Update(43)
	f.Gauge(metrics.Options{
		Name: "other-gauge",
	}).Update(74)
	f.Namespace(metrics.NSOptions{
		Name: "namespace",
		Tags: tags,
	}).Counter(metrics.Options{
		Name: "my-counter",
	}).Inc(7)
	f.Namespace(metrics.NSOptions{
		Name: "ns.subns",
	}).Counter(metrics.Options{
		Tags: map[string]string{"service": "a-service"},
	}).Inc(9)

	timings := map[string][]time.Duration{
		"foo-latency": {
			time.Second * 35,
			time.Second * 6,
			time.Millisecond * 576,
			time.Second * 12,
		},
		"bar-latency": {
			time.Minute*4 + time.Second*34,
			time.Minute*7 + time.Second*12,
			time.Second * 625,
			time.Second * 12,
		},
	}

	for metric, timing := range timings {
		for _, d := range timing {
			f.Timer(metrics.TimerOptions{
				Name: metric,
			}).Record(d)
		}
	}

	histogram := f.Histogram(metrics.HistogramOptions{
		Name: "my-histo",
	})
	histogram.Record(321)
	histogram.Record(42)

	c, g := f.Snapshot()
	require.NotNil(t, c)
	require.NotNil(t, g)

	assert.Equal(t, map[string]int64{
		"my-counter|x=y":             10,
		"my-counter":                 6,
		"other-counter":              8,
		"namespace.my-counter|x=y":   7,
		"ns.subns|service=a-service": 9,
	}, c)

	assert.Equal(t, map[string]int64{
		"bar-latency.P50":  278527,
		"bar-latency.P75":  278527,
		"bar-latency.P90":  442367,
		"bar-latency.P95":  442367,
		"bar-latency.P99":  442367,
		"bar-latency.P999": 442367,
		"foo-latency.P50":  6143,
		"foo-latency.P75":  12287,
		"foo-latency.P90":  36863,
		"foo-latency.P95":  36863,
		"foo-latency.P99":  36863,
		"foo-latency.P999": 36863,
		"my-gauge":         43,
		"my-histo.P50":     43,
		"my-histo.P75":     335,
		"my-histo.P90":     335,
		"my-histo.P95":     335,
		"my-histo.P99":     335,
		"my-histo.P999":    335,
		"other-gauge":      74,
	}, g)

	f.Clear()
	c, g = f.Snapshot()
	require.Empty(t, c)
	require.Empty(t, g)
}

func TestLocalMetricsInterval(t *testing.T) {
	refreshInterval := time.Millisecond
	const relativeCheckFrequency = 5 // check 5 times per refreshInterval
	const maxChecks = 2 * relativeCheckFrequency
	checkInterval := (refreshInterval * relativeCheckFrequency) / maxChecks

	f := NewFactory(refreshInterval)
	defer f.Stop()

	f.Timer(metrics.TimerOptions{
		Name: "timer",
	}).Record(1)

	f.tm.Lock()
	timer := f.timers["timer"]
	f.tm.Unlock()
	assert.NotNil(t, timer)

	// timer.hist.Current is modified on every Rotate(), which is called by Backend after every refreshInterval
	getCurr := func() interface{} {
		timer.Lock()
		defer timer.Unlock()
		return timer.hist.Current
	}

	curr := getCurr()

	// wait for twice as long as the refresh interval
	for i := 0; i < maxChecks; i++ {
		time.Sleep(checkInterval)

		if getCurr() != curr {
			return
		}
	}
	t.Fail()
}
