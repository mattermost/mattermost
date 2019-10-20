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
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/opentracing/opentracing-go/harness"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"github.com/uber/jaeger-lib/metrics/metricstest"

	"github.com/uber/jaeger-client-go/internal/baggage"
	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/utils"
)

type tracerSuite struct {
	suite.Suite
	tracer         opentracing.Tracer
	closer         io.Closer
	metricsFactory *metricstest.Factory
}

func (s *tracerSuite) SetupTest() {
	s.metricsFactory = metricstest.NewFactory(0)
	metrics := NewMetrics(s.metricsFactory, nil)

	s.tracer, s.closer = NewTracer("DOOP", // respect the classics, man!
		NewConstSampler(true),
		NewNullReporter(),
		TracerOptions.Metrics(metrics),
		TracerOptions.ZipkinSharedRPCSpan(true),
		TracerOptions.BaggageRestrictionManager(baggage.NewDefaultRestrictionManager(0)),
		TracerOptions.PoolSpans(false),
	)
	s.NotNil(s.tracer)
}

func (s *tracerSuite) TearDownTest() {
	if s.tracer != nil {
		s.closer.Close()
		s.tracer = nil
	}
}

func TestTracerSuite(t *testing.T) {
	suite.Run(t, new(tracerSuite))
}

func (s *tracerSuite) TestBeginRootSpan() {
	s.metricsFactory.Clear()
	startTime := time.Now()
	s.tracer.(*Tracer).timeNow = func() time.Time { return startTime }
	someID := uint64(12345)
	s.tracer.(*Tracer).randomNumber = func() uint64 { return someID }

	sp := s.tracer.StartSpan("get_name")
	ext.SpanKindRPCServer.Set(sp)
	ext.PeerService.Set(sp, "peer-service")
	s.NotNil(sp)
	ss := sp.(*Span)
	s.NotNil(ss.tracer, "Tracer must be referenced from span")
	s.Equal("get_name", ss.operationName)
	s.Len(ss.tags, 4, "Span should have 2 sampler tags, span.kind tag and peer.service tag")
	s.EqualValues(Tag{key: "span.kind", value: ext.SpanKindRPCServerEnum}, ss.tags[2], "Span must be server-side")
	s.EqualValues(Tag{key: "peer.service", value: "peer-service"}, ss.tags[3], "Client is 'peer-service'")

	s.EqualValues(someID, ss.context.traceID.Low)
	s.EqualValues(0, ss.context.parentID)

	s.Equal(startTime, ss.startTime)

	sp.Finish()
	s.NotNil(ss.duration)

	s.metricsFactory.AssertCounterMetrics(s.T(), []metricstest.ExpectedMetric{
		{Name: "jaeger.tracer.finished_spans", Value: 1},
		{Name: "jaeger.tracer.started_spans", Tags: map[string]string{"sampled": "y"}, Value: 1},
		{Name: "jaeger.tracer.traces", Tags: map[string]string{"sampled": "y", "state": "started"}, Value: 1},
	}...)
}

func (s *tracerSuite) TestStartRootSpanWithOptions() {
	ts := time.Now()
	sp := s.tracer.StartSpan("get_address", opentracing.StartTime(ts))
	ss := sp.(*Span)
	s.Equal("get_address", ss.operationName)
	s.Equal(ts, ss.startTime)
}

func (s *tracerSuite) TestStartChildSpan() {
	s.metricsFactory.Clear()
	sp1 := s.tracer.StartSpan("get_address")
	sp2 := s.tracer.StartSpan("get_street", opentracing.ChildOf(sp1.Context()))
	s.Equal(sp1.(*Span).context.spanID, sp2.(*Span).context.parentID)
	sp2.Finish()
	s.NotNil(sp2.(*Span).duration)
	sp1.Finish()
	s.metricsFactory.AssertCounterMetrics(s.T(), []metricstest.ExpectedMetric{
		{Name: "jaeger.tracer.started_spans", Tags: map[string]string{"sampled": "y"}, Value: 2},
		{Name: "jaeger.tracer.traces", Tags: map[string]string{"sampled": "y", "state": "started"}, Value: 1},
		{Name: "jaeger.tracer.finished_spans", Value: 2},
	}...)
}

