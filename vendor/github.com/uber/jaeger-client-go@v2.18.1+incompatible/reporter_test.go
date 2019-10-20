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
	"errors"
	"io"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/metricstest"

	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/testutils"
	j "github.com/uber/jaeger-client-go/thrift-gen/jaeger"
)

type reporterSuite struct {
	tracer         opentracing.Tracer
	closer         io.Closer
	serviceName    string
	reporter       *remoteReporter
	sender         *fakeSender
	metricsFactory *metricstest.Factory
	logger         *log.BytesBufferLogger
}

func makeReporterSuite(t *testing.T, opts ...ReporterOption) *reporterSuite {
	return makeReporterSuiteWithSender(t, &fakeSender{bufferSize: 5}, opts...)
}

func makeReporterSuiteWithSender(t *testing.T, sender *fakeSender, opts ...ReporterOption) *reporterSuite {
	s := &reporterSuite{
		metricsFactory: metricstest.NewFactory(0),
		serviceName:    "DOOP",
		sender:         sender,
		logger:         &log.BytesBufferLogger{},
	}
	metrics := NewMetrics(s.metricsFactory, nil)
	opts = append([]ReporterOption{
		ReporterOptions.Metrics(metrics),
		ReporterOptions.Logger(s.logger),
		ReporterOptions.BufferFlushInterval(100 * time.Second),
	}, opts...)
	s.reporter = NewRemoteReporter(s.sender, opts...).(*remoteReporter)
	s.tracer, s.closer = NewTracer(
		"reporter-test-service",
		NewConstSampler(true),
		s.reporter,
		// TracerOptions.Metrics(metrics),
	)
	require.NotNil(t, s.tracer)
	return s
}

func (s *reporterSuite) close() {
	s.closer.Close()
}

func (s *reporterSuite) assertCounter(t *testing.T, name string, tags map[string]string, expectedValue int64) {
	getValue := func() int64 {
		counters, _ := s.metricsFactory.Snapshot()
		key := metrics.GetKey(name, tags, "|", "=")
		return counters[key]
	}
	for i := 0; i < 1000; i++ {
		if getValue() == expectedValue {
			break
		}
		time.Sleep(time.Millisecond)
	}
	assert.Equal(t, expectedValue, getValue(), "expected counter: name=%s, tags=%+v", name, tags)
}

func (s *reporterSuite) assertLogs(t *testing.T, expectedLogs string) {
	for i := 0; i < 1000; i++ {
		if s.logger.String() == expectedLogs {
			break
		}
		time.Sleep(time.Millisecond)
	}
	assert.Equal(t, expectedLogs, s.logger.String(), "expected logs: %s", expectedLogs)
}

func TestRemoteReporterAppend(t *testing.T) {
	s := makeReporterSuite(t)
	defer s.close()
	s.tracer.StartSpan("sp1").Finish()
	s.sender.assertBufferedSpans(t, 1)
}

func TestRemoteReporterAppendAndPeriodicFlush(t *testing.T) {
	s := makeReporterSuite(t, ReporterOptions.BufferFlushInterval(50*time.Millisecond))
	defer s.close()
	s.tracer.StartSpan("sp1").Finish()
	s.sender.assertBufferedSpans(t, 1)
	// here we wait for periodic flush to occur
	s.sender.assertFlushedSpans(t, 1)
	s.assertCounter(t, "jaeger.tracer.reporter_spans", map[string]string{"result": "ok"}, 1)
}

func TestRemoteReporterFlushViaAppend(t *testing.T) {
	s := makeReporterSuiteWithSender(t, &fakeSender{bufferSize: 2})
	defer s.close()
	s.tracer.StartSpan("sp1").Finish()
	s.tracer.StartSpan("sp2").Finish()
	s.sender.assertFlushedSpans(t, 2)
	s.tracer.StartSpan("sp3").Finish()
	s.sender.assertBufferedSpans(t, 1)
	s.assertCounter(t, "jaeger.tracer.reporter_spans", map[string]string{"result": "ok"}, 2)
	s.assertCounter(t, "jaeger.tracer.reporter_spans", map[string]string{"result": "err"}, 0)
}

