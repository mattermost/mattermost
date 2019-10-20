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

package metricstest

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/codahale/hdrhistogram"
	"github.com/uber/jaeger-lib/metrics"
)

// This is intentionally very similar to github.com/codahale/metrics, the
// main difference being that counters/gauges are scoped to the provider
// rather than being global (to facilitate testing).

// A Backend is a metrics provider which aggregates data in-vm, and
// allows exporting snapshots to shove the data into a remote collector
type Backend struct {
	cm         sync.Mutex
	gm         sync.Mutex
	tm         sync.Mutex
	hm         sync.Mutex
	counters   map[string]*int64
	gauges     map[string]*int64
	timers     map[string]*localBackendTimer
	histograms map[string]*localBackendHistogram
	stop       chan struct{}
	wg         sync.WaitGroup
	TagsSep    string
	TagKVSep   string
}

// NewBackend returns a new Backend. The collectionInterval is the histogram
// time window for each timer.
func NewBackend(collectionInterval time.Duration) *Backend {
	b := &Backend{
		counters:   make(map[string]*int64),
		gauges:     make(map[string]*int64),
		timers:     make(map[string]*localBackendTimer),
		histograms: make(map[string]*localBackendHistogram),
		stop:       make(chan struct{}),
		TagsSep:    "|",
		TagKVSep:   "=",
	}
	if collectionInterval == 0 {
		// Use one histogram time window for all timers
		return b
	}
	b.wg.Add(1)
	go b.runLoop(collectionInterval)
	return b
}

// Clear discards accumulated stats
func (b *Backend) Clear() {
	b.cm.Lock()
	defer b.cm.Unlock()
	b.gm.Lock()
	defer b.gm.Unlock()
	b.tm.Lock()
	defer b.tm.Unlock()
	b.hm.Lock()
	defer b.hm.Unlock()
	b.counters = make(map[string]*int64)
	b.gauges = make(map[string]*int64)
	b.timers = make(map[string]*localBackendTimer)
	b.histograms = make(map[string]*localBackendHistogram)
}

func (b *Backend) runLoop(collectionInterval time.Duration) {
	defer b.wg.Done()
	ticker := time.NewTicker(collectionInterval)
	for {
		select {
		case <-ticker.C:
			b.tm.Lock()
			timers := make(map[string]*localBackendTimer, len(b.timers))
			for timerName, timer := range b.timers {
				timers[timerName] = timer
			}
			b.tm.Unlock()

			for _, t := range timers {
				t.Lock()
				t.hist.Rotate()
				t.Unlock()
			}
		case <-b.stop:
			ticker.Stop()
			return
		}
	}
}

// IncCounter increments a counter value
func (b *Backend) IncCounter(name string, tags map[string]string, delta int64) {
	name = metrics.GetKey(name, tags, b.TagsSep, b.TagKVSep)
	b.cm.Lock()
	defer b.cm.Unlock()
	counter := b.counters[name]
	if counter == nil {
		b.counters[name] = new(int64)
		*b.counters[name] = delta
		return
	}
	atomic.AddInt64(counter, delta)
}

// UpdateGauge updates the value of a gauge
func (b *Backend) UpdateGauge(name string, tags map[string]string, value int64) {
	name = metrics.GetKey(name, tags, b.TagsSep, b.TagKVSep)
	b.gm.Lock()
	defer b.gm.Unlock()
	gauge := b.gauges[name]
	if gauge == nil {
		b.gauges[name] = new(int64)
		*b.gauges[name] = value
		return
	}
	atomic.StoreInt64(gauge, value)
}

// RecordHistogram records a timing duration
func (b *Backend) RecordHistogram(name string, tags map[string]string, v float64) {
	name = metrics.GetKey(name, tags, b.TagsSep, b.TagKVSep)
	histogram := b.findOrCreateHistogram(name)
	histogram.Lock()
	histogram.hist.Current.RecordValue(int64(v))
	histogram.Unlock()
}

func (b *Backend) findOrCreateHistogram(name string) *localBackendHistogram {
	b.hm.Lock()
	defer b.hm.Unlock()
	if t, ok := b.histograms[name]; ok {
		return t
	}

	t := &localBackendHistogram{
		hist: hdrhistogram.NewWindowed(5, 0, int64((5*time.Minute)/time.Millisecond), 1),
	}
	b.histograms[name] = t
	return t
}

type localBackendHistogram struct {
	sync.Mutex
	hist *hdrhistogram.WindowedHistogram
}

// RecordTimer records a timing duration
func (b *Backend) RecordTimer(name string, tags map[string]string, d time.Duration) {
	name = metrics.GetKey(name, tags, b.TagsSep, b.TagKVSep)
	timer := b.findOrCreateTimer(name)
	timer.Lock()
	timer.hist.Current.RecordValue(int64(d / time.Millisecond))
	timer.Unlock()
}

func (b *Backend) findOrCreateTimer(name string) *localBackendTimer {
	b.tm.Lock()
	defer b.tm.Unlock()
	if t, ok := b.timers[name]; ok {
		return t
	}

	t := &localBackendTimer{
		hist: hdrhistogram.NewWindowed(5, 0, int64((5*time.Minute)/time.Millisecond), 1),
	}
	b.timers[name] = t
	return t
}