type nonJaegerSpanContext struct{}

func (c nonJaegerSpanContext) ForeachBaggageItem(handler func(k, v string) bool) {}

func (s *tracerSuite) TestStartSpanWithMultipleReferences() {
	s.metricsFactory.Clear()
	sp1 := s.tracer.StartSpan("A")
	sp2 := s.tracer.StartSpan("B")
	sp3 := s.tracer.StartSpan("C")
	sp4 := s.tracer.StartSpan(
		"D",
		opentracing.ChildOf(sp1.Context()),
		opentracing.ChildOf(sp2.Context()),
		opentracing.FollowsFrom(sp3.Context()),
		opentracing.FollowsFrom(nonJaegerSpanContext{}),
		opentracing.FollowsFrom(SpanContext{}), // Empty span context should be excluded
	)
	// Should use the first ChildOf ref span as the parent
	s.Equal(sp1.(*Span).context.spanID, sp4.(*Span).context.parentID)
	sp4.Finish()
	s.NotNil(sp4.(*Span).duration)
	sp3.Finish()
	sp2.Finish()
	sp1.Finish()
	s.metricsFactory.AssertCounterMetrics(s.T(), []metricstest.ExpectedMetric{
		{Name: "jaeger.tracer.started_spans", Tags: map[string]string{"sampled": "y"}, Value: 4},
		{Name: "jaeger.tracer.traces", Tags: map[string]string{"sampled": "y", "state": "started"}, Value: 3},
		{Name: "jaeger.tracer.finished_spans", Value: 4},
	}...)
	assert.Len(s.T(), sp4.(*Span).references, 3)
}

func (s *tracerSuite) TestStartSpanWithOnlyFollowFromReference() {
	s.metricsFactory.Clear()
	sp1 := s.tracer.StartSpan("A")
	sp2 := s.tracer.StartSpan(
		"B",
		opentracing.FollowsFrom(sp1.Context()),
	)
	// Should use the first ChildOf ref span as the parent
	s.Equal(sp1.(*Span).context.spanID, sp2.(*Span).context.parentID)
	sp2.Finish()
	s.NotNil(sp2.(*Span).duration)
	sp1.Finish()
	s.metricsFactory.AssertCounterMetrics(s.T(), []metricstest.ExpectedMetric{
		{Name: "jaeger.tracer.started_spans", Tags: map[string]string{"sampled": "y"}, Value: 2},
		{Name: "jaeger.tracer.traces", Tags: map[string]string{"sampled": "y", "state": "started"}, Value: 1},
		{Name: "jaeger.tracer.finished_spans", Value: 2},
	}...)
	assert.Len(s.T(), sp2.(*Span).references, 1)
}

func (s *tracerSuite) TestTraceStartedOrJoinedMetrics() {
	tests := []struct {
		sampled bool
		label   string
	}{
		{true, "y"},
		{false, "n"},
	}
	for _, test := range tests {
		s.metricsFactory.Clear()
		s.tracer.(*Tracer).sampler = NewConstSampler(test.sampled)
		sp1 := s.tracer.StartSpan("parent", ext.RPCServerOption(nil))
		sp2 := s.tracer.StartSpan("child1", opentracing.ChildOf(sp1.Context()))
		sp3 := s.tracer.StartSpan("child2", ext.RPCServerOption(sp2.Context()))
		s.Equal(sp2.(*Span).context.spanID, sp3.(*Span).context.spanID)
		s.Equal(sp2.(*Span).context.parentID, sp3.(*Span).context.parentID)
		sp3.Finish()
		sp2.Finish()
		sp1.Finish()
		s.Equal(test.sampled, sp1.Context().(SpanContext).IsSampled())
		s.Equal(test.sampled, sp2.Context().(SpanContext).IsSampled())

		s.metricsFactory.AssertCounterMetrics(s.T(), []metricstest.ExpectedMetric{
			{Name: "jaeger.tracer.started_spans", Tags: map[string]string{"sampled": test.label}, Value: 3},
			{Name: "jaeger.tracer.finished_spans", Value: 3},
			{Name: "jaeger.tracer.traces", Tags: map[string]string{"sampled": test.label, "state": "started"}, Value: 1},
			{Name: "jaeger.tracer.traces", Tags: map[string]string{"sampled": test.label, "state": "joined"}, Value: 1},
		}...)
	}
}

