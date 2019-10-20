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

package jaeger

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uber/jaeger-client-go/internal/throttler"
)

func TestBaggageIterator(t *testing.T) {
	service := "DOOP"
	tracer, closer := NewTracer(service, NewConstSampler(true), NewNullReporter())
	defer closer.Close()

	sp1 := tracer.StartSpan("s1").(*Span)
	sp1.SetBaggageItem("Some_Key", "12345")
	sp1.SetBaggageItem("Some-other-key", "42")
	expectedBaggage := map[string]string{"Some_Key": "12345", "Some-other-key": "42"}
	assertBaggage(t, sp1, expectedBaggage)
	assertBaggageRecords(t, sp1, expectedBaggage)

	b := extractBaggage(sp1, false) // break out early
	assert.Equal(t, 1, len(b), "only one baggage item should be extracted")

	sp2 := tracer.StartSpan("s2", opentracing.ChildOf(sp1.Context())).(*Span)
	assertBaggage(t, sp2, expectedBaggage) // child inherits the same baggage
	require.Len(t, sp2.logs, 0)            // child doesn't inherit the baggage logs
}

func assertBaggageRecords(t *testing.T, sp *Span, expected map[string]string) {
	require.Len(t, sp.logs, len(expected))
	for _, logRecord := range sp.logs {
		require.Len(t, logRecord.Fields, 3)
		require.Equal(t, "event:baggage", logRecord.Fields[0].String())
		key := logRecord.Fields[1].Value().(string)
		value := logRecord.Fields[2].Value().(string)

		require.Contains(t, expected, key)
		assert.Equal(t, expected[key], value)
	}
}

func assertBaggage(t *testing.T, sp opentracing.Span, expected map[string]string) {
	b := extractBaggage(sp, true)
	assert.Equal(t, expected, b)
}

func extractBaggage(sp opentracing.Span, allItems bool) map[string]string {
	b := make(map[string]string)
	sp.Context().ForeachBaggageItem(func(k, v string) bool {
		b[k] = v
		return allItems
	})
	return b
}

func TestSpanProperties(t *testing.T) {
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), NewNullReporter())
	defer closer.Close()

	sp1 := tracer.StartSpan("s1").(*Span)
	sp1.SetTag("foo", "bar")
	var expectedTags = make(opentracing.Tags)
	expectedTags["foo"] = "bar"
	expectedTags["sampler.type"] = "const"
	expectedTags["sampler.param"] = true

	assert.Equal(t, tracer, sp1.Tracer())
	assert.NotNil(t, sp1.Context())
	assert.Equal(t, sp1.context, sp1.SpanContext())
	assert.Equal(t, sp1.startTime, sp1.StartTime())
	assert.Equal(t, sp1.duration, sp1.Duration())
	assert.Equal(t, sp1.Tags(), expectedTags)
}

func TestSpanOperationName(t *testing.T) {
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), NewNullReporter())
	defer closer.Close()

	sp1 := tracer.StartSpan("s1").(*Span)
	sp1.SetOperationName("s2")
	sp1.Finish()

	assert.Equal(t, "s2", sp1.OperationName())
}

func TestSetTag_SamplingPriority(t *testing.T) {
	type testCase struct {
		noDebugFlagOnForcedSampling bool
		throttler                   throttler.Throttler
		samplingPriority            uint16
		expDebugSpan                bool
		expSamplingTag              bool
	}

	testSuite := map[string]testCase{
		"Sampling priority 0 with debug flag and default throttler": {
			noDebugFlagOnForcedSampling: false,
			throttler:                   throttler.DefaultThrottler{},
			samplingPriority:            0,
			expDebugSpan:                false,
			expSamplingTag:              false,
		},
		"Sampling priority 1 with debug flag and default throttler": {
			noDebugFlagOnForcedSampling: false,
			throttler:                   throttler.DefaultThrottler{},
			samplingPriority:            1,
			expDebugSpan:                true,
			expSamplingTag:              true,
		},
		"Sampling priority 1 with debug flag and test throttler": {
			noDebugFlagOnForcedSampling: false,
			throttler:                   testThrottler{allowAll: false},
			samplingPriority:            1,
			expDebugSpan:                false,
			expSamplingTag:              false,
		},
		"Sampling priority 0 without debug flag and default throttler": {
			noDebugFlagOnForcedSampling: true,
			throttler:                   throttler.DefaultThrottler{},
			samplingPriority:            0,
			expDebugSpan:                false,
			expSamplingTag:              false,
		},
		"Sampling priority 1 without debug flag and default throttler": {
			noDebugFlagOnForcedSampling: true,
			throttler:                   throttler.DefaultThrottler{},
			samplingPriority:            1,
			expDebugSpan:                false,
			expSamplingTag:              true,
		},
		"Sampling priority 1 without debug flag and test throttler": {
			noDebugFlagOnForcedSampling: true,
			throttler:                   testThrottler{allowAll: false},
			samplingPriority:            1,
			expDebugSpan:                false,
			expSamplingTag:              true,
		},
	}

	for name, testCase := range testSuite {
		t.Run(name, func(t *testing.T) {
			tracer, closer := NewTracer(
				"DOOP",
				NewConstSampler(true),
				NewNullReporter(),
				TracerOptions.DebugThrottler(testCase.throttler),
				TracerOptions.NoDebugFlagOnForcedSampling(testCase.noDebugFlagOnForcedSampling),
			)

			sp1 := tracer.StartSpan("s1").(*Span)
			ext.SamplingPriority.Set(sp1, testCase.samplingPriority)
			assert.Equal(t, testCase.expDebugSpan, sp1.context.IsDebug())
			if testCase.expSamplingTag {
				assert.NotNil(t, findDomainTag(sp1, "sampling.priority"), "sampling.priority tag should be added")
			}
			closer.Close()
		})
	}
}

func TestSetFirehoseMode(t *testing.T) {
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), NewNullReporter())
	defer closer.Close()

	sp1 := tracer.StartSpan("s1").(*Span)
	assert.False(t, sp1.context.IsFirehose())

	EnableFirehose(sp1)

	assert.True(t, sp1.context.IsFirehose())
}

type testThrottler struct {
	allowAll bool
}

func (t testThrottler) IsAllowed(operation string) bool {
	return t.allowAll
}

func TestBaggageContextRace(t *testing.T) {
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), NewNullReporter())
	defer closer.Close()

	sp1 := tracer.StartSpan("s1").(*Span)

	var startWg, endWg sync.WaitGroup
	startWg.Add(1)
	endWg.Add(2)

	f := func() {
		startWg.Wait()
		sp1.SetBaggageItem("x", "y")
		sp1.Context().ForeachBaggageItem(func(k, v string) bool { return false })
		endWg.Done()
	}

	go f()
	go f()

	startWg.Done()
	endWg.Wait()
}

func TestSpanLifecycle(t *testing.T) {
	service := "DOOP"
	tracer, closer := NewTracer(service, NewConstSampler(true), NewNullReporter(), TracerOptions.PoolSpans(true))
	// After closing all contexts will be released
	defer closer.Close()

	sp1 := tracer.StartSpan("s1").(*Span)
	sp1.LogEvent("foo")
	assert.True(t, sp1.tracer != nil, "invalid span initalisation")

	sp1.Retain() // After this we are responsible for the span releasing
	assert.Equal(t, int32(1), atomic.LoadInt32(&sp1.referenceCounter))

	sp1.Finish() // The span is still alive
	assert.True(t, sp1.tracer != nil, "invalid span finishing")

	sp1.Release() // Now we will kill the object and return it in the pool
	assert.True(t, sp1.tracer == nil, "span must be released")
}
