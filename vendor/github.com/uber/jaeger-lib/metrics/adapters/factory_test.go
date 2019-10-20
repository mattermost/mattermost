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
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/metricstest"
)

func TestDefaultOptions(t *testing.T) {
	o := defaultOptions(Options{})
	assert.Equal(t, ".", o.ScopeSep)
	assert.Equal(t, ".", o.TagsSep)
	assert.Equal(t, "_", o.TagKVSep)
}

func TestSubScope(t *testing.T) {
	f := &factory{
		Options: defaultOptions(Options{}),
	}
	assert.Equal(t, "", f.subScope(""))
	assert.Equal(t, "x", f.subScope("x"))
	f.scope = "x"
	assert.Equal(t, "x", f.subScope(""))
	assert.Equal(t, "x.y", f.subScope("y"))
}

func TestFactory(t *testing.T) {
	var (
		counterPrefix   = "counter_"
		gaugePrefix     = "gauge_"
		timerPrefix     = "timer_"
		histogramPrefix = "histogram_"

		tagsA = map[string]string{"a": "b"}
		tagsX = map[string]string{"x": "y"}
	)

	testCases := []struct {
		name            string
		tags            map[string]string
		buckets         []float64
		durationBuckets []time.Duration
		namespace       string
		nsTags          map[string]string
		fullName        string
		expectedCounter string
	}{
		{name: "x", fullName: "%sx"},
		{tags: tagsX, fullName: "%s.x_y"},
		{name: "x", tags: tagsA, fullName: "%sx.a_b"},
		{namespace: "y", fullName: "y.%s"},
		{nsTags: tagsA, fullName: "%s.a_b"},
		{namespace: "y", nsTags: tagsX, fullName: "y.%s.x_y"},
		{name: "x", namespace: "y", nsTags: tagsX, fullName: "y.%sx.x_y"},
		{name: "x", tags: tagsX, namespace: "y", nsTags: tagsX, fullName: "y.%sx.x_y", expectedCounter: "84"},
		{name: "x", tags: tagsA, namespace: "y", nsTags: tagsX, fullName: "y.%sx.a_b.x_y"},
		{name: "x", tags: tagsX, namespace: "y", nsTags: tagsA, fullName: "y.%sx.a_b.x_y", expectedCounter: "84"},
	}
	local := metricstest.NewFactory(100 * time.Second)
	for _, testCase := range testCases {
		t.Run("", func(t *testing.T) {
			if testCase.expectedCounter == "" {
				testCase.expectedCounter = "42"
			}
			ff := &fakeTagless{factory: local}
			f := WrapFactoryWithoutTags(ff, Options{})
			if testCase.namespace != "" || testCase.nsTags != nil {
				f = f.Namespace(metrics.NSOptions{
					Name: testCase.namespace,
					Tags: testCase.nsTags,
				})
			}
			counter := f.Counter(metrics.Options{
				Name: counterPrefix + testCase.name,
				Tags: testCase.tags,
			})
			gauge := f.Gauge(metrics.Options{
				Name: gaugePrefix + testCase.name,
				Tags: testCase.tags,
			})
			timer := f.Timer(metrics.TimerOptions{
				Name:    timerPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.durationBuckets,
			})
			histogram := f.Histogram(metrics.HistogramOptions{
				Name:    histogramPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.buckets,
			})

			assert.Equal(t, counter, f.Counter(metrics.Options{
				Name: counterPrefix + testCase.name,
				Tags: testCase.tags,
			}))
			assert.Equal(t, gauge, f.Gauge(metrics.Options{
				Name: gaugePrefix + testCase.name,
				Tags: testCase.tags,
			}))
			assert.Equal(t, timer, f.Timer(metrics.TimerOptions{
				Name:    timerPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.durationBuckets,
			}))
			assert.Equal(t, histogram, f.Histogram(metrics.HistogramOptions{
				Name:    histogramPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.buckets,
			}))

			assert.Equal(t, fmt.Sprintf(testCase.fullName, counterPrefix), ff.counter)
			assert.Equal(t, fmt.Sprintf(testCase.fullName, gaugePrefix), ff.gauge)
			assert.Equal(t, fmt.Sprintf(testCase.fullName, timerPrefix), ff.timer)
			assert.Equal(t, fmt.Sprintf(testCase.fullName, histogramPrefix), ff.histogram)
		})
	}
}

type fakeTagless struct {
	factory   metrics.Factory
	counter   string
	gauge     string
	timer     string
	histogram string
}

func (f *fakeTagless) Counter(options TaglessOptions) metrics.Counter {
	f.counter = options.Name
	return f.factory.Counter(metrics.Options{
		Name: options.Name,
		Help: options.Help,
	})
}

func (f *fakeTagless) Gauge(options TaglessOptions) metrics.Gauge {
	f.gauge = options.Name
	return f.factory.Gauge(metrics.Options{
		Name: options.Name,
		Help: options.Help,
	})
}

func (f *fakeTagless) Timer(options TaglessTimerOptions) metrics.Timer {
	f.timer = options.Name
	return f.factory.Timer(metrics.TimerOptions{
		Name:    options.Name,
		Help:    options.Help,
		Buckets: options.Buckets,
	})
}

func (f *fakeTagless) Histogram(options TaglessHistogramOptions) metrics.Histogram {
	f.histogram = options.Name
	return f.factory.Histogram(metrics.HistogramOptions{
		Name:    options.Name,
		Help:    options.Help,
		Buckets: options.Buckets,
	})
}
