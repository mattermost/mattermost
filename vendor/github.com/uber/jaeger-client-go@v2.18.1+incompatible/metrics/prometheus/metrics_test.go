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

package prometheus_test

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	jprom "github.com/uber/jaeger-lib/metrics/prometheus"

	"github.com/uber/jaeger-client-go"
)

// TestNewPrometheusMetrics ensures that the metrics do not have conflicting dimensions and will work with Prometheus.
func TestNewPrometheusMetrics(t *testing.T) {
	tags := map[string]string{"lib": "jaeger"}

	factory := jprom.New(jprom.WithRegisterer(prometheus.NewPedanticRegistry()))
	m := jaeger.NewMetrics(factory, tags)

	require.NotNil(t, m.SpansStartedSampled, "counter not initialized")
	require.NotNil(t, m.ReporterQueueLength, "gauge not initialized")
}
