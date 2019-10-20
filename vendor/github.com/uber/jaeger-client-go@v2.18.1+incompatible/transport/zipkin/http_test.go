// Copyright (c) 2017 The OpenTracing Authors
// Copyright (c) 2016 Bas van Beek
// Copyright (c) 2016 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

package zipkin

// This code is adapted from 'collector-http_test.go' from
// https://github.com/openzipkin/zipkin-go-opentracing/

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uber/jaeger-client-go/thrift"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/thrift-gen/zipkincore"
)

const spanPath = "/api/v1/spans"

func TestHttpTransport(t *testing.T) {
	server := newHTTPServer(t)
	defer server.Close()

	httpUsername := "Aphex"
	httpPassword := "Twin"
	sender, err := NewHTTPTransport(server.SpanURL(), HTTPBasicAuth(httpUsername, httpPassword))
	require.NoError(t, err)

	tracer, closer := jaeger.NewTracer(
		"test",
		jaeger.NewConstSampler(true),
		jaeger.NewRemoteReporter(sender),
	)

	span := tracer.StartSpan("root")
	span.Finish()

	closer.Close()

	// Need to yield to the select loop to accept the send request, and then
	// yield again to the send operation to write to the socket. I think the
	// best way to do that is just give it some time.

	deadline := time.Now().Add(2 * time.Second)
	for {
		if time.Now().After(deadline) {
			t.Fatal("never received a span")
		}
		if want, have := 1, len(server.spans()); want != have {
			time.Sleep(time.Millisecond)
			continue
		}
		break
	}

	srcSpanCtx := span.Context().(jaeger.SpanContext)
	gotSpan := server.spans()[0]
	assert.Equal(t, "root", gotSpan.Name)
	assert.EqualValues(t, srcSpanCtx.TraceID().Low, gotSpan.TraceID)
	assert.EqualValues(t, srcSpanCtx.SpanID(), gotSpan.ID)
	assert.Equal(t, &HTTPBasicAuthCredentials{username: httpUsername, password: httpPassword}, server.authCredentials[0])
}

func TestHTTPOptions(t *testing.T) {
	roundTripper := &http.Transport{
		MaxIdleConns: 80000,
	}
	sender, err := NewHTTPTransport(
		"some url",
		HTTPLogger(log.StdLogger),
		HTTPBatchSize(123),
		HTTPTimeout(123*time.Millisecond),
		HTTPBasicAuth("urundai", "kuzhambu"),
		HTTPRoundTripper(roundTripper),
	)
	require.NoError(t, err)
	assert.Equal(t, log.StdLogger, sender.logger)
	assert.Equal(t, 123, sender.batchSize)
	assert.Equal(t, 123*time.Millisecond, sender.client.Timeout)
	assert.Equal(t, "urundai", sender.httpCredentials.username)
	assert.Equal(t, "kuzhambu", sender.httpCredentials.password)
	assert.Equal(t, roundTripper, sender.client.Transport)
}

type recordingLogger struct {
	errors []string
}

func (r *recordingLogger) Error(msg string) {
	r.errors = append(r.errors, msg)
}

func (r *recordingLogger) Infof(msg string, args ...interface{}) {}

func TestHTTPErrorLogging(t *testing.T) {
	type testCase struct {
		URL                   string
		expectErrorSubstrings []string
	}

	s := newHTTPServer(t)
	defer s.Close()

	tcs := []testCase{
		{ // good case
			URL: s.SpanURL(),
		},
		{ // bad URL path
			URL:                   s.httpServer.URL + "/bad_suffix",
			expectErrorSubstrings: []string{"error from collector: code=404"},
		},
		{ // bad URL scheme
			URL:                   "badscheme://localhost:10001",
			expectErrorSubstrings: []string{"error when flushing the buffer"},
		},
	}

	for _, tc := range tcs {
		logger := new(recordingLogger)

		sender, err := NewHTTPTransport(tc.URL)
		require.NoError(t, err)
		tracer, closer := jaeger.NewTracer(
			"test",
			jaeger.NewConstSampler(true),
			jaeger.NewRemoteReporter(sender, jaeger.ReporterOptions.Logger(logger)),
		)

		span := tracer.StartSpan("root")
		span.Finish()

		closer.Close()

		expectedNumErrors := len(tc.expectErrorSubstrings)
		require.Len(t, logger.errors, expectedNumErrors, fmt.Sprintf("the number of errors is not equal to %d", expectedNumErrors))

		for i, subStr := range tc.expectErrorSubstrings {
			assert.Contains(t, logger.errors[i], subStr)
		}
	}
}

type httpServer struct {
	t               *testing.T
	zipkinSpans     []*zipkincore.Span
	authCredentials []*HTTPBasicAuthCredentials
	mutex           sync.RWMutex
	httpServer      *httptest.Server
}

func (s *httpServer) SpanURL() string {
	return s.httpServer.URL + spanPath
}

func (s *httpServer) Close() {
	s.httpServer.Close()
}

func (s *httpServer) spans() []*zipkincore.Span {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.zipkinSpans
}

func (s *httpServer) credentials() []*HTTPBasicAuthCredentials {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.authCredentials
}

func newHTTPServer(t *testing.T) *httpServer {
	server := &httpServer{
		t:               t,
		zipkinSpans:     make([]*zipkincore.Span, 0),
		authCredentials: make([]*HTTPBasicAuthCredentials, 0),
		mutex:           sync.RWMutex{},
	}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != spanPath {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		contextType := r.Header.Get("Content-Type")
		if contextType != "application/x-thrift" {
			t.Errorf(
				"except Content-Type should be application/x-thrift, but is %s",
				contextType)
			return
		}

		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			t.Error(err)
			return
		}
		buffer := thrift.NewTMemoryBuffer()
		if _, err = buffer.Write(body); err != nil {
			t.Error(err)
			return
		}
		transport := thrift.NewTBinaryProtocolTransport(buffer)
		_, size, err := transport.ReadListBegin()
		if err != nil {
			t.Error(err)
			return
		}
		var spans []*zipkincore.Span
		for i := 0; i < size; i++ {
			zs := &zipkincore.Span{}
			if err = zs.Read(transport); err != nil {
				t.Error(err)
				return
			}
			spans = append(spans, zs)
		}
		if err := transport.ReadListEnd(); err != nil {
			t.Error(err)
			return
		}
		server.mutex.Lock()
		defer server.mutex.Unlock()
		server.zipkinSpans = append(server.zipkinSpans, spans...)
		u, p, _ := r.BasicAuth()
		server.authCredentials = append(server.authCredentials, &HTTPBasicAuthCredentials{username: u, password: p})
	})
	server.httpServer = httptest.NewServer(handler)

	return server
}
