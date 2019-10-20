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

package tally

import (
	"github.com/uber-go/tally"

	"github.com/uber/jaeger-lib/metrics"
)

// Wrap takes a tally Scope and returns jaeger-lib metrics.Factory.
func Wrap(scope tally.Scope) metrics.Factory {
	return &factory{
		tally: scope,
	}
}

// TODO implement support for tags if tally.Scope does not support them
type factory struct {
	tally tally.Scope
}

func (f *factory) Counter(options metrics.Options) metrics.Counter {
	scope := f.tally
	if len(options.Tags) > 0 {
		scope = scope.Tagged(options.Tags)
	}
	return NewCounter(scope.Counter(options.Name))
}

func (f *factory) Gauge(options metrics.Options) metrics.Gauge {
	scope := f.tally
	if len(options.Tags) > 0 {
		scope = scope.Tagged(options.Tags)
	}
	return NewGauge(scope.Gauge(options.Name))
}

func (f *factory) Timer(options metrics.TimerOptions) metrics.Timer {
	scope := f.tally
	if len(options.Tags) > 0 {
		scope = scope.Tagged(options.Tags)
	}
	// TODO: Determine whether buckets can be used
	return NewTimer(scope.Timer(options.Name))
}

func (f *factory) Histogram(options metrics.HistogramOptions) metrics.Histogram {
	scope := f.tally
	if len(options.Tags) > 0 {
		scope = scope.Tagged(options.Tags)
	}
	return NewHistogram(scope.Histogram(options.Name, tally.ValueBuckets(options.Buckets)))
}

func (f *factory) Namespace(scope metrics.NSOptions) metrics.Factory {
	return &factory{
		tally: f.tally.SubScope(scope.Name).Tagged(scope.Tags),
	}
}