func TestRemoteReporterFailedFlushViaAppend(t *testing.T) {
	s := makeReporterSuiteWithSender(t, &fakeSender{bufferSize: 2, flushErr: errors.New("flush error")}, ReporterOptions.BufferFlushInterval(100*time.Second))
	s.tracer.StartSpan("sp1").Finish()
	s.tracer.StartSpan("sp2").Finish()
	s.sender.assertFlushedSpans(t, 2)
	s.assertLogs(t, "ERROR: error reporting span \"sp2\": flush error\n")
	s.assertCounter(t, "jaeger.tracer.reporter_spans", map[string]string{"result": "err"}, 2)
	s.assertCounter(t, "jaeger.tracer.reporter_spans", map[string]string{"result": "ok"}, 0)
	s.close() // causes explicit flush that also fails with the same error
	s.assertLogs(t, "ERROR: error reporting span \"sp2\": flush error\nERROR: error when flushing the buffer: flush error\n")
}

func TestRemoteReporterAppendWithPoolAllocator(t *testing.T) {
	s := makeReporterSuiteWithSender(t, &fakeSender{bufferSize: 100}, ReporterOptions.BufferFlushInterval(time.Millisecond*10))
	TracerOptions.PoolSpans(true)(s.tracer.(*Tracer))
	for i := 0; i < 100; i++ {
		s.tracer.StartSpan("sp").Finish()
	}
	time.Sleep(time.Second)
	s.sender.assertFlushedSpans(t, 100)
	s.close() // causes explicit flush that also fails with the same error
}

func TestRemoteReporterDroppedSpans(t *testing.T) {
	s := makeReporterSuite(t, ReporterOptions.QueueSize(1))
	defer s.close()

	s.reporter.sendCloseEvent()       // manually shut down the worker
	s.tracer.StartSpan("s1").Finish() // this span should be added to the queue
	s.tracer.StartSpan("s2").Finish() // this span should be dropped since the queue is full

	s.metricsFactory.AssertCounterMetrics(t,
		metricstest.ExpectedMetric{
			Name:  "jaeger.tracer.reporter_spans",
			Tags:  map[string]string{"result": "ok"},
			Value: 0,
		},
		metricstest.ExpectedMetric{
			Name:  "jaeger.tracer.reporter_spans",
			Tags:  map[string]string{"result": "dropped"},
			Value: 1,
		},
	)

	go s.reporter.processQueue() // restart the worker so that Close() doesn't deadlock
}

func TestRemoteReporterDoubleClose(t *testing.T) {
	logger := &log.BytesBufferLogger{}
	reporter := NewRemoteReporter(&fakeSender{}, ReporterOptions.QueueSize(1), ReporterOptions.Logger(logger))
	reporter.Close()
	reporter.Close()
	assert.Equal(t, "ERROR: Repeated attempt to close the reporter is ignored\n", logger.String())
}

func TestRemoteReporterReportAfterClose(t *testing.T) {
	s := makeReporterSuite(t)
	span := s.tracer.StartSpan("leela")

	s.close() // Close the tracer, which also closes and flushes the reporter

	assert.EqualValues(t, 1, atomic.LoadInt64(&s.reporter.closed), "reporter state must be closed")
	select {
	case <-s.reporter.queue:
		t.Fatal("Reporter queue must be empty")
	default:
		// expected to get here
	}

	span.Finish()
	item := <-s.reporter.queue
	assert.Equal(t, span, item.span, "since the reporter is closed and its worker routing finished, the span should be in the queue")
}

func TestUDPReporter(t *testing.T) {
	agent, err := testutils.StartMockAgent()
	require.NoError(t, err)
	defer agent.Close()

	testRemoteReporterWithSender(t,
		func(m *Metrics) (Transport, error) {
			return NewUDPTransport(agent.SpanServerAddr(), 0)
		},
		func() []*j.Batch {
			return agent.GetJaegerBatches()
		})
}

func testRemoteReporterWithSender(
	t *testing.T,
	senderFactory func(m *Metrics) (Transport, error),
	getBatches func() []*j.Batch,
) {
	metricsFactory := metricstest.NewFactory(0)
	metrics := NewMetrics(metricsFactory, nil)

	sender, err := senderFactory(metrics)
	require.NoError(t, err)
	reporter := NewRemoteReporter(sender, ReporterOptions.Metrics(metrics)).(*remoteReporter)

	tracer, closer := NewTracer(
		"reporter-test-service",
		NewConstSampler(true),
		reporter,
		TracerOptions.Metrics(metrics))

	span := tracer.StartSpan("leela")
	ext.SpanKindRPCClient.Set(span)
	ext.PeerService.Set(span, "downstream")
	span.Finish()
	closer.Close() // close the tracer, which also closes and flushes the reporter

	// UDP transport uses fire and forget, so we need to wait for spans to get to the agent
	for i := 0; i < 1000; i++ {
		time.Sleep(1 * time.Millisecond)
		if batches := getBatches(); len(batches) > 0 {
			break
		}
	}

	batches := getBatches()
	require.Equal(t, 1, len(batches))
	require.Equal(t, 1, len(batches[0].Spans))
	assert.Equal(t, "leela", batches[0].Spans[0].OperationName)
	assert.Equal(t, "reporter-test-service", batches[0].Process.ServiceName)
	tag := findJaegerTag("peer.service", batches[0].Spans[0].Tags)
	assert.NotNil(t, tag)
	assert.Equal(t, "downstream", *tag.VStr)

	metricsFactory.AssertCounterMetrics(t, []metricstest.ExpectedMetric{
		{Name: "jaeger.tracer.reporter_spans", Tags: map[string]string{"result": "ok"}, Value: 1},
		{Name: "jaeger.tracer.reporter_spans", Tags: map[string]string{"result": "err"}, Value: 0},
	}...)
}

