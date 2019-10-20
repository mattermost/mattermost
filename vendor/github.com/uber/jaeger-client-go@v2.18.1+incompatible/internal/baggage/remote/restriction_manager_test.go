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

package remote

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uber-go/atomic"
	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/metricstest"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/internal/baggage"
	thrift "github.com/uber/jaeger-client-go/thrift-gen/baggage"
)

const (
	service      = "svc"
	expectedKey  = "key"
	expectedSize = 10
)

var (
	testRestrictions = []*thrift.BaggageRestriction{
		{BaggageKey: expectedKey, MaxValueLength: int32(expectedSize)},
	}
)

var _ io.Closer = new(RestrictionManager) // API check

type baggageHandler struct {
	returnError  *atomic.Bool
	restrictions []*thrift.BaggageRestriction
}

func (h *baggageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h.returnError.Load() {
		w.WriteHeader(http.StatusInternalServerError)
	} else {
		bytes, _ := json.Marshal(h.restrictions)
		w.Header().Add("Content-Type", "application/json")
		w.Write(bytes)
	}
}

func (h *baggageHandler) setReturnError(b bool) {
	h.returnError.Store(b)
}

func withHTTPServer(
	restrictions []*thrift.BaggageRestriction,
	f func(
		metrics *jaeger.Metrics,
		factory *metricstest.Factory,
		handler *baggageHandler,
		server *httptest.Server,
	),
) {
	factory := metricstest.NewFactory(0)
	m := jaeger.NewMetrics(factory, nil)

	handler := &baggageHandler{returnError: atomic.NewBool(true), restrictions: restrictions}
	server := httptest.NewServer(handler)
	defer server.Close()

	f(m, factory, handler, server)
}

func TestNewRemoteRestrictionManager(t *testing.T) {
	withHTTPServer(
		testRestrictions,
		func(
			metrics *jaeger.Metrics,
			factory *metricstest.Factory,
			handler *baggageHandler,
			server *httptest.Server,
		) {
			handler.setReturnError(false)
			mgr := NewRestrictionManager(
				service,
				Options.HostPort(getHostPort(t, server.URL)),
				Options.Metrics(metrics),
				Options.Logger(jaeger.NullLogger),
			)
			defer mgr.Close()

			for i := 0; i < 100; i++ {
				if mgr.isReady() {
					break
				}
				time.Sleep(time.Millisecond)
			}
			require.True(t, mgr.isReady())

			restriction := mgr.GetRestriction(service, expectedKey)
			assert.EqualValues(t, baggage.NewRestriction(true, expectedSize), restriction)

			badKey := "bad-key"
			restriction = mgr.GetRestriction(service, badKey)
			assert.EqualValues(t, baggage.NewRestriction(false, 0), restriction)

			factory.AssertCounterMetrics(t,
				metricstest.ExpectedMetric{
					Name:  "jaeger.tracer.baggage_restrictions_updates",
					Tags:  map[string]string{"result": "ok"},
					Value: 1,
				},
			)
		})
}

func TestDenyBaggageOnInitializationFailure(t *testing.T) {
	withHTTPServer(
		testRestrictions,
		func(
			m *jaeger.Metrics,
			factory *metricstest.Factory,
			handler *baggageHandler,
			server *httptest.Server,
		) {
			mgr := NewRestrictionManager(
				service,
				Options.DenyBaggageOnInitializationFailure(true),
				Options.HostPort(getHostPort(t, server.URL)),
				Options.Metrics(m),
				Options.Logger(jaeger.NullLogger),
			)
			require.False(t, mgr.isReady())

			metricName := "jaeger.tracer.baggage_restrictions_updates"
			metricTags := map[string]string{"result": "err"}
			key := metrics.GetKey(metricName, metricTags, "|", "=")
			for i := 0; i < 100; i++ {
				// wait until the async initialization call is complete
				counters, _ := factory.Snapshot()
				if _, ok := counters[key]; ok {
					break
				}
				time.Sleep(time.Millisecond)
			}

			factory.AssertCounterMetrics(t,
				metricstest.ExpectedMetric{
					Name:  metricName,
					Tags:  metricTags,
					Value: 1,
				},
			)

			// DenyBaggageOnInitializationFailure should not allow any key to be written
			restriction := mgr.GetRestriction(service, expectedKey)
			assert.EqualValues(t, baggage.NewRestriction(false, 0), restriction)

			// have the http server return restrictions
			handler.setReturnError(false)
			mgr.updateRestrictions()

			// Wait until manager retrieves baggage restrictions
			for i := 0; i < 100; i++ {
				if mgr.isReady() {
					break
				}
				time.Sleep(time.Millisecond)
			}
			require.True(t, mgr.isReady())

			restriction = mgr.GetRestriction(service, expectedKey)
			assert.EqualValues(t, baggage.NewRestriction(true, expectedSize), restriction)
		})
}

func TestAllowBaggageOnInitializationFailure(t *testing.T) {
	withHTTPServer(
		testRestrictions,
		func(
			metrics *jaeger.Metrics,
			factory *metricstest.Factory,
			handler *baggageHandler,
			server *httptest.Server,
		) {
			mgr := NewRestrictionManager(
				service,
				Options.RefreshInterval(time.Millisecond),
				Options.HostPort(getHostPort(t, server.URL)),
				Options.Metrics(metrics),
				Options.Logger(jaeger.NullLogger),
			)
			require.False(t, mgr.isReady())

			// AllowBaggageOnInitializationFailure should allow any key to be written
			restriction := mgr.GetRestriction(service, expectedKey)
			assert.EqualValues(t, baggage.NewRestriction(true, 2048), restriction)
		})
}

func getHostPort(t *testing.T, s string) string {
	u, err := url.Parse(s)
	require.NoError(t, err, "Failed to parse url")
	return u.Host
}
