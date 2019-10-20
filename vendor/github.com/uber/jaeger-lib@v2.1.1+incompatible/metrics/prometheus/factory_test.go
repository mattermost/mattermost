// Copyright (c) 2017 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package prometheus_test

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	promModel "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uber/jaeger-lib/metrics"
	. "github.com/uber/jaeger-lib/metrics/prometheus"
)

var _ metrics.Factory = new(Factory)

func TestOptions(t *testing.T) {
	f1 := New()
	assert.NotNil(t, f1)
}

func TestSeparator(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry), WithSeparator(SeparatorColon))
	c1 := f1.Namespace(metrics.NSOptions{
		Name: "bender",
	}).Counter(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"a": "b"},
		Help: "Help message",
	})
	c1.Inc(1)
	snapshot, err := registry.Gather()
	require.NoError(t, err)
	m1 := findMetric(t, snapshot, "bender:rodriguez_total", map[string]string{"a": "b"})
	assert.EqualValues(t, 1, m1.GetCounter().GetValue(), "%+v", m1)
}

func TestCounter(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	fDummy := f1.Namespace(metrics.NSOptions{})
	f2 := fDummy.Namespace(metrics.NSOptions{
		Name: "bender",
		Tags: map[string]string{"a": "b"},
	})
	f3 := f2.Namespace(metrics.NSOptions{})

	c1 := f2.Counter(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
		Help: "Help message",
	})
	c2 := f2.Counter(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	})
	c3 := f3.Counter(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	}) // same tags as c2, but from f3
	c1.Inc(1)
	c1.Inc(2)
	c2.Inc(3)
	c3.Inc(4)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "Help message", snapshot[0].GetHelp())

	m1 := findMetric(t, snapshot, "bender_rodriguez_total", map[string]string{"a": "b", "x": "y"})
	assert.EqualValues(t, 3, m1.GetCounter().GetValue(), "%+v", m1)

	m2 := findMetric(t, snapshot, "bender_rodriguez_total", map[string]string{"a": "b", "x": "z"})
	assert.EqualValues(t, 7, m2.GetCounter().GetValue(), "%+v", m2)
}

func TestCounterDefaultHelp(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	c1 := f1.Counter(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
	})
	c1.Inc(1)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "rodriguez", snapshot[0].GetHelp())
}

func TestGauge(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	f2 := f1.Namespace(metrics.NSOptions{
		Name: "bender",
		Tags: map[string]string{"a": "b"},
	})
	f3 := f2.Namespace(metrics.NSOptions{
		Tags: map[string]string{"a": "b"},
	}) // essentially same as f2
	g1 := f2.Gauge(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
		Help: "Help message",
	})
	g2 := f2.Gauge(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	})
	g3 := f3.Gauge(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	}) // same as g2, but from f3
	g1.Update(1)
	g1.Update(2)
	g2.Update(3)
	g3.Update(4)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "Help message", snapshot[0].GetHelp())

	m1 := findMetric(t, snapshot, "bender_rodriguez", map[string]string{"a": "b", "x": "y"})
	assert.EqualValues(t, 2, m1.GetGauge().GetValue(), "%+v", m1)

	m2 := findMetric(t, snapshot, "bender_rodriguez", map[string]string{"a": "b", "x": "z"})
	assert.EqualValues(t, 4, m2.GetGauge().GetValue(), "%+v", m2)
}

func TestGaugeDefaultHelp(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	g1 := f1.Gauge(metrics.Options{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
	})
	g1.Update(1)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "rodriguez", snapshot[0].GetHelp())
}

func TestTimer(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	f2 := f1.Namespace(metrics.NSOptions{
		Name: "bender",
		Tags: map[string]string{"a": "b"},
	})
	f3 := f2.Namespace(metrics.NSOptions{
		Tags: map[string]string{"a": "b"},
	}) // essentially same as f2
	t1 := f2.Timer(metrics.TimerOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
		Help: "Help message",
	})
	t2 := f2.Timer(metrics.TimerOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	})
	t3 := f3.Timer(metrics.TimerOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	}) // same as t2, but from f3
	t1.Record(1 * time.Second)
	t1.Record(2 * time.Second)
	t2.Record(3 * time.Second)
	t3.Record(4 * time.Second)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "Help message", snapshot[0].GetHelp())

	m1 := findMetric(t, snapshot, "bender_rodriguez", map[string]string{"a": "b", "x": "y"})
	assert.EqualValues(t, 2, m1.GetHistogram().GetSampleCount(), "%+v", m1)
	assert.EqualValues(t, 3, m1.GetHistogram().GetSampleSum(), "%+v", m1)
	for _, bucket := range m1.GetHistogram().GetBucket() {
		if bucket.GetUpperBound() < 1 {
			assert.EqualValues(t, 0, bucket.GetCumulativeCount())
		} else if bucket.GetUpperBound() < 2 {
			assert.EqualValues(t, 1, bucket.GetCumulativeCount())
		} else {
			assert.EqualValues(t, 2, bucket.GetCumulativeCount())
		}
	}

	m2 := findMetric(t, snapshot, "bender_rodriguez", map[string]string{"a": "b", "x": "z"})
	assert.EqualValues(t, 2, m2.GetHistogram().GetSampleCount(), "%+v", m2)
	assert.EqualValues(t, 7, m2.GetHistogram().GetSampleSum(), "%+v", m2)
	for _, bucket := range m2.GetHistogram().GetBucket() {
		if bucket.GetUpperBound() < 3 {
			assert.EqualValues(t, 0, bucket.GetCumulativeCount())
		} else if bucket.GetUpperBound() < 4 {
			assert.EqualValues(t, 1, bucket.GetCumulativeCount())
		} else {
			assert.EqualValues(t, 2, bucket.GetCumulativeCount())
		}
	}
}

