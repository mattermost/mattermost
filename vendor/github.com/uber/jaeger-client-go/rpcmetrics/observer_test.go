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

package rpcmetrics

import (
	"fmt"
	"testing"
	"time"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/stretchr/testify/assert"
	u "github.com/uber/jaeger-lib/metrics/metricstest"

	"github.com/opentracing/opentracing-go/ext"
	jaeger "github.com/uber/jaeger-client-go"
)

func ExampleObserver() {
	metricsFactory := u.NewFactory(0)
	metricsObserver := NewObserver(
		metricsFactory,
		DefaultNameNormalizer,
	)
	tracer, closer := jaeger.NewTracer(
		"serviceName",
		jaeger.NewConstSampler(true),
		jaeger.NewInMemoryReporter(),
		jaeger.TracerOptions.Observer(metricsObserver),
	)
	defer closer.Close()

	span := tracer.StartSpan("test", ext.SpanKindRPCServer)
	span.Finish()

	c, _ := metricsFactory.Snapshot()
	fmt.Printf("requests (success): %d\n", c["requests|endpoint=test|error=false"])
	fmt.Printf("requests (failure): %d\n", c["requests|endpoint=test|error=true"])
	// Output:
	// requests (success): 1
	// requests (failure): 0
}

type testTracer struct {
	metrics *u.Factory
	tracer  opentracing.Tracer
}

func withTestTracer(runTest func(tt *testTracer)) {
	sampler := jaeger.NewConstSampler(true)
	reporter := jaeger.NewInMemoryReporter()
	metrics := u.NewFactory(time.Minute)
	observer := NewObserver(metrics, DefaultNameNormalizer)
	tracer, closer := jaeger.NewTracer(
		"test",
		sampler,
		reporter,
		jaeger.TracerOptions.Observer(observer))
	defer closer.Close()
	runTest(&testTracer{
		metrics: metrics,
		tracer:  tracer,
	})
}

func TestObserver(t *testing.T) {
	withTestTracer(func(testTracer *testTracer) {
		ts := time.Now()
		finishOptions := opentracing.FinishOptions{
			FinishTime: ts.Add(50 * time.Millisecond),
		}

		testCases := []struct {
			name           string
			tag            opentracing.Tag
			opNameOverride string
			err            bool
		}{
			{name: "local-span", tag: opentracing.Tag{Key: "x", Value: "y"}},
			{name: "get-user", tag: ext.SpanKindRPCServer},
			{name: "get-user", tag: ext.SpanKindRPCServer, opNameOverride: "get-user-override"},
			{name: "get-user", tag: ext.SpanKindRPCServer, err: true},
			{name: "get-user-client", tag: ext.SpanKindRPCClient},
		}

		for _, testCase := range testCases {
			span := testTracer.tracer.StartSpan(
				testCase.name,
				testCase.tag,
				opentracing.StartTime(ts),
			)
			if testCase.opNameOverride != "" {
				span.SetOperationName(testCase.opNameOverride)
			}
			if testCase.err {
				ext.Error.Set(span, true)
			}
			span.FinishWithOptions(finishOptions)
		}

		testTracer.metrics.AssertCounterMetrics(t,
			u.ExpectedMetric{Name: "requests", Tags: endpointTags("local-span", "error", "false"), Value: 0},
			u.ExpectedMetric{Name: "requests", Tags: endpointTags("get-user", "error", "false"), Value: 1},
			u.ExpectedMetric{Name: "requests", Tags: endpointTags("get-user", "error", "true"), Value: 1},
			u.ExpectedMetric{Name: "requests", Tags: endpointTags("get-user-override", "error", "false"), Value: 1},
			u.ExpectedMetric{Name: "requests", Tags: endpointTags("get-user-client", "error", "false"), Value: 0},
		)
		// TODO something wrong with string generation, .P99 should not be appended to the tag
		// as a result we cannot use u.AssertGaugeMetrics
		_, g := testTracer.metrics.Snapshot()
		assert.EqualValues(t, 51, g["request_latency|endpoint=get-user|error=false.P99"])
		assert.EqualValues(t, 51, g["request_latency|endpoint=get-user|error=true.P99"])
	})
}

func TestTags(t *testing.T) {
	type tagTestCase struct {
		key     string
		value   interface{}
		metrics []u.ExpectedMetric
	}

	testCases := []tagTestCase{
		{key: "something", value: 42, metrics: []u.ExpectedMetric{
			{Name: "requests", Value: 1, Tags: tags("error", "false")},
		}},
		{key: "error", value: true, metrics: []u.ExpectedMetric{
			{Name: "requests", Value: 1, Tags: tags("error", "true")},
		}},
		{key: "error", value: "true", metrics: []u.ExpectedMetric{
			{Name: "requests", Value: 1, Tags: tags("error", "true")},
		}},
	}

	for i := 2; i <= 5; i++ {
		values := []interface{}{
			i * 100,
			uint16(i * 100),
			fmt.Sprintf("%d00", i),
		}
		for _, v := range values {
			testCases = append(testCases, tagTestCase{
				key: "http.status_code", value: v, metrics: []u.ExpectedMetric{
					{Name: "http_requests", Value: 1, Tags: tags("status_code", fmt.Sprintf("%dxx", i))},
				},
			})
		}
	}

	for _, tc := range testCases {
		testCase := tc // capture loop var
		for i := range testCase.metrics {
			testCase.metrics[i].Tags["endpoint"] = "span"
		}
		t.Run(fmt.Sprintf("%s-%v", testCase.key, testCase.value), func(t *testing.T) {
			withTestTracer(func(testTracer *testTracer) {
				span := testTracer.tracer.StartSpan("span", ext.SpanKindRPCServer)
				span.SetTag(testCase.key, testCase.value)
				span.Finish()
				testTracer.metrics.AssertCounterMetrics(t, testCase.metrics...)
			})
		})
	}
}
