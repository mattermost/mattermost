// Copyright (c) 2018 The Jaeger Authors.
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
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/uber/jaeger-client-go"
)

func TestDefaults(t *testing.T) {
	options := applyOptions()
	assert.Equal(t, "localhost:5778", options.hostPort)
	assert.Equal(t, time.Second*5, options.refreshInterval)
	assert.NotNil(t, options.metrics)
	assert.NotNil(t, options.logger)
	assert.False(t, options.synchronousInitialization)
}

func TestOptions(t *testing.T) {
	metrics := jaeger.NewNullMetrics()
	logger := jaeger.NullLogger
	options := applyOptions(
		Options.Metrics(metrics),
		Options.Logger(logger),
		Options.HostPort(":"),
		Options.RefreshInterval(time.Second),
		Options.SynchronousInitialization(true),
	)
	assert.Equal(t, ":", options.hostPort)
	assert.Equal(t, time.Second, options.refreshInterval)
	assert.Equal(t, metrics, options.metrics)
	assert.Equal(t, logger, options.logger)
	assert.True(t, options.synchronousInitialization)
}
