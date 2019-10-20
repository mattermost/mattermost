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
	"expvar"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/uber/jaeger-lib/metrics"
)

var (
	id              = time.Now().UnixNano()
	prefix          = fmt.Sprintf("test_%d", id)
	counterPrefix   = prefix + "_counter_"
	gaugePrefix     = prefix + "_gauge_"
	timerPrefix     = prefix + "_timer_"
	histogramPrefix = prefix + "_histogram_"

	tagsA = map[string]string{"a": "b"}
	tagsX = map[string]string{"x": "y"}
)

func TestFactory(t *testing.T) {
	buckets := []float64{10, 20, 30, 40, 50, 60}
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
		{name: "x", fullName: "%sx", buckets: buckets},
		{tags: tagsX, fullName: "%s.x_y", buckets: buckets},
		{name: "x", tags: tagsA, fullName: "%sx.a_b", buckets: buckets},
		{namespace: "y", fullName: "y.%s", buckets: buckets},
		{nsTags: tagsA, fullName: "%s.a_b", buckets: buckets},
		{namespace: "y", nsTags: tagsX, fullName: "y.%s.x_y", buckets: buckets},
		{name: "x", namespace: "y", nsTags: tagsX, fullName: "y.%sx.x_y", buckets: buckets},
		{name: "x", tags: tagsX, namespace: "y", nsTags: tagsX, fullName: "y.%sx.x_y", expectedCounter: "84", buckets: buckets},
		{name: "x", tags: tagsA, namespace: "y", nsTags: tagsX, fullName: "y.%sx.a_b.x_y", buckets: buckets},
		{name: "x", tags: tagsX, namespace: "y", nsTags: tagsA, fullName: "y.%sx.a_b.x_y", expectedCounter: "84", buckets: buckets},
	}
	f := NewFactory(2)
	for _, testCase := range testCases {
		t.Run("", func(t *testing.T) {
			if testCase.expectedCounter == "" {
				testCase.expectedCounter = "42"
			}
			ff := f
			if testCase.namespace != "" || testCase.nsTags != nil {
				ff = f.Namespace(metrics.NSOptions{
					Name: testCase.namespace,
					Tags: testCase.nsTags,
				})
			}
			counter := ff.Counter(metrics.Options{
				Name: counterPrefix + testCase.name,
				Tags: testCase.tags,
			})
			gauge := ff.Gauge(metrics.Options{
				Name: gaugePrefix + testCase.name,
				Tags: testCase.tags,
			})
			timer := ff.Timer(metrics.TimerOptions{
				Name:    timerPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.durationBuckets,
			})
			histogram := ff.Histogram(metrics.HistogramOptions{
				Name:    histogramPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.buckets,
			})

			// register second time, should not panic
			ff.Counter(metrics.Options{
				Name: counterPrefix + testCase.name,
				Tags: testCase.tags,
			})
			ff.Gauge(metrics.Options{
				Name: gaugePrefix + testCase.name,
				Tags: testCase.tags,
			})
			ff.Timer(metrics.TimerOptions{
				Name:    timerPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.durationBuckets,
			})
			ff.Histogram(metrics.HistogramOptions{
				Name:    histogramPrefix + testCase.name,
				Tags:    testCase.tags,
				Buckets: testCase.buckets,
			})

			counter.Inc(42)
			gauge.Update(42)
			timer.Record(42 * time.Millisecond)
			histogram.Record(42)

			assertExpvar(t, fmt.Sprintf(testCase.fullName, counterPrefix), testCase.expectedCounter)
			assertExpvar(t, fmt.Sprintf(testCase.fullName, gaugePrefix), "42")
			assertExpvar(t, fmt.Sprintf(testCase.fullName, timerPrefix)+".p99", "0.042")
			assertExpvar(t, fmt.Sprintf(testCase.fullName, histogramPrefix)+".p99", "42")
		})
	}
}

func assertExpvar(t *testing.T, fullName string, value string) {
	var found expvar.KeyValue
	expvar.Do(func(kv expvar.KeyValue) {
		if kv.Key == fullName {
			found = kv
		}
	})
	if !assert.Equal(t, fullName, found.Key) {
		expvar.Do(func(kv expvar.KeyValue) {
			if strings.HasPrefix(kv.Key, prefix) {
				// t.Log(kv)
			}
		})
		return
	}
	assert.Equal(t, value, found.Value.String(), fullName)
}
