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

package testutils

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uber/jaeger-client-go/thrift-gen/jaeger"
	"github.com/uber/jaeger-client-go/thrift-gen/sampling"
	"github.com/uber/jaeger-client-go/utils"
)

func TestMockAgentSpanServer(t *testing.T) {
	mockAgent, err := StartMockAgent()
	require.NoError(t, err)
	defer mockAgent.Close()

	client, err := mockAgent.SpanServerClient()
	require.NoError(t, err)

	for i := 1; i < 5; i++ {
		batch := &jaeger.Batch{Process: &jaeger.Process{ServiceName: "svc"}}
		spans := make([]*jaeger.Span, i, i)
		for j := 0; j < i; j++ {
			spans[j] = jaeger.NewSpan()
			spans[j].OperationName = fmt.Sprintf("span-%d", j)
		}
		batch.Spans = spans

		err = client.EmitBatch(batch)
		assert.NoError(t, err)

		for k := 0; k < 100; k++ {
			time.Sleep(time.Millisecond)
			batches := mockAgent.GetJaegerBatches()
			if len(batches) > 0 && len(batches[0].Spans) == i {
				break
			}
		}
		batches := mockAgent.GetJaegerBatches()
		require.NotEmpty(t, len(batches))
		require.Equal(t, i, len(batches[0].Spans))
		for j := 0; j < i; j++ {
			assert.Equal(t, fmt.Sprintf("span-%d", j), batches[0].Spans[j].OperationName)
		}
		mockAgent.ResetJaegerBatches()
	}
}

func TestMockAgentSamplingManager(t *testing.T) {
	mockAgent, err := StartMockAgent()
	require.NoError(t, err)
	defer mockAgent.Close()

	err = utils.GetJSON("http://"+mockAgent.SamplingServerAddr()+"/", nil)
	require.Error(t, err, "no 'service' parameter")
	err = utils.GetJSON("http://"+mockAgent.SamplingServerAddr()+"/?service=a&service=b", nil)
	require.Error(t, err, "Too many 'service' parameters")

	var resp sampling.SamplingStrategyResponse
	err = utils.GetJSON("http://"+mockAgent.SamplingServerAddr()+"/?service=something", &resp)
	require.NoError(t, err)
	assert.Equal(t, sampling.SamplingStrategyType_PROBABILISTIC, resp.StrategyType)

	mockAgent.AddSamplingStrategy("service123", &sampling.SamplingStrategyResponse{
		StrategyType: sampling.SamplingStrategyType_RATE_LIMITING,
		RateLimitingSampling: &sampling.RateLimitingSamplingStrategy{
			MaxTracesPerSecond: 123,
		},
	})
	err = utils.GetJSON("http://"+mockAgent.SamplingServerAddr()+"/?service=service123", &resp)
	require.NoError(t, err)
	assert.Equal(t, sampling.SamplingStrategyType_RATE_LIMITING, resp.StrategyType)
	require.NotNil(t, resp.RateLimitingSampling)
	assert.EqualValues(t, 123, resp.RateLimitingSampling.MaxTracesPerSecond)
}