func (s *tracerSuite) TestSetOperationName() {
	sp1 := s.tracer.StartSpan("get_address")
	sp1.SetOperationName("get_street")
	s.Equal("get_street", sp1.(*Span).operationName)
}

func (s *tracerSuite) TestSamplerEffects() {
	s.tracer.(*Tracer).sampler = NewConstSampler(true)
	sp := s.tracer.StartSpan("test")
	flags := sp.(*Span).context.flags
	s.EqualValues(flagSampled, flags&flagSampled)

	s.tracer.(*Tracer).sampler = NewConstSampler(false)
	sp = s.tracer.StartSpan("test")
	flags = sp.(*Span).context.flags
	s.EqualValues(0, flags&flagSampled)
}

func (s *tracerSuite) TestRandomIDNotZero() {
	val := uint64(0)
	s.tracer.(*Tracer).randomNumber = func() (r uint64) {
		r = val
		val++
		return
	}
	sp := s.tracer.StartSpan("get_name").(*Span)
	s.EqualValues(TraceID{Low: 1}, sp.context.traceID)

	rng := utils.NewRand(0)
	rng.Seed(1) // for test coverage
}

func (s *tracerSuite) TestReferenceSelfUsesProvidedContext() {
	ctx := NewSpanContext(
		TraceID{
			High: 1,
			Low:  2,
		},
		SpanID(2),
		SpanID(1),
		false,
		nil,
	)
	sp1 := s.tracer.StartSpan(
		"continued_span",
		SelfRef(ctx),
	)
	s.Equal(ctx, sp1.(*Span).context)
}

func TestTracerOptions(t *testing.T) {
	t1, e := time.Parse(time.RFC3339, "2012-11-01T22:08:41+00:00")
	assert.NoError(t, e)

	timeNow := func() time.Time {
		return t1
	}
	rnd := func() uint64 {
		return 1
	}
	isPoolAllocator := func(allocator SpanAllocator) bool {
		_, ok := allocator.(*syncPollSpanAllocator)
		return ok
	}

	openTracer, closer := NewTracer("DOOP", // respect the classics, man!
		NewConstSampler(true),
		NewNullReporter(),
		TracerOptions.Logger(log.StdLogger),
		TracerOptions.TimeNow(timeNow),
		TracerOptions.RandomNumber(rnd),
		TracerOptions.PoolSpans(true),
		TracerOptions.Tag("tag_key", "tag_value"),
		TracerOptions.NoDebugFlagOnForcedSampling(true),
	)
	defer closer.Close()

	tracer := openTracer.(*Tracer)
	assert.Equal(t, log.StdLogger, tracer.logger)
	assert.Equal(t, t1, tracer.timeNow())
	assert.Equal(t, uint64(1), tracer.randomNumber())
	assert.Equal(t, uint64(1), tracer.randomNumber())
	assert.Equal(t, uint64(1), tracer.randomNumber()) // always 1
	assert.Equal(t, true, isPoolAllocator(tracer.spanAllocator))
	assert.Equal(t, opentracing.Tag{Key: "tag_key", Value: "tag_value"}, tracer.Tags()[0])
	assert.True(t, tracer.options.noDebugFlagOnForcedSampling)
}

func TestInjectorExtractorOptions(t *testing.T) {
	tracer, tc := NewTracer("x", NewConstSampler(true), NewNullReporter(),
		TracerOptions.Injector("dummy", &dummyPropagator{}),
		TracerOptions.Extractor("dummy", &dummyPropagator{}),
	)
	defer tc.Close()

	sp := tracer.StartSpan("x")
	c := &dummyCarrier{}
	err := tracer.Inject(sp.Context(), "dummy", []int{})
	assert.Equal(t, opentracing.ErrInvalidCarrier, err)
	err = tracer.Inject(sp.Context(), "dummy", c)
	assert.NoError(t, err)
	assert.True(t, c.ok)

	c.ok = false
	_, err = tracer.Extract("dummy", []int{})
	assert.Equal(t, opentracing.ErrInvalidCarrier, err)
	_, err = tracer.Extract("dummy", c)
	assert.Equal(t, opentracing.ErrSpanContextNotFound, err)
	c.ok = true
	_, err = tracer.Extract("dummy", c)
	assert.NoError(t, err)
}

