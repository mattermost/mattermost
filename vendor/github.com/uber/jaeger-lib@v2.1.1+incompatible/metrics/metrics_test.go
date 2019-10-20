// Must use separate test package to break import cycle.
package metrics_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/metricstest"
)

func TestInitMetrics(t *testing.T) {
	testMetrics := struct {
		Gauge     metrics.Gauge     `metric:"gauge" tags:"1=one,2=two"`
		Counter   metrics.Counter   `metric:"counter"`
		Timer     metrics.Timer     `metric:"timer"`
		Histogram metrics.Histogram `metric:"histogram" buckets:"20,40,60,80"`
	}{}

	f := metricstest.NewFactory(0)
	defer f.Stop()

	globalTags := map[string]string{"key": "value"}

	err := metrics.Init(&testMetrics, f, globalTags)
	assert.NoError(t, err)

	testMetrics.Gauge.Update(10)
	testMetrics.Counter.Inc(5)
	testMetrics.Timer.Record(time.Duration(time.Second * 35))
	testMetrics.Histogram.Record(42)

	// wait for metrics
	for i := 0; i < 1000; i++ {
		c, _ := f.Snapshot()
		if _, ok := c["counter"]; ok {
			break
		}
		time.Sleep(1 * time.Millisecond)
	}

	c, g := f.Snapshot()

	assert.EqualValues(t, 5, c["counter|key=value"])
	assert.EqualValues(t, 10, g["gauge|1=one|2=two|key=value"])
	assert.EqualValues(t, 36863, g["timer|key=value.P50"])
	assert.EqualValues(t, 43, g["histogram|key=value.P50"])

	stopwatch := metrics.StartStopwatch(testMetrics.Timer)
	stopwatch.Stop()
	assert.True(t, 0 < stopwatch.ElapsedTime())
}

var (
	noMetricTag = struct {
		NoMetricTag metrics.Counter
	}{}

	badTags = struct {
		BadTags metrics.Counter `metric:"counter" tags:"1=one,noValue"`
	}{}

	invalidMetricType = struct {
		InvalidMetricType int64 `metric:"counter"`
	}{}

	badHistogramBucket = struct {
		BadHistogramBucket metrics.Histogram `metric:"histogram" buckets:"1,2,a,4"`
	}{}

	badTimerBucket = struct {
		BadTimerBucket metrics.Timer `metric:"timer" buckets:"1"`
	}{}

	invalidBuckets = struct {
		InvalidBuckets metrics.Counter `metric:"counter" buckets:"1"`
	}{}
)

func TestInitMetricsFailures(t *testing.T) {
	assert.EqualError(t, metrics.Init(&noMetricTag, nil, nil), "Field NoMetricTag is missing a tag 'metric'")

	assert.EqualError(t, metrics.Init(&badTags, nil, nil),
		"Field [BadTags]: Tag [noValue] is not of the form key=value in 'tags' string [1=one,noValue]")

	assert.EqualError(t, metrics.Init(&invalidMetricType, nil, nil),
		"Field InvalidMetricType is not a pointer to timer, gauge, or counter")

	assert.EqualError(t, metrics.Init(&badHistogramBucket, nil, nil),
		"Field [BadHistogramBucket]: Bucket [a] could not be converted to float64 in 'buckets' string [1,2,a,4]")

	assert.EqualError(t, metrics.Init(&badTimerBucket, nil, nil),
		"Field [BadTimerBucket]: Buckets are not currently initialized for timer metrics")

	assert.EqualError(t, metrics.Init(&invalidBuckets, nil, nil),
		"Field [InvalidBuckets]: Buckets should only be defined for Timer and Histogram metric types")

}

func TestInitPanic(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("The code did not panic")
		}
	}()

	metrics.MustInit(&noMetricTag, metrics.NullFactory, nil)
}

func TestNullMetrics(t *testing.T) {
	// This test is just for cover
	metrics.NullFactory.Timer(metrics.TimerOptions{
		Name: "name",
	}).Record(0)
	metrics.NullFactory.Counter(metrics.Options{
		Name: "name",
	}).Inc(0)
	metrics.NullFactory.Gauge(metrics.Options{
		Name: "name",
	}).Update(0)
	metrics.NullFactory.Histogram(metrics.HistogramOptions{
		Name: "name",
	}).Record(0)
	metrics.NullFactory.Namespace(metrics.NSOptions{
		Name: "name",
	}).Gauge(metrics.Options{
		Name: "name2",
	}).Update(0)
}
