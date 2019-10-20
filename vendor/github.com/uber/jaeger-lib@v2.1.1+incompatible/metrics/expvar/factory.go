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

package expvar

import (
	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/adapters"
	xkit "github.com/uber/jaeger-lib/metrics/go-kit"
	"github.com/uber/jaeger-lib/metrics/go-kit/expvar"
)

// NewFactory creates a new metrics factory using go-kit expvar package.
// buckets is the number of buckets to be used in histograms.
func NewFactory(buckets int) metrics.Factory {
	return adapters.WrapFactoryWithoutTags(
		&factory{
			factory: expvar.NewFactory(buckets),
		},
		adapters.Options{},
	)
}

type factory struct {
	factory xkit.Factory
}

func (f *factory) Counter(options adapters.TaglessOptions) metrics.Counter {
	return xkit.NewCounter(f.factory.Counter(options.Name))
}

func (f *factory) Gauge(options adapters.TaglessOptions) metrics.Gauge {
	return xkit.NewGauge(f.factory.Gauge(options.Name))
}

func (f *factory) Timer(options adapters.TaglessTimerOptions) metrics.Timer {
	// TODO: Provide support for buckets
	return xkit.NewTimer(f.factory.Histogram(options.Name))
}

func (f *factory) Histogram(options adapters.TaglessHistogramOptions) metrics.Histogram {
	// TODO: Provide support for buckets
	return xkit.NewHistogram(f.factory.Histogram(options.Name))
}