type localBackendTimer struct {
	sync.Mutex
	hist *hdrhistogram.WindowedHistogram
}

var (
	percentiles = map[string]float64{
		"P50":  50,
		"P75":  75,
		"P90":  90,
		"P95":  95,
		"P99":  99,
		"P999": 99.9,
	}
)

// Snapshot captures a snapshot of the current counter and gauge values
func (b *Backend) Snapshot() (counters, gauges map[string]int64) {
	b.cm.Lock()
	defer b.cm.Unlock()

	counters = make(map[string]int64, len(b.counters))
	for name, value := range b.counters {
		counters[name] = atomic.LoadInt64(value)
	}

	b.gm.Lock()
	defer b.gm.Unlock()

	gauges = make(map[string]int64, len(b.gauges))
	for name, value := range b.gauges {
		gauges[name] = atomic.LoadInt64(value)
	}

	b.tm.Lock()
	timers := make(map[string]*localBackendTimer)
	for timerName, timer := range b.timers {
		timers[timerName] = timer
	}
	b.tm.Unlock()

	for timerName, timer := range timers {
		timer.Lock()
		hist := timer.hist.Merge()
		timer.Unlock()
		for name, q := range percentiles {
			gauges[timerName+"."+name] = hist.ValueAtQuantile(q)
		}
	}

	b.hm.Lock()
	histograms := make(map[string]*localBackendHistogram)
	for histogramName, histogram := range b.histograms {
		histograms[histogramName] = histogram
	}
	b.hm.Unlock()

	for histogramName, histogram := range histograms {
		histogram.Lock()
		hist := histogram.hist.Merge()
		histogram.Unlock()
		for name, q := range percentiles {
			gauges[histogramName+"."+name] = hist.ValueAtQuantile(q)
		}
	}

	return
}

// Stop cleanly closes the background goroutine spawned by NewBackend.
func (b *Backend) Stop() {
	close(b.stop)
	b.wg.Wait()
}

type stats struct {
	name            string
	tags            map[string]string
	buckets         []float64
	durationBuckets []time.Duration
	localBackend    *Backend
}

type localTimer struct {
	stats
}

func (l *localTimer) Record(d time.Duration) {
	l.localBackend.RecordTimer(l.name, l.tags, d)
}

type localHistogram struct {
	stats
}

func (l *localHistogram) Record(v float64) {
	l.localBackend.RecordHistogram(l.name, l.tags, v)
}

type localCounter struct {
	stats
}

func (l *localCounter) Inc(delta int64) {
	l.localBackend.IncCounter(l.name, l.tags, delta)
}

type localGauge struct {
	stats
}

func (l *localGauge) Update(value int64) {
	l.localBackend.UpdateGauge(l.name, l.tags, value)
}

// Factory stats factory that creates metrics that are stored locally
type Factory struct {
	*Backend
	namespace string
	tags      map[string]string
}

// NewFactory returns a new LocalMetricsFactory
func NewFactory(collectionInterval time.Duration) *Factory {
	return &Factory{
		Backend: NewBackend(collectionInterval),
	}
}

// appendTags adds the tags to the namespace tags and returns a combined map.
func (l *Factory) appendTags(tags map[string]string) map[string]string {
	newTags := make(map[string]string)
	for k, v := range l.tags {
		newTags[k] = v
	}
	for k, v := range tags {
		newTags[k] = v
	}
	return newTags
}

func (l *Factory) newNamespace(name string) string {
	if l.namespace == "" {
		return name
	}

	if name == "" {
		return l.namespace
	}

	return l.namespace + "." + name
}

// Counter returns a local stats counter
func (l *Factory) Counter(options metrics.Options) metrics.Counter {
	return &localCounter{
		stats{
			name:         l.newNamespace(options.Name),
			tags:         l.appendTags(options.Tags),
			localBackend: l.Backend,
		},
	}
}

// Timer returns a local stats timer.
func (l *Factory) Timer(options metrics.TimerOptions) metrics.Timer {
	return &localTimer{
		stats{
			name:            l.newNamespace(options.Name),
			tags:            l.appendTags(options.Tags),
			durationBuckets: options.Buckets,
			localBackend:    l.Backend,
		},
	}
}

// Gauge returns a local stats gauge.
func (l *Factory) Gauge(options metrics.Options) metrics.Gauge {
	return &localGauge{
		stats{
			name:         l.newNamespace(options.Name),
			tags:         l.appendTags(options.Tags),
			localBackend: l.Backend,
		},
	}
}

// Histogram returns a local stats histogram.
func (l *Factory) Histogram(options metrics.HistogramOptions) metrics.Histogram {
	return &localHistogram{
		stats{
			name:         l.newNamespace(options.Name),
			tags:         l.appendTags(options.Tags),
			buckets:      options.Buckets,
			localBackend: l.Backend,
		},
	}
}

// Namespace returns a new namespace.
func (l *Factory) Namespace(scope metrics.NSOptions) metrics.Factory {
	return &Factory{
		namespace: l.newNamespace(scope.Name),
		tags:      l.appendTags(scope.Tags),
		Backend:   l.Backend,
	}
}
