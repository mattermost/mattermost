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
	"testing"

	"github.com/opentracing/opentracing-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uber/jaeger-lib/metrics/metricstest"

	"github.com/uber/jaeger-client-go/internal/baggage"
)

func withTracerAndMetrics(f func(tracer *Tracer, metrics *Metrics, factory *metricstest.Factory)) {
	factory := metricstest.NewFactory(0)
	m := NewMetrics(factory, nil)

	service := "DOOP"
	tracer, closer := NewTracer(service, NewConstSampler(true), NewNullReporter())
	defer closer.Close()
	f(tracer.(*Tracer), m, factory)
}

func TestTruncateBaggage(t *testing.T) {
	withTracerAndMetrics(func(tracer *Tracer, metrics *Metrics, factory *metricstest.Factory) {
		setter := newBaggageSetter(baggage.NewDefaultRestrictionManager(5), metrics)
		key := "key"
		value := "01234567890"
		expected := "01234"

		parent := tracer.StartSpan("parent").(*Span)
		parent.context = parent.context.WithBaggageItem(key, value)
		span := tracer.StartSpan("child", opentracing.ChildOf(parent.Context())).(*Span)

		setter.setBaggage(span, key, value)
		assertBaggageFields(t, span, key, expected, true, true, false)
		assert.Equal(t, expected, span.context.baggage[key])

		factory.AssertCounterMetrics(t,
			metricstest.ExpectedMetric{
				Name:  "jaeger.tracer.baggage_truncations",
				Value: 1,
			},
			metricstest.ExpectedMetric{
				Name:  "jaeger.tracer.baggage_updates",
				Tags:  map[string]string{"result": "ok"},
				Value: 1,
			},
		)
	})
}

type keyNotAllowedBaggageRestrictionManager struct{}

func (m *keyNotAllowedBaggageRestrictionManager) GetRestriction(service, key string) *baggage.Restriction {
	return baggage.NewRestriction(false, 0)
}

func TestInvalidBaggage(t *testing.T) {
	withTracerAndMetrics(func(tracer *Tracer, metrics *Metrics, factory *metricstest.Factory) {
		setter := newBaggageSetter(&keyNotAllowedBaggageRestrictionManager{}, metrics)
		key := "key"
		value := "value"

		span := tracer.StartSpan("span").(*Span)

		setter.setBaggage(span, key, value)
		assertBaggageFields(t, span, key, value, false, false, true)
		assert.Empty(t, span.context.baggage[key])

		factory.AssertCounterMetrics(t,
			metricstest.ExpectedMetric{
				Name:  "jaeger.tracer.baggage_updates",
				Tags:  map[string]string{"result": "err"},
				Value: 1,
			},
		)
	})
}

func TestNotSampled(t *testing.T) {
	withTracerAndMetrics(func(_ *Tracer, metrics *Metrics, factory *metricstest.Factory) {
		tracer, closer := NewTracer("svc", NewConstSampler(false), NewNullReporter())
		defer closer.Close()

		setter := newBaggageSetter(baggage.NewDefaultRestrictionManager(10), metrics)
		span := tracer.StartSpan("span").(*Span)
		setter.setBaggage(span, "key", "value")
		assert.Empty(t, span.logs, "No baggage fields should be created if span is not sampled")
	})
}

func assertBaggageFields(t *testing.T, sp *Span, key, value string, override, truncated, invalid bool) {
	require.Len(t, sp.logs, 1)
	keys := map[string]struct{}{}
	for _, field := range sp.logs[0].Fields {
		keys[field.String()] = struct{}{}
	}
	assert.Contains(t, keys, "event:baggage")
	assert.Contains(t, keys, "key:"+key)
	assert.Contains(t, keys, "value:"+value)
	if invalid {
		assert.Contains(t, keys, "invalid:true")
	}
	if override {
		assert.Contains(t, keys, "override:true")
	}
	if truncated {
		assert.Contains(t, keys, "truncated:true")
	}
}
