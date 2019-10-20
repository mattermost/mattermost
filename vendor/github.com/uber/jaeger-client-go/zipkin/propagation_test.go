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

package zipkin

import (
	"strconv"
	"testing"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uber/jaeger-client-go"
)

var (
	rootSampled       = newSpanContext(1, 2, 0, true, map[string]string{"foo": "bar"})
	nonRootSampled    = newSpanContext(1, 2, 1, true, nil)
	nonRootNonSampled = newSpanContext(1, 2, 1, false, nil)
)

var (
	rootSampledHeader = opentracing.TextMapCarrier{
		"x-b3-traceid": "1",
		"x-b3-spanid":  "2",
		"x-b3-sampled": "1",
		"baggage-foo":  "bar",
	}
	nonRootSampledHeader = opentracing.TextMapCarrier{
		"x-b3-traceid":      "1",
		"x-b3-spanid":       "2",
		"x-b3-parentspanid": "1",
		"x-b3-sampled":      "1",
	}
	nonRootNonSampledHeader = opentracing.TextMapCarrier{
		"x-b3-traceid":      "1",
		"x-b3-spanid":       "2",
		"x-b3-parentspanid": "1",
		"x-b3-sampled":      "0",
	}
	rootSampledBooleanHeader = opentracing.TextMapCarrier{
		"x-b3-traceid": "1",
		"x-b3-spanid":  "2",
		"x-b3-sampled": "true",
		"baggage-foo":  "bar",
	}
	nonRootSampledBooleanHeader = opentracing.TextMapCarrier{
		"x-b3-traceid":      "1",
		"x-b3-spanid":       "2",
		"x-b3-parentspanid": "1",
		"x-b3-sampled":      "true",
	}
	invalidHeader = opentracing.TextMapCarrier{
		"x-b3-traceid":      "jdkafhsd",
		"x-b3-spanid":       "afsdfsdf",
		"x-b3-parentspanid": "hiagggdf",
		"x-b3-sampled":      "sdfgsdfg",
	}
	sampled128bitTraceID = opentracing.TextMapCarrier{
		"x-b3-traceid": "463ac35c9f6413ad48485a3953bb6124",
		"x-b3-spanid":  "2",
		"x-b3-sampled": "1",
	}
	invalidTraceID = opentracing.TextMapCarrier{
		"x-b3-traceid": "00000000000000000000000000000000",
		"x-b3-spanid":  "2",
		"x-b3-sampled": "1",
	}
)

var (
	propagator = NewZipkinB3HTTPHeaderPropagator()
)

func newSpanContext(traceID, spanID, parentID uint64, sampled bool, baggage map[string]string) jaeger.SpanContext {
	return jaeger.NewSpanContext(
		jaeger.TraceID{Low: traceID},
		jaeger.SpanID(spanID),
		jaeger.SpanID(parentID),
		sampled,
		baggage,
	)
}

func TestExtractorInvalid(t *testing.T) {
	_, err := propagator.Extract(invalidHeader)
	assert.Error(t, err)
}

func TestExtractorRootSampled(t *testing.T) {
	ctx, err := propagator.Extract(rootSampledHeader)
	assert.Nil(t, err)
	assert.EqualValues(t, rootSampled, ctx)
}

func TestExtractorNonRootSampled(t *testing.T) {
	ctx, err := propagator.Extract(nonRootSampledHeader)
	assert.Nil(t, err)
	assert.EqualValues(t, nonRootSampled, ctx)
}

func TestExtractorNonRootNonSampled(t *testing.T) {
	ctx, err := propagator.Extract(nonRootNonSampledHeader)
	assert.Nil(t, err)
	assert.EqualValues(t, nonRootNonSampled, ctx)
}

func TestExtractorRootSampledBoolean(t *testing.T) {
	ctx, err := propagator.Extract(rootSampledBooleanHeader)
	assert.Nil(t, err)
	assert.EqualValues(t, rootSampled, ctx)
}

func TestExtractorNonRootSampledBoolean(t *testing.T) {
	ctx, err := propagator.Extract(nonRootSampledBooleanHeader)
	assert.Nil(t, err)
	assert.EqualValues(t, nonRootSampled, ctx)
}

func TestInjectorRootSampled(t *testing.T) {
	hdr := opentracing.TextMapCarrier{}
	err := propagator.Inject(rootSampled, hdr)
	assert.Nil(t, err)
	assert.EqualValues(t, rootSampledHeader, hdr)
}

func TestInjectorNonRootSampled(t *testing.T) {
	hdr := opentracing.TextMapCarrier{}
	err := propagator.Inject(nonRootSampled, hdr)
	assert.Nil(t, err)
	assert.EqualValues(t, nonRootSampledHeader, hdr)
}

func TestInjectorNonRootNonSampled(t *testing.T) {
	hdr := opentracing.TextMapCarrier{}
	err := propagator.Inject(nonRootNonSampled, hdr)
	assert.Nil(t, err)
	assert.EqualValues(t, nonRootNonSampledHeader, hdr)
}

func TestCustomBaggagePrefix(t *testing.T) {
	propag := NewZipkinB3HTTPHeaderPropagator(BaggagePrefix("emoji:)"))
	hdr := opentracing.TextMapCarrier{}
	sc := newSpanContext(1, 2, 0, true, map[string]string{"foo": "bar"})
	err := propag.Inject(sc, hdr)
	assert.Nil(t, err)
	m := opentracing.TextMapCarrier{
		"x-b3-traceid": "1",
		"x-b3-spanid":  "2",
		"x-b3-sampled": "1",
		"emoji:)foo":   "bar",
	}
	assert.EqualValues(t, m, hdr)

	sc, err = propag.Extract(m)
	require.NoError(t, err)
	sc.ForeachBaggageItem(func(k, v string) bool {
		assert.Equal(t, "foo", k)
		assert.Equal(t, "bar", v)
		return true
	})
}

func Test128bitTraceID(t *testing.T) {
	spanCtx, err := propagator.Extract(sampled128bitTraceID)
	assert.Nil(t, err)

	high, _ := strconv.ParseUint("463ac35c9f6413ad", 16, 64)
	low, _ := strconv.ParseUint("48485a3953bb6124", 16, 64)
	assert.EqualValues(t, jaeger.TraceID{High: high, Low: low}, spanCtx.TraceID())

	hdr := opentracing.TextMapCarrier{}
	err = propagator.Inject(spanCtx, hdr)
	assert.Nil(t, err)
	assert.EqualValues(t, sampled128bitTraceID["x-b3-traceid"], hdr["x-b3-traceid"])
}

func TestInvalid128bitTraceID(t *testing.T) {
	_, err := propagator.Extract(invalidTraceID)
	assert.EqualError(t, err, opentracing.ErrSpanContextNotFound.Error())
}
