// Copyright (c) 2018 Uber Technologies, Inc.
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

package adapters

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/metricstest"
)

func TestCache(t *testing.T) {
	f := metricstest.NewFactory(100 * time.Second)
	c1 := f.Counter(metrics.Options{Name: "x"})
	g1 := f.Gauge(metrics.Options{Name: "y"})
	t1 := f.Timer(metrics.TimerOptions{Name: "z"})
	h1 := f.Histogram(metrics.HistogramOptions{Name: "h"})

	c := newCache()

	c2 := c.getOrSetCounter("x", func() metrics.Counter { return c1 })
	assert.Equal(t, c1, c2)
	g2 := c.getOrSetGauge("y", func() metrics.Gauge { return g1 })
	assert.Equal(t, g1, g2)
	t2 := c.getOrSetTimer("z", func() metrics.Timer { return t1 })
	assert.Equal(t, t1, t2)
	h2 := c.getOrSetHistogram("h", func() metrics.Histogram { return h1 })
	assert.Equal(t, h1, h2)

	c3 := c.getOrSetCounter("x", func() metrics.Counter { panic("c1") })
	assert.Equal(t, c1, c3)
	g3 := c.getOrSetGauge("y", func() metrics.Gauge { panic("g1") })
	assert.Equal(t, g1, g3)
	t3 := c.getOrSetTimer("z", func() metrics.Timer { panic("t1") })
	assert.Equal(t, t1, t3)
	h3 := c.getOrSetHistogram("h", func() metrics.Histogram { panic("h1") })
	assert.Equal(t, h1, h3)
}
