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

package transport

import (
	"io/ioutil"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/uber/jaeger-client-go/thrift"

	"github.com/uber/jaeger-client-go"
	j "github.com/uber/jaeger-client-go/thrift-gen/jaeger"
)

func TestHTTPTransport(t *testing.T) {
	server := newHTTPServer(t)
	httpUsername := "Bender"
	httpPassword := "Rodriguez"
	sender := NewHTTPTransport(
		"http://localhost:10001/api/v1/spans",
		HTTPBatchSize(1),
		HTTPBasicAuth(httpUsername, httpPassword),
	)

	tracer, closer := jaeger.NewTracer(
		"test",
		jaeger.NewConstSampler(true),
		jaeger.NewRemoteReporter(sender),
	)
	defer closer.Close()

	span := tracer.StartSpan("root")
	span.Finish()

	// Need to yield to the select loop to accept the send request, and then
	// yield again to the send operation to write to the socket. I think the
	// best way to do that is just give it some time.

	deadline := time.Now().Add(2 * time.Second)
	for {
		if time.Now().After(deadline) {
			t.Fatal("never received a span")
		}
		if want, have := 1, len(server.getBatches()); want != have {
			time.Sleep(time.Millisecond)
			continue
		}
		break
	}

	srcSpanCtx := span.Context().(jaeger.SpanContext)
	gotBatch := server.getBatches()[0]
	assert.Len(t, gotBatch.Spans, 1)
	assert.Equal(t, "test", gotBatch.Process.ServiceName)
	gotSpan := gotBatch.Spans[0]
	assert.Equal(t, "root", gotSpan.OperationName)
	assert.EqualValues(t, srcSpanCtx.TraceID().High, gotSpan.TraceIdHigh)
	assert.EqualValues(t, srcSpanCtx.TraceID().Low, gotSpan.TraceIdLow)
	assert.EqualValues(t, srcSpanCtx.SpanID(), gotSpan.SpanId)
	assert.Equal(t,
		&HTTPBasicAuthCredentials{username: httpUsername, password: httpPassword},
		server.authCredentials[0],
	)
}

func TestHTTPOptions(t *testing.T) {
	roundTripper := &http.Transport{
		MaxIdleConns: 80000,
	}
	sender := NewHTTPTransport(
		"some url",
		HTTPBatchSize(123),
		HTTPTimeout(123*time.Millisecond),
		HTTPRoundTripper(roundTripper),
	)
	assert.Equal(t, 123, sender.batchSize)
	assert.Equal(t, 123*time.Millisecond, sender.client.Timeout)
	assert.Equal(t, roundTripper, sender.client.Transport)
}

type httpServer struct {
	t               *testing.T
	batches         []*j.Batch
	authCredentials []*HTTPBasicAuthCredentials
	mutex           sync.RWMutex
}

func (s *httpServer) getBatches() []*j.Batch {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.batches
}

func (s *httpServer) credentials() []*HTTPBasicAuthCredentials {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.authCredentials
}

// TODO this function and zipkin/http_test.go#newHTTPServer look like twins lost at birth
func newHTTPServer(t *testing.T) *httpServer {
	server := &httpServer{
		t:               t,
		batches:         make([]*j.Batch, 0),
		authCredentials: make([]*HTTPBasicAuthCredentials, 0),
		mutex:           sync.RWMutex{},
	}
	http.HandleFunc("/api/v1/spans", func(w http.ResponseWriter, r *http.Request) {
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
		batch := &j.Batch{}
		if err = batch.Read(transport); err != nil {
			t.Error(err)
			return
		}
		server.mutex.Lock()
		defer server.mutex.Unlock()
		server.batches = append(server.batches, batch)
		u, p, _ := r.BasicAuth()
		server.authCredentials = append(server.authCredentials, &HTTPBasicAuthCredentials{username: u, password: p})
	})

	go func() {
		http.ListenAndServe(":10001", nil)
	}()

	return server
}
