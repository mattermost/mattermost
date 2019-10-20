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
	"sync"

	"github.com/uber/jaeger-lib/metrics"
)

type cache struct {
	lock       sync.Mutex
	counters   map[string]metrics.Counter
	gauges     map[string]metrics.Gauge
	timers     map[string]metrics.Timer
	histograms map[string]metrics.Histogram
}

func newCache() *cache {
	return &cache{
		counters:   make(map[string]metrics.Counter),
		gauges:     make(map[string]metrics.Gauge),
		timers:     make(map[string]metrics.Timer),
		histograms: make(map[string]metrics.Histogram),
	}
}

func (r *cache) getOrSetCounter(name string, create func() metrics.Counter) metrics.Counter {
	r.lock.Lock()
	defer r.lock.Unlock()
	c, ok := r.counters[name]
	if !ok {
		c = create()
		r.counters[name] = c
	}
	return c
}

func (r *cache) getOrSetGauge(name string, create func() metrics.Gauge) metrics.Gauge {
	r.lock.Lock()
	defer r.lock.Unlock()
	g, ok := r.gauges[name]
	if !ok {
		g = create()
		r.gauges[name] = g
	}
	return g
}

func (r *cache) getOrSetTimer(name string, create func() metrics.Timer) metrics.Timer {
	r.lock.Lock()
	defer r.lock.Unlock()
	t, ok := r.timers[name]
	if !ok {
		t = create()
		r.timers[name] = t
	}
	return t
}

func (r *cache) getOrSetHistogram(name string, create func() metrics.Histogram) metrics.Histogram {
	r.lock.Lock()
	defer r.lock.Unlock()
	t, ok := r.histograms[name]
	if !ok {
		t = create()
		r.histograms[name] = t
	}
	return t
}
