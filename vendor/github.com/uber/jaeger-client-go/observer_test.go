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

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/stretchr/testify/assert"
)

func TestEmptyObserver(t *testing.T) {
	tracer, closer := NewTracer("test", NewConstSampler(true), NewInMemoryReporter())
	defer closer.Close()
	s := tracer.StartSpan("test", ext.RPCServerOption(nil))
	s.Finish()
	assert.Equal(t, s.(*Span).observer, noopSpanObserver)
}

func TestObservers(t *testing.T) {
	tracer, closer := NewTracer(
		"test",
		NewConstSampler(true),
		NewInMemoryReporter(),
		TracerOptions.Observer(testObserver{}),
		TracerOptions.Observer(testObserver{}),
	)
	defer closer.Close()

	s := tracer.StartSpan("test", ext.RPCServerOption(nil))

	forEachObs := func(f func(so *testSpanObserver)) {
		observers := s.(*Span).observer.(*compositeSpanObserver).observers
		assert.Len(t, observers, 2)
		for _, so := range observers {
			f(so.(*testSpanObserver))
		}
	}

	forEachObs(func(so *testSpanObserver) {
		assert.Equal(t, testSpanObserver{
			operationName: "test",
			tags: map[string]interface{}{
				"span.kind": ext.SpanKindRPCServerEnum,
			},
		}, *so)
	})

	s.SetOperationName("test2")
	s.SetTag("bender", "rodriguez")
	forEachObs(func(so *testSpanObserver) {
		assert.Equal(t, testSpanObserver{
			operationName: "test2",
			tags: map[string]interface{}{
				"span.kind": ext.SpanKindRPCServerEnum,
				"bender":    "rodriguez",
			},
		}, *so)
	})

	s.Finish()
	forEachObs(func(so *testSpanObserver) {
		assert.True(t, so.finished)
	})
}

type testObserver struct{}

type testSpanObserver struct {
	operationName string
	tags          map[string]interface{}
	finished      bool
}

func (o testObserver) OnStartSpan(operationName string, options opentracing.StartSpanOptions) SpanObserver {
	tags := make(map[string]interface{})
	for k, v := range options.Tags {
		tags[k] = v
	}
	return &testSpanObserver{
		operationName: operationName,
		tags:          tags,
	}
}

func (o *testSpanObserver) OnSetOperationName(operationName string) {
	o.operationName = operationName
}

func (o *testSpanObserver) OnSetTag(key string, value interface{}) {
	o.tags[key] = value
}

func (o *testSpanObserver) OnFinish(options opentracing.FinishOptions) {
	o.finished = true
}
