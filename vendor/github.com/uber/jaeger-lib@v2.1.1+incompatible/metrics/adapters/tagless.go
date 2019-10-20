// Copyright (c) 2018 Uber Technologies, Inc.
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

package adapters

import (
	"time"

	"github.com/uber/jaeger-lib/metrics"
)

// TaglessOptions defines the information associated with a metric
type TaglessOptions struct {
	Name string
	Help string
}

// TaglessTimerOptions defines the information associated with a metric
type TaglessTimerOptions struct {
	Name    string
	Help    string
	Buckets []time.Duration
}

// TaglessHistogramOptions defines the information associated with a metric
type TaglessHistogramOptions struct {
	Name    string
	Help    string
	Buckets []float64
}

// FactoryWithoutTags creates metrics based on name only, without tags.
// Suitable for integrating with statsd-like backends that don't support tags.
type FactoryWithoutTags interface {
	Counter(options TaglessOptions) metrics.Counter
	Gauge(options TaglessOptions) metrics.Gauge
	Timer(options TaglessTimerOptions) metrics.Timer
	Histogram(options TaglessHistogramOptions) metrics.Histogram
}

// WrapFactoryWithoutTags creates a real metrics.Factory that supports subscopes.
func WrapFactoryWithoutTags(f FactoryWithoutTags, options Options) metrics.Factory {
	return WrapFactoryWithTags(
		&tagless{
			Options: defaultOptions(options),
			factory: f,
		},
		options,
	)
}

// tagless implements FactoryWithTags
type tagless struct {
	Options
	factory FactoryWithoutTags
}

func (f *tagless) Counter(options metrics.Options) metrics.Counter {
	fullName := f.getFullName(options.Name, options.Tags)
	return f.factory.Counter(TaglessOptions{
		Name: fullName,
		Help: options.Help,
	})
}

func (f *tagless) Gauge(options metrics.Options) metrics.Gauge {
	fullName := f.getFullName(options.Name, options.Tags)
	return f.factory.Gauge(TaglessOptions{
		Name: fullName,
		Help: options.Help,
	})
}

func (f *tagless) Timer(options metrics.TimerOptions) metrics.Timer {
	fullName := f.getFullName(options.Name, options.Tags)
	return f.factory.Timer(TaglessTimerOptions{
		Name:    fullName,
		Help:    options.Help,
		Buckets: options.Buckets,
	})
}

func (f *tagless) Histogram(options metrics.HistogramOptions) metrics.Histogram {
	fullName := f.getFullName(options.Name, options.Tags)
	return f.factory.Histogram(TaglessHistogramOptions{
		Name:    fullName,
		Help:    options.Help,
		Buckets: options.Buckets,
	})
}

func (f *tagless) getFullName(name string, tags map[string]string) string {
	return metrics.GetKey(name, tags, f.TagsSep, f.TagKVSep)
}