func TestMemoryReporterReport(t *testing.T) {
	reporter := NewInMemoryReporter()
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), reporter)
	defer closer.Close()
	tracer.StartSpan("leela").Finish()
	assert.Len(t, reporter.GetSpans(), 1, "expected number of spans submitted")
	assert.Equal(t, 1, reporter.SpansSubmitted(), "expected number of spans submitted")
	reporter.Reset()
	assert.Len(t, reporter.GetSpans(), 0, "expected number of spans submitted")
	assert.Equal(t, 0, reporter.SpansSubmitted(), "expected number of spans submitted")
}

func TestCompositeReporterReport(t *testing.T) {
	reporter1 := NewInMemoryReporter()
	reporter2 := NewInMemoryReporter()
	reporter3 := NewCompositeReporter(reporter1, reporter2)
	tracer, closer := NewTracer("DOOP", NewConstSampler(true), reporter3)
	defer closer.Close()
	tracer.StartSpan("leela").Finish()
	assert.Len(t, reporter1.GetSpans(), 1, "expected number of spans submitted")
	assert.Len(t, reporter2.GetSpans(), 1, "expected number of spans submitted")
}

func TestLoggingReporter(t *testing.T) {
	logger := &log.BytesBufferLogger{}
	reporter := NewLoggingReporter(logger)
	tracer, closer := NewTracer("test", NewConstSampler(true), reporter)
	defer closer.Close() // will call Close on the reporter
	tracer.StartSpan("sp1").Finish()
	assert.True(t, strings.HasPrefix(logger.String(), "INFO: Reporting span"))
}

type fakeSender struct {
	bufferSize int
	appendErr  error
	flushErr   error

	spans   []*Span
	flushed []*Span
	mutex   sync.Mutex
}

func (s *fakeSender) Append(span *Span) (int, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.spans = append(s.spans, span)
	if n := len(s.spans); n == s.bufferSize {
		return s.flushNoLock()
	}
	return 0, s.appendErr
}

func (s *fakeSender) Flush() (int, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.flushNoLock()
}

func (s *fakeSender) flushNoLock() (int, error) {
	n := len(s.spans)
	s.flushed = append(s.flushed, s.spans...)
	s.spans = nil
	return n, s.flushErr
}

func (s *fakeSender) Close() error { return nil }

func (s *fakeSender) BufferedSpans() []*Span {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	res := make([]*Span, len(s.spans))
	copy(res, s.spans)
	return res
}

func (s *fakeSender) FlushedSpans() []*Span {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	res := make([]*Span, len(s.flushed))
	copy(res, s.flushed)
	return res
}

func (s *fakeSender) assertBufferedSpans(t *testing.T, count int) {
	for i := 0; i < 1000; i++ {
		if len(s.BufferedSpans()) == count {
			break
		}
		time.Sleep(time.Millisecond)
	}
	assert.Len(t, s.BufferedSpans(), count)
}

func (s *fakeSender) assertFlushedSpans(t *testing.T, count int) {
	for i := 0; i < 1000; i++ {
		if len(s.FlushedSpans()) == count {
			break
		}
		time.Sleep(time.Millisecond)
	}
	assert.Len(t, s.FlushedSpans(), count)
}

func findDomainLog(span *Span, key string) *opentracing.LogRecord {
	for _, log := range span.logs {
		if log.Fields[0].Value().(string) == key {
			return &log
		}
	}
	return nil
}

func findDomainTag(span *Span, key string) *Tag {
	for _, tag := range span.tags {
		if tag.key == key {
			return &tag
		}
	}
	return nil
}
