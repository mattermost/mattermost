// Copyright (c) 2017 Uber Technologies, Inc.
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

package multi

import (
	"time"

	"github.com/uber/jaeger-lib/metrics"
)

// Factory is a metrics factory that dispatches to multiple metrics backends.
type Factory struct {
	factories []metrics.Factory
}

// New creates a new multi.Factory that will dispatch to multiple metrics backends.
func New(factories ...metrics.Factory) *Factory {
	return &Factory{
		factories: factories,
	}
}

type counter struct {
	counters []metrics.Counter
}

func (c *counter) Inc(delta int64) {
	for _, counter := range c.counters {
		counter.Inc(delta)
	}
}

// Counter implements metrics.Factory interface
func (f *Factory) Counter(options metrics.Options) metrics.Counter {
	counter := &counter{
		counters: make([]metrics.Counter, len(f.factories)),
	}
	for i, factory := range f.factories {
		counter.counters[i] = factory.Counter(options)
	}
	return counter
}

type timer struct {
	timers []metrics.Timer
}

func (t *timer) Record(delta time.Duration) {
	for _, timer := range t.timers {
		timer.Record(delta)
	}
}

// Timer implements metrics.Factory interface
func (f *Factory) Timer(options metrics.TimerOptions) metrics.Timer {
	timer := &timer{
		timers: make([]metrics.Timer, len(f.factories)),
	}
	for i, factory := range f.factories {
		timer.timers[i] = factory.Timer(options)
	}
	return timer
}

type histogram struct {
	histograms []metrics.Histogram
}

func (h *histogram) Record(value float64) {
	for _, histogram := range h.histograms {
		histogram.Record(value)
	}
}

// Histogram implements metrics.Factory interface
func (f *Factory) Histogram(options metrics.HistogramOptions) metrics.Histogram {
	histogram := &histogram{
		histograms: make([]metrics.Histogram, len(f.factories)),
	}
	for i, factory := range f.factories {
		histogram.histograms[i] = factory.Histogram(options)
	}
	return histogram
}

type gauge struct {
	gauges []metrics.Gauge
}

func (t *gauge) Update(value int64) {
	for _, gauge := range t.gauges {
		gauge.Update(value)
	}
}

// Gauge implements metrics.Factory interface
func (f *Factory) Gauge(options metrics.Options) metrics.Gauge {
	gauge := &gauge{
		gauges: make([]metrics.Gauge, len(f.factories)),
	}
	for i, factory := range f.factories {
		gauge.gauges[i] = factory.Gauge(options)
	}
	return gauge
}

// Namespace implements metrics.Factory interface
func (f *Factory) Namespace(scope metrics.NSOptions) metrics.Factory {
	newFactory := &Factory{
		factories: make([]metrics.Factory, len(f.factories)),
	}
	for i, factory := range f.factories {
		newFactory.factories[i] = factory.Namespace(scope)
	}
	return newFactory
}
