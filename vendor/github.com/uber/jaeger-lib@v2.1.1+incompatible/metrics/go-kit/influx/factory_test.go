package influx

import (
	"bytes"
	"fmt"
	"testing"
	"time"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/metrics/influx"
	influxdb "github.com/influxdata/influxdb/client/v2"
	"github.com/stretchr/testify/assert"

	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/go-kit"
)

func TestCounter(t *testing.T) {
	in := influx.New(map[string]string{}, influxdb.BatchPointsConfig{}, log.NewNopLogger())
	inf := NewFactory(in)
	wf := xkit.Wrap("namespace", inf)

	c := wf.Counter(metrics.Options{
		Name: "gokit.infl-counter",
		Tags: map[string]string{"label": "val1"},
	})
	c.Inc(7)

	assert.Contains(t, reportToString(in), "namespace.gokit.infl-counter,label=val1 count=7")
}

func TestGauge(t *testing.T) {
	in := influx.New(map[string]string{}, influxdb.BatchPointsConfig{}, log.NewNopLogger())
	inf := NewFactory(in)
	wf := xkit.Wrap("namespace", inf)

	g := wf.Gauge(metrics.Options{
		Name: "gokit.infl-gauge",
		Tags: map[string]string{"x": "y"},
	})
	g.Update(42)

	assert.Contains(t, reportToString(in), "namespace.gokit.infl-gauge,x=y value=42")
}

func TestTimer(t *testing.T) {
	in := influx.New(map[string]string{}, influxdb.BatchPointsConfig{}, log.NewNopLogger())
	inf := NewFactory(in)
	wf := xkit.Wrap("namespace", inf)

	timer := wf.Timer(metrics.TimerOptions{
		Name: "gokit.infl-timer",
		Tags: map[string]string{"x": "y"},
	})
	timer.Record(time.Second * 1)
	timer.Record(time.Second * 1)
	timer.Record(time.Second * 10)

	assert.Contains(t, reportToString(in), "namespace.gokit.infl-timer,x=y p50=1,p90=10,p95=10,p99=10")
}

func TestHistogram(t *testing.T) {
	in := influx.New(map[string]string{}, influxdb.BatchPointsConfig{}, log.NewNopLogger())
	inf := NewFactory(in)
	wf := xkit.Wrap("namespace", inf)

	histogram := wf.Histogram(metrics.HistogramOptions{
		Name: "gokit.infl-histogram",
		Tags: map[string]string{"x": "y"},
	})
	histogram.Record(1)
	histogram.Record(1)
	histogram.Record(10)

	assert.Contains(t, reportToString(in), "namespace.gokit.infl-histogram,x=y p50=1,p90=10,p95=10,p99=10")
}

func TestWrapperNamespaces(t *testing.T) {
	in := influx.New(map[string]string{}, influxdb.BatchPointsConfig{}, log.NewNopLogger())
	inf := NewFactory(in)
	wf := xkit.Wrap("namespace", inf)

	wf = wf.Namespace(metrics.NSOptions{
		Name: "bar",
		Tags: map[string]string{"bar_tag": "bar_tag"},
	})

	c := wf.Counter(metrics.Options{
		Name: "gokit.prom-wrapped-counter",
		Tags: map[string]string{"x": "y"},
	})
	c.Inc(42)

	assert.Contains(t, reportToString(in), "namespace.bar.gokit.prom-wrapped-counter,bar_tag=bar_tag,x=y count=42")
}

func TestCapabilities(t *testing.T) {
	in := influx.New(map[string]string{}, influxdb.BatchPointsConfig{}, log.NewNopLogger())
	inf := NewFactory(in)

	assert.True(t, inf.Capabilities().Tagging)
}

func reportToString(in *influx.Influx) string {
	client := &bufWriter{}
	in.WriteTo(client)
	return client.buf.String()
}

type bufWriter struct {
	buf bytes.Buffer
}

func (w *bufWriter) Write(bp influxdb.BatchPoints) error {
	for _, p := range bp.Points() {
		fmt.Fprintf(&w.buf, p.String()+"\n")
	}
	return nil
}
