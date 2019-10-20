package multi

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/metricstest"
)

var _ metrics.Factory = &Factory{} // API check

func TestMultiFactory(t *testing.T) {
	f1 := metricstest.NewFactory(time.Second)
	f2 := metricstest.NewFactory(time.Second)
	multi1 := New(f1, f2)
	multi2 := multi1.Namespace(metrics.NSOptions{
		Name: "ns2",
	})
	tags := map[string]string{"x": "y"}
	multi2.Counter(metrics.Options{
		Name: "counter",
		Tags: tags,
	}).Inc(42)
	multi2.Gauge(metrics.Options{
		Name: "gauge",
		Tags: tags,
	}).Update(42)
	multi2.Timer(metrics.TimerOptions{
		Name: "timer",
		Tags: tags,
	}).Record(42 * time.Millisecond)
	multi2.Histogram(metrics.HistogramOptions{
		Name: "histogram",
		Tags: tags,
	}).Record(42)

	for _, f := range []*metricstest.Factory{f1, f2} {
		f.AssertCounterMetrics(t,
			metricstest.ExpectedMetric{Name: "ns2.counter", Tags: tags, Value: 42})
		f.AssertGaugeMetrics(t,
			metricstest.ExpectedMetric{Name: "ns2.gauge", Tags: tags, Value: 42})
		_, g := f.Snapshot()
		assert.EqualValues(t, 43, g["ns2.timer|x=y.P99"])
		assert.EqualValues(t, 43, g["ns2.histogram|x=y.P99"])
	}
}