func TestTimerDefaultHelp(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	t1 := f1.Timer(metrics.TimerOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
	})
	t1.Record(1 * time.Second)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "rodriguez", snapshot[0].GetHelp())
}

func TestTimerCustomBuckets(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry), WithBuckets([]float64{1.5}))
	// dot and dash in the metric name will be replaced with underscore
	t1 := f1.Timer(metrics.TimerOptions{
		Name:    "bender.bending-rodriguez",
		Tags:    map[string]string{"x": "y"},
		Buckets: []time.Duration{time.Nanosecond, 5 * time.Nanosecond},
	})
	t1.Record(1 * time.Second)
	t1.Record(2 * time.Second)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	m1 := findMetric(t, snapshot, "bender_bending_rodriguez", map[string]string{"x": "y"})
	assert.EqualValues(t, 2, m1.GetHistogram().GetSampleCount(), "%+v", m1)
	assert.EqualValues(t, 3, m1.GetHistogram().GetSampleSum(), "%+v", m1)
	assert.Len(t, m1.GetHistogram().GetBucket(), 2)
}

func TestHistogram(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	f2 := f1.Namespace(metrics.NSOptions{
		Name: "bender",
		Tags: map[string]string{"a": "b"},
	})
	f3 := f2.Namespace(metrics.NSOptions{
		Tags: map[string]string{"a": "b"},
	}) // essentially same as f2
	t1 := f2.Histogram(metrics.HistogramOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
		Help: "Help message",
	})
	t2 := f2.Histogram(metrics.HistogramOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	})
	t3 := f3.Histogram(metrics.HistogramOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "z"},
		Help: "Help message",
	}) // same as t2, but from f3
	t1.Record(1)
	t1.Record(2)
	t2.Record(3)
	t3.Record(4)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "Help message", snapshot[0].GetHelp())

	m1 := findMetric(t, snapshot, "bender_rodriguez", map[string]string{"a": "b", "x": "y"})
	assert.EqualValues(t, 2, m1.GetHistogram().GetSampleCount(), "%+v", m1)
	assert.EqualValues(t, 3, m1.GetHistogram().GetSampleSum(), "%+v", m1)
	for _, bucket := range m1.GetHistogram().GetBucket() {
		if bucket.GetUpperBound() < 1 {
			assert.EqualValues(t, 0, bucket.GetCumulativeCount())
		} else if bucket.GetUpperBound() < 2 {
			assert.EqualValues(t, 1, bucket.GetCumulativeCount())
		} else {
			assert.EqualValues(t, 2, bucket.GetCumulativeCount())
		}
	}

	m2 := findMetric(t, snapshot, "bender_rodriguez", map[string]string{"a": "b", "x": "z"})
	assert.EqualValues(t, 2, m2.GetHistogram().GetSampleCount(), "%+v", m2)
	assert.EqualValues(t, 7, m2.GetHistogram().GetSampleSum(), "%+v", m2)
	for _, bucket := range m2.GetHistogram().GetBucket() {
		if bucket.GetUpperBound() < 3 {
			assert.EqualValues(t, 0, bucket.GetCumulativeCount())
		} else if bucket.GetUpperBound() < 4 {
			assert.EqualValues(t, 1, bucket.GetCumulativeCount())
		} else {
			assert.EqualValues(t, 2, bucket.GetCumulativeCount())
		}
	}
}

func TestHistogramDefaultHelp(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	t1 := f1.Histogram(metrics.HistogramOptions{
		Name: "rodriguez",
		Tags: map[string]string{"x": "y"},
	})
	t1.Record(1)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	assert.EqualValues(t, "rodriguez", snapshot[0].GetHelp())
}

func TestHistogramCustomBuckets(t *testing.T) {
	registry := prometheus.NewPedanticRegistry()
	f1 := New(WithRegisterer(registry))
	// dot and dash in the metric name will be replaced with underscore
	t1 := f1.Histogram(metrics.HistogramOptions{
		Name:    "bender.bending-rodriguez",
		Tags:    map[string]string{"x": "y"},
		Buckets: []float64{1.5},
	})
	t1.Record(1)
	t1.Record(2)

	snapshot, err := registry.Gather()
	require.NoError(t, err)

	m1 := findMetric(t, snapshot, "bender_bending_rodriguez", map[string]string{"x": "y"})
	assert.EqualValues(t, 2, m1.GetHistogram().GetSampleCount(), "%+v", m1)
	assert.EqualValues(t, 3, m1.GetHistogram().GetSampleSum(), "%+v", m1)
	assert.Len(t, m1.GetHistogram().GetBucket(), 1)
}

func findMetric(t *testing.T, snapshot []*promModel.MetricFamily, name string, tags map[string]string) *promModel.Metric {
	for _, mf := range snapshot {
		if mf.GetName() != name {
			continue
		}
		for _, m := range mf.GetMetric() {
			if len(m.GetLabel()) != len(tags) {
				t.Fatalf("Mismatching labels for metric %v: want %v, have %v", name, tags, m.GetLabel())
			}
			match := true
			for _, l := range m.GetLabel() {
				if v, ok := tags[l.GetName()]; !ok || v != l.GetValue() {
					match = false
				}
			}
			if match {
				return m
			}
		}
	}
	t.Logf("Cannot find metric %v %v", name, tags)
	for _, nf := range snapshot {
		t.Logf("Family: %v", nf.GetName())
		for _, m := range nf.GetMetric() {
			t.Logf("==> %v", m)
		}
	}
	t.FailNow()
	return nil
}