func TestEmptySpanContextAsParent(t *testing.T) {
	tracer, tc := NewTracer("x", NewConstSampler(true), NewNullReporter())
	defer tc.Close()

	span := tracer.StartSpan("test", opentracing.ChildOf(emptyContext))
	ctx := span.Context().(SpanContext)
	assert.True(t, ctx.traceID.IsValid())
	assert.True(t, ctx.IsValid())
}

func TestGen128Bit(t *testing.T) {
	tracer, tc := NewTracer("x", NewConstSampler(true), NewNullReporter(), TracerOptions.Gen128Bit(true))
	defer tc.Close()

	span := tracer.StartSpan("test", opentracing.ChildOf(emptyContext))
	defer span.Finish()
	traceID := span.Context().(SpanContext).TraceID()
	assert.True(t, traceID.High != 0)
	assert.True(t, traceID.Low != 0)
}

func TestZipkinSharedRPCSpan(t *testing.T) {
	tracer, tc := NewTracer("x", NewConstSampler(true), NewNullReporter(), TracerOptions.ZipkinSharedRPCSpan(false))

	sp1 := tracer.StartSpan("client", ext.SpanKindRPCClient)
	sp2 := tracer.StartSpan("server", opentracing.ChildOf(sp1.Context()), ext.SpanKindRPCServer)
	assert.Equal(t, sp1.(*Span).context.spanID, sp2.(*Span).context.parentID)
	assert.NotEqual(t, sp1.(*Span).context.spanID, sp2.(*Span).context.spanID)
	sp2.Finish()
	sp1.Finish()
	tc.Close()

	tracer, tc = NewTracer("x", NewConstSampler(true), NewNullReporter(), TracerOptions.ZipkinSharedRPCSpan(true))

	sp1 = tracer.StartSpan("client", ext.SpanKindRPCClient)
	sp2 = tracer.StartSpan("server", opentracing.ChildOf(sp1.Context()), ext.SpanKindRPCServer)
	assert.Equal(t, sp1.(*Span).context.spanID, sp2.(*Span).context.spanID)
	assert.Equal(t, sp1.(*Span).context.parentID, sp2.(*Span).context.parentID)
	sp2.Finish()
	sp1.Finish()
	tc.Close()
}

type testDebugThrottler struct {
	process Process
}

func (t *testDebugThrottler) SetProcess(process Process) {
	t.process = process
}

func (t *testDebugThrottler) Close() error {
	return nil
}

func (t *testDebugThrottler) IsAllowed(operation string) bool {
	return true
}

func TestDebugThrottler(t *testing.T) {
	throttler := &testDebugThrottler{}
	opentracingTracer, tc := NewTracer("x", NewConstSampler(true), NewNullReporter(), TracerOptions.DebugThrottler(throttler))
	assert.NoError(t, tc.Close())
	tracer := opentracingTracer.(*Tracer)
	assert.Equal(t, tracer.process, throttler.process)
}

func TestThrottling_SamplingPriority(t *testing.T) {
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), NewNullReporter())

	sp1 := tracer.StartSpan("s1", opentracing.Tags{string(ext.SamplingPriority): 0}).(*Span)
	assert.False(t, sp1.context.IsDebug())

	sp1 = tracer.StartSpan("s1", opentracing.Tags{string(ext.SamplingPriority): uint16(1)}).(*Span)
	assert.True(t, sp1.context.IsDebug())

	assert.NotNil(t, findDomainTag(sp1, "sampling.priority"), "sampling.priority tag should be added")
	closer.Close()

	tracer, closer = NewTracer("DOOP", NewConstSampler(true), NewNullReporter(),
		TracerOptions.DebugThrottler(testThrottler{allowAll: false}))
	defer closer.Close()

	sp1 = tracer.StartSpan("s1", opentracing.Tags{string(ext.SamplingPriority): uint16(1)}).(*Span)
	ext.SamplingPriority.Set(sp1, 1)
	assert.False(t, sp1.context.IsDebug(), "debug should not be allowed by the throttler")
}

