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

package endtoend

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/stretchr/testify/assert"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/config"
	"github.com/uber/jaeger-client-go/log"
)

var (
	testOperation = "testOperation"
	testService   = "testService"

	testConfig = config.Configuration{
		Disabled: false,
		Sampler: &config.SamplerConfig{
			Type:              jaeger.SamplerTypeRemote,
			Param:             1.0,
			SamplingServerURL: "http://localhost:5778/sampling",
		},
		Reporter: &config.ReporterConfig{
			BufferFlushInterval: time.Second,
			LocalAgentHostPort:  "localhost:5775",
		},
	}

	badConfig = config.Configuration{
		Disabled: false,
		Sampler: &config.SamplerConfig{
			Type: "INVALID_TYPE",
		},
	}

	testTraceRequest = traceRequest{
		Type:      jaeger.SamplerTypeConst,
		Operation: testOperation,
		Tags: map[string]string{
			"key": "value",
		},
		Count: 2,
	}

	testInvalidJSON = `bad_json`

	testTraceJSONRequest = `
		{
			"type": "const",
			"operation": "testOperation",
			"tags": {
				"key": "value"
			},
			"count": 2
		}
	`

	testInvalidTypeJSONRequest = `
		{
			"type": "INVALID_TYPE",
			"operation": "testOperation",
			"tags": {
				"key": "value"
			},
			"count": 2
		}
	`
)

func newInMemoryTracer() (opentracing.Tracer, *jaeger.InMemoryReporter) {
	inMemoryReporter := jaeger.NewInMemoryReporter()
	tracer, _ := jaeger.NewTracer(
		testService,
		jaeger.NewConstSampler(true),
		inMemoryReporter,
		jaeger.TracerOptions.Metrics(jaeger.NewNullMetrics()),
		jaeger.TracerOptions.Logger(log.NullLogger))
	return tracer, inMemoryReporter
}

func TestInit(t *testing.T) {
	handler := NewHandler("", "")
	err := handler.init(testConfig)
	assert.NoError(t, err)
}

func TestInitBadConfig(t *testing.T) {
	handler := NewHandler("", "")
	err := handler.init(badConfig)
	assert.Error(t, err)
}

func TestGetTracer(t *testing.T) {
	iTracer, _ := newInMemoryTracer()
	handler := &Handler{tracers: map[string]opentracing.Tracer{jaeger.SamplerTypeConst: iTracer}}
	tracer := handler.getTracer(jaeger.SamplerTypeConst)
	assert.Equal(t, iTracer, tracer)
}

func TestGetTracerError(t *testing.T) {
	handler := NewHandler("", "")
	tracer := handler.getTracer("INVALID_TYPE")
	assert.Nil(t, tracer)
}

func TestGenerateTraces(t *testing.T) {
	tracer, _ := newInMemoryTracer()

	tests := []struct {
		expectedCode int
		json         string
		handler      *Handler
	}{
		{http.StatusOK, testTraceJSONRequest, &Handler{tracers: map[string]opentracing.Tracer{jaeger.SamplerTypeConst: tracer}}},
		{http.StatusBadRequest, testInvalidJSON, NewHandler("", "")},
		{http.StatusInternalServerError, testInvalidTypeJSONRequest, NewHandler("", "")}, // Tracer failed to initialize
	}

	for _, test := range tests {
		req, err := http.NewRequest("POST", "/create_spans", bytes.NewBuffer([]byte(test.json)))
		assert.NoError(t, err, "Failed to initialize request")
		recorder := httptest.NewRecorder()
		handlerFunc := http.HandlerFunc(test.handler.GenerateTraces)
		handlerFunc.ServeHTTP(recorder, req)

		assert.Equal(t, test.expectedCode, recorder.Code)
	}
}

func TestGenerateTracesInternal(t *testing.T) {
	tracer, reporter := newInMemoryTracer()
	generateTraces(tracer, &testTraceRequest)
	assert.Equal(t, 2, reporter.SpansSubmitted())
}
