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

package server

import (
	"context"
	"fmt"
	"testing"

	"github.com/opentracing/opentracing-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/crossdock/common"
	"github.com/uber/jaeger-client-go/crossdock/log"
	"github.com/uber/jaeger-client-go/crossdock/thrift/tracetest"
)

func TestServerJSON(t *testing.T) {
	tracer, tCloser := jaeger.NewTracer(
		"crossdock",
		jaeger.NewConstSampler(false),
		jaeger.NewNullReporter())
	defer tCloser.Close()

	s := &Server{HostPortHTTP: "127.0.0.1:0", Tracer: tracer}
	err := s.Start()
	require.NoError(t, err)
	defer s.Close()

	req := tracetest.NewStartTraceRequest()
	req.Sampled = true
	req.Baggage = "Zoidberg"
	req.Downstream = &tracetest.Downstream{
		ServiceName: "go",
		Host:        "localhost",
		Port:        s.GetPortHTTP(),
		Transport:   tracetest.Transport_HTTP,
		Downstream: &tracetest.Downstream{
			ServiceName: "go",
			Host:        "localhost",
			Port:        s.GetPortHTTP(),
			Transport:   tracetest.Transport_HTTP,
		},
	}

	url := fmt.Sprintf("http://%s/start_trace", s.HostPortHTTP)
	result, err := common.PostJSON(context.Background(), url, req)

	require.NoError(t, err)
	log.Printf("response=%+v", &result)
}

func TestObserveSpan(t *testing.T) {
	tracer, tCloser := jaeger.NewTracer(
		"crossdock",
		jaeger.NewConstSampler(true),
		jaeger.NewNullReporter())
	defer tCloser.Close()

	_, err := observeSpan(context.Background(), tracer)
	assert.Error(t, err)

	span := tracer.StartSpan("hi")
	span.SetBaggageItem(BaggageKey, "xyz")
	ctx := opentracing.ContextWithSpan(context.Background(), span)

	s, err := observeSpan(ctx, tracer)
	assert.NoError(t, err)
	assert.True(t, s.Sampled)
	traceID := span.Context().(jaeger.SpanContext).TraceID().String()
	assert.Equal(t, traceID, s.TraceId)
	assert.Equal(t, "xyz", s.Baggage)
}