func TestThrottling_DebugHeader(t *testing.T) {
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), NewNullReporter())

	h := http.Header{}
	h.Add(JaegerDebugHeader, "x")
	ctx, err := tracer.Extract(opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(h))
	require.NoError(t, err)

	sp := tracer.StartSpan("root", opentracing.ChildOf(ctx)).(*Span)
	assert.True(t, sp.context.IsDebug())
	closer.Close()

	tracer, closer = NewTracer("DOOP", NewConstSampler(true), NewNullReporter(),
		TracerOptions.DebugThrottler(testThrottler{allowAll: false}))
	defer closer.Close()

	sp = tracer.StartSpan("root", opentracing.ChildOf(ctx)).(*Span)
	assert.False(t, sp.context.IsDebug(), "debug should not be allowed by the throttler")
}

func TestSetGetTag(t *testing.T) {
	opentracer, tc := NewTracer("x", NewConstSampler(true), NewNullReporter())
	tracer := opentracer.(*Tracer)
	defer tc.Close()
	value, ok := tracer.getTag(TracerIPTagKey)
	assert.True(t, ok)
	_, ok = value.(string)
	assert.True(t, ok)
	assert.True(t, tracer.hostIPv4 != 0)

	ipStr := "11.22.33.44"
	opentracer, tc = NewTracer("x", NewConstSampler(true), NewNullReporter(), TracerOptions.Tag(TracerIPTagKey, ipStr))
	tracer = opentracer.(*Tracer)
	defer tc.Close()
	value, ok = tracer.getTag(TracerIPTagKey)
	assert.True(t, ok)
	assert.True(t, value == ipStr)
	assert.True(t, tracer.hostIPv4 != 0)

	ipStrInvalid := "an invalid input"
	opentracer, tc = NewTracer("x", NewConstSampler(true), NewNullReporter(), TracerOptions.Tag(TracerIPTagKey, ipStrInvalid))
	tracer = opentracer.(*Tracer)
	defer tc.Close()
	value, ok = tracer.getTag(TracerIPTagKey)
	assert.True(t, ok)
	assert.True(t, value == ipStrInvalid)
	assert.True(t, tracer.hostIPv4 == 0)
}

type dummyPropagator struct{}
type dummyCarrier struct {
	ok bool
}

func (p *dummyPropagator) Inject(ctx SpanContext, carrier interface{}) error {
	c, ok := carrier.(*dummyCarrier)
	if !ok {
		return opentracing.ErrInvalidCarrier
	}
	c.ok = true
	return nil
}

func (p *dummyPropagator) Extract(carrier interface{}) (SpanContext, error) {
	c, ok := carrier.(*dummyCarrier)
	if !ok {
		return emptyContext, opentracing.ErrInvalidCarrier
	}
	if c.ok {
		return emptyContext, nil
	}
	return emptyContext, opentracing.ErrSpanContextNotFound
}

func TestAPI(t *testing.T) {
	harness.RunAPIChecks(
		t,
		func() (opentracing.Tracer, func()) {
			tracer, closer := NewTracer("DOOP", // respect the classics, man!
				NewConstSampler(true),
				NewNullReporter(),
			)

			return tracer, func() { closer.Close() }
		},
		harness.CheckEverything(),
		harness.UseProbe(&jaegerProbe{}),
	)
}

type jaegerProbe struct{}

// SameTrace helps tests assert that this tracer's spans are from the same trace.
func (jp *jaegerProbe) SameTrace(first, second opentracing.Span) bool {
	firstCtx := first.Context().(SpanContext)
	secondCtx := second.Context().(SpanContext)
	return firstCtx.traceID == secondCtx.traceID
}

// SameSpanContext helps tests assert that a span and a context are from the same trace and span.
func (jp *jaegerProbe) SameSpanContext(first opentracing.Span, second opentracing.SpanContext) bool {
	firstCtx := first.Context().(SpanContext)
	secondCtx := second.(SpanContext)
	return firstCtx.traceID == secondCtx.traceID && firstCtx.spanID == secondCtx.spanID
}
