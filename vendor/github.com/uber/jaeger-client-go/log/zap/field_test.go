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

package zap

import (
	"context"
	"testing"

	jaeger "github.com/uber/jaeger-client-go"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestTraceField(t *testing.T) {
	assert.Equal(t, zap.Skip(), Trace(nil), "Expected Trace of a nil context to be a no-op.")

	withTracedContext(func(ctx context.Context) {
		enc := zapcore.NewMapObjectEncoder()
		Trace(ctx).AddTo(enc)

		logged, ok := enc.Fields["trace"].(map[string]interface{})
		require.True(t, ok, "Expected trace to be a map.")

		// We could extract the span from the context and assert specific IDs,
		// but that just copies the production code. Instead, just assert that
		// the keys we expect are present.
		keys := make(map[string]struct{}, len(logged))
		for k := range logged {
			keys[k] = struct{}{}
		}
		assert.Equal(
			t,
			map[string]struct{}{"span": {}, "trace": {}},
			keys,
			"Expected to log span and trace IDs.",
		)
	})
}

func withTracedContext(f func(ctx context.Context)) {
	tracer, closer := jaeger.NewTracer(
		"serviceName", jaeger.NewConstSampler(true), jaeger.NewNullReporter(),
	)
	defer closer.Close()

	ctx := opentracing.ContextWithSpan(context.Background(), tracer.StartSpan("test"))
	f(ctx)
}
