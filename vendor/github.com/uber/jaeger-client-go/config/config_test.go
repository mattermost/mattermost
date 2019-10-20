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

package config

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uber/jaeger-lib/metrics"
	"github.com/uber/jaeger-lib/metrics/metricstest"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/transport"
)

func TestNewSamplerConst(t *testing.T) {
	constTests := []struct {
		param    float64
		decision bool
	}{{1, true}, {0, false}}
	for _, tst := range constTests {
		cfg := &SamplerConfig{Type: jaeger.SamplerTypeConst, Param: tst.param}
		s, err := cfg.NewSampler("x", nil)
		require.NoError(t, err)
		s1, ok := s.(*jaeger.ConstSampler)
		require.True(t, ok, "converted to constSampler")
		require.Equal(t, tst.decision, s1.Decision, "decision")
	}
}

func TestNewSamplerProbabilistic(t *testing.T) {
	constTests := []struct {
		param float64
		error bool
	}{{1.5, true}, {0.5, false}}
	for _, tst := range constTests {
		cfg := &SamplerConfig{Type: jaeger.SamplerTypeProbabilistic, Param: tst.param}
		s, err := cfg.NewSampler("x", nil)
		if tst.error {
			require.Error(t, err)
		} else {
			require.NoError(t, err)
			_, ok := s.(*jaeger.ProbabilisticSampler)
			require.True(t, ok, "converted to ProbabilisticSampler")
		}
	}
}

func TestDefaultSampler(t *testing.T) {
	cfg := Configuration{
		Sampler: &SamplerConfig{Type: "InvalidType"},
	}
	_, _, err := cfg.New("testService")
	require.Error(t, err)
}

func TestServiceNameFromEnv(t *testing.T) {
	os.Setenv(envServiceName, "my-service")

	cfg, err := FromEnv()
	assert.NoError(t, err)

	_, c, err := cfg.New("")
	defer c.Close()
	assert.NoError(t, err)
	os.Unsetenv(envServiceName)
}

func TestFromEnv(t *testing.T) {
	os.Setenv(envServiceName, "my-service")
	os.Setenv(envDisabled, "false")
	os.Setenv(envRPCMetrics, "true")
	os.Setenv(envTags, "KEY=VALUE")

	cfg, err := FromEnv()
	assert.NoError(t, err)
	assert.Equal(t, "my-service", cfg.ServiceName)
	assert.Equal(t, false, cfg.Disabled)
	assert.Equal(t, true, cfg.RPCMetrics)
	assert.Equal(t, "KEY", cfg.Tags[0].Key)
	assert.Equal(t, "VALUE", cfg.Tags[0].Value)

	os.Unsetenv(envServiceName)
	os.Unsetenv(envDisabled)
	os.Unsetenv(envRPCMetrics)
}

func TestNoServiceNameFromEnv(t *testing.T) {
	os.Unsetenv(envServiceName)

	cfg, err := FromEnv()
	assert.NoError(t, err)

	_, _, err = cfg.New("")
	assert.Error(t, err)

	// However, if Disabled, then empty service name is irrelevant (issue #350)
	cfg.Disabled = true
	tr, _, err := cfg.New("")
	assert.NoError(t, err)
	assert.Equal(t, &opentracing.NoopTracer{}, tr)
}

func TestSamplerConfigFromEnv(t *testing.T) {
	// prepare
	os.Setenv(envSamplerType, "const")
	os.Setenv(envSamplerParam, "1")
	os.Setenv(envSamplerManagerHostPort, "http://themaster")
	os.Setenv(envSamplerMaxOperations, "10")
	os.Setenv(envSamplerRefreshInterval, "1m1s") // 61 seconds

	// test
	cfg, err := FromEnv()
	assert.NoError(t, err)

	// verify
	assert.Equal(t, "const", cfg.Sampler.Type)
	assert.Equal(t, float64(1), cfg.Sampler.Param)
	assert.Equal(t, "http://themaster", cfg.Sampler.SamplingServerURL)
	assert.Equal(t, int(10), cfg.Sampler.MaxOperations)
	assert.Equal(t, 61000000000, int(cfg.Sampler.SamplingRefreshInterval))

	// cleanup
	os.Unsetenv(envSamplerType)
	os.Unsetenv(envSamplerParam)
	os.Unsetenv(envSamplerManagerHostPort)
	os.Unsetenv(envSamplerMaxOperations)
	os.Unsetenv(envSamplerRefreshInterval)
}

func TestSamplerConfigOnAgentFromEnv(t *testing.T) {
	// prepare
	os.Setenv(envAgentHost, "theagent")

	// test
	cfg, err := FromEnv()
	assert.NoError(t, err)

	// verify
	assert.Equal(t, "http://theagent:5778/sampling", cfg.Sampler.SamplingServerURL)

	// cleanup
	os.Unsetenv(envAgentHost)
}

func TestReporterConfigFromEnv(t *testing.T) {
	// prepare
	os.Setenv(envReporterMaxQueueSize, "10")
	os.Setenv(envReporterFlushInterval, "1m1s") // 61 seconds
	os.Setenv(envReporterLogSpans, "true")
	os.Setenv(envAgentHost, "nonlocalhost")
	os.Setenv(envAgentPort, "6832")

	// test
	cfg, err := FromEnv()
	assert.NoError(t, err)

	// verify
	assert.Equal(t, int(10), cfg.Reporter.QueueSize)
	assert.Equal(t, 61000000000, int(cfg.Reporter.BufferFlushInterval))
	assert.Equal(t, true, cfg.Reporter.LogSpans)
	assert.Equal(t, "nonlocalhost:6832", cfg.Reporter.LocalAgentHostPort)

	// Test HTTP transport
	os.Setenv(envEndpoint, "http://1.2.3.4:5678/api/traces")
	os.Setenv(envUser, "user")
	os.Setenv(envPassword, "password")

	// test
	cfg, err = FromEnv()
	assert.NoError(t, err)

	// verify
	assert.Equal(t, "http://1.2.3.4:5678/api/traces", cfg.Reporter.CollectorEndpoint)
	assert.Equal(t, "user", cfg.Reporter.User)
	assert.Equal(t, "password", cfg.Reporter.Password)
	assert.Equal(t, "", cfg.Reporter.LocalAgentHostPort)

	// cleanup
	os.Unsetenv(envReporterMaxQueueSize)
	os.Unsetenv(envReporterFlushInterval)
	os.Unsetenv(envReporterLogSpans)
	os.Unsetenv(envEndpoint)
	os.Unsetenv(envUser)
	os.Unsetenv(envPassword)
}

func TestParsingErrorsFromEnv(t *testing.T) {
	os.Setenv(envAgentHost, "localhost") // we require this in order to test the parsing of the port

	tests := []struct {
		envVar string
		value  string
	}{
		{
			envVar: envRPCMetrics,
			value:  "NOT_A_BOOLEAN",
		},
		{
			envVar: envDisabled,
			value:  "NOT_A_BOOLEAN",
		},
		{
			envVar: envSamplerParam,
			value:  "NOT_A_FLOAT",
		},
		{
			envVar: envSamplerMaxOperations,
			value:  "NOT_AN_INT",
		},
		{
			envVar: envSamplerRefreshInterval,
			value:  "NOT_A_DURATION",
		},
		{
			envVar: envReporterMaxQueueSize,
			value:  "NOT_AN_INT",
		},
		{
			envVar: envReporterFlushInterval,
			value:  "NOT_A_DURATION",
		},
		{
			envVar: envReporterLogSpans,
			value:  "NOT_A_BOOLEAN",
		},
		{
			envVar: envAgentPort,
			value:  "NOT_AN_INT",
		},
		{
			envVar: envEndpoint,
			value:  "NOT_A_URL",
		},
	}

	for _, test := range tests {
		os.Setenv(test.envVar, test.value)
		if test.envVar == envEndpoint {
			os.Unsetenv(envAgentHost)
			os.Unsetenv(envAgentPort)
		}
		_, err := FromEnv()
		require.Error(t, err)
		assert.Contains(t, err.Error(), fmt.Sprintf("cannot parse env var %s=%s", test.envVar, test.value))
		os.Unsetenv(test.envVar)
	}

}

func TestParsingUserPasswordErrorEnv(t *testing.T) {
	tests := []struct {
		envVar string
		value  string
	}{
		{
			envVar: envUser,
			value:  "user",
		},
		{
			envVar: envPassword,
			value:  "password",
		},
	}
	os.Setenv(envEndpoint, "http://localhost:8080")
	for _, test := range tests {
		os.Setenv(test.envVar, test.value)
		_, err := FromEnv()
		require.Error(t, err)
		assert.Contains(t, err.Error(), fmt.Sprintf("you must set %s and %s env vars together", envUser,
			envPassword))
		os.Unsetenv(test.envVar)
	}
	os.Unsetenv(envEndpoint)
}

func TestInvalidSamplerType(t *testing.T) {
	cfg := &SamplerConfig{MaxOperations: 10}
	s, err := cfg.NewSampler("x", jaeger.NewNullMetrics())
	require.NoError(t, err)
	rcs, ok := s.(*jaeger.RemotelyControlledSampler)
	require.True(t, ok, "converted to RemotelyControlledSampler")
	rcs.Close()
}

func TestUDPTransportType(t *testing.T) {
	rc := &ReporterConfig{LocalAgentHostPort: "localhost:1234"}
	expect, _ := jaeger.NewUDPTransport(rc.LocalAgentHostPort, 0)
	sender, err := rc.newTransport()
	require.NoError(t, err)
	require.IsType(t, expect, sender)
}

func TestHTTPTransportType(t *testing.T) {
	rc := &ReporterConfig{CollectorEndpoint: "http://1.2.3.4:5678/api/traces"}
	expect := transport.NewHTTPTransport(rc.CollectorEndpoint)
	sender, err := rc.newTransport()
	require.NoError(t, err)
	require.IsType(t, expect, sender)
}

func TestDefaultConfig(t *testing.T) {
	cfg := Configuration{}
	_, _, err := cfg.New("", Metrics(metrics.NullFactory), Logger(log.NullLogger))
	require.EqualError(t, err, "no service name provided")

	_, closer, err := cfg.New("testService")
	defer closer.Close()
	require.NoError(t, err)
}

func TestDisabledFlag(t *testing.T) {
	cfg := Configuration{Disabled: true}
	_, closer, err := cfg.New("testService")
	defer closer.Close()
	require.NoError(t, err)
}

func TestNewReporterError(t *testing.T) {
	cfg := Configuration{
		Reporter: &ReporterConfig{LocalAgentHostPort: "bad_local_agent"},
	}
	_, _, err := cfg.New("testService")
	require.Error(t, err)
}

func TestInitGlobalTracer(t *testing.T) {
	// Save the existing GlobalTracer and replace after finishing function
	prevTracer := opentracing.GlobalTracer()
	defer opentracing.SetGlobalTracer(prevTracer)
	noopTracer := opentracing.NoopTracer{}

	tests := []struct {
		cfg           Configuration
		shouldErr     bool
		tracerChanged bool
	}{
		{
			cfg:           Configuration{Disabled: true},
			shouldErr:     false,
			tracerChanged: false,
		},
		{
			cfg:           Configuration{Sampler: &SamplerConfig{Type: "InvalidType"}},
			shouldErr:     true,
			tracerChanged: false,
		},
		{
			cfg: Configuration{
				Sampler: &SamplerConfig{
					Type:                    "remote",
					SamplingRefreshInterval: 1,
				},
			},
			shouldErr:     false,
			tracerChanged: true,
		},
		{
			cfg:           Configuration{},
			shouldErr:     false,
			tracerChanged: true,
		},
	}
	for _, test := range tests {
		opentracing.SetGlobalTracer(noopTracer)
		_, err := test.cfg.InitGlobalTracer("testService")
		if test.shouldErr {
			require.Error(t, err)
		} else {
			require.NoError(t, err)
		}
		if test.tracerChanged {
			require.NotEqual(t, noopTracer, opentracing.GlobalTracer())
		} else {
			require.Equal(t, noopTracer, opentracing.GlobalTracer())
		}
	}
}

func TestConfigWithReporter(t *testing.T) {
	c := Configuration{
		Sampler: &SamplerConfig{
			Type:  "const",
			Param: 1,
		},
	}
	r := jaeger.NewInMemoryReporter()
	tracer, closer, err := c.New("test", Reporter(r))
	require.NoError(t, err)
	defer closer.Close()

	tracer.StartSpan("test").Finish()
	assert.Len(t, r.GetSpans(), 1)
}

func TestConfigWithRPCMetrics(t *testing.T) {
	metrics := metricstest.NewFactory(0)
	c := Configuration{
		Sampler: &SamplerConfig{
			Type:  "const",
			Param: 1,
		},
		RPCMetrics: true,
	}
	r := jaeger.NewInMemoryReporter()
	tracer, closer, err := c.New(
		"test",
		Reporter(r),
		Metrics(metrics),
		ContribObserver(fakeContribObserver{}),
	)
	require.NoError(t, err)
	defer closer.Close()

	tracer.StartSpan("test", ext.SpanKindRPCServer).Finish()

	metrics.AssertCounterMetrics(t,
		metricstest.ExpectedMetric{
			Name:  "jaeger-rpc.requests",
			Tags:  map[string]string{"component": "jaeger", "endpoint": "test", "error": "false"},
			Value: 1,
		},
	)
}

func TestBaggageRestrictionsConfig(t *testing.T) {
	m := metricstest.NewFactory(0)
	c := Configuration{
		BaggageRestrictions: &BaggageRestrictionsConfig{
			HostPort:        "not:1929213",
			RefreshInterval: time.Minute,
		},
	}
	_, closer, err := c.New(
		"test",
		Metrics(m),
	)
	require.NoError(t, err)
	defer closer.Close()

	metricName := "jaeger.tracer.baggage_restrictions_updates"
	metricTags := map[string]string{"result": "err"}
	key := metrics.GetKey(metricName, metricTags, "|", "=")
	for i := 0; i < 100; i++ {
		// wait until the async initialization call is complete
		counters, _ := m.Snapshot()
		if _, ok := counters[key]; ok {
			break
		}
		time.Sleep(time.Millisecond)
	}

	m.AssertCounterMetrics(t,
		metricstest.ExpectedMetric{
			Name:  metricName,
			Tags:  metricTags,
			Value: 1,
		},
	)
}

func TestConfigWithGen128Bit(t *testing.T) {
	c := Configuration{
		Sampler: &SamplerConfig{
			Type:  "const",
			Param: 1,
		},
		RPCMetrics: true,
	}
	tracer, closer, err := c.New("test", Gen128Bit(true))
	require.NoError(t, err)
	defer closer.Close()

	span := tracer.StartSpan("test")
	defer span.Finish()
	traceID := span.Context().(jaeger.SpanContext).TraceID()
	require.True(t, traceID.High != 0)
	require.True(t, traceID.Low != 0)
}

func TestConfigWithInjector(t *testing.T) {
	c := Configuration{}
	tracer, closer, err := c.New("test", Injector("custom.format", fakeInjector{}))
	require.NoError(t, err)
	defer closer.Close()

	span := tracer.StartSpan("test")
	defer span.Finish()

	err = tracer.Inject(span.Context(), "unknown.format", nil)
	require.Error(t, err)

	err = tracer.Inject(span.Context(), "custom.format", nil)
	require.NoError(t, err)
}

func TestConfigWithExtractor(t *testing.T) {
	c := Configuration{}
	tracer, closer, err := c.New("test", Extractor("custom.format", fakeExtractor{}))
	require.NoError(t, err)
	defer closer.Close()

	_, err = tracer.Extract("unknown.format", nil)
	require.Error(t, err)

	_, err = tracer.Extract("custom.format", nil)
	require.NoError(t, err)
}

func TestConfigWithSampler(t *testing.T) {
	c := Configuration{}
	sampler := &fakeSampler{}

	tracer, closer, err := c.New("test", Sampler(sampler))
	require.NoError(t, err)
	defer closer.Close()

	span := tracer.StartSpan("test")
	defer span.Finish()

	traceID := span.Context().(jaeger.SpanContext).TraceID()
	require.Equal(t, traceID, sampler.lastTraceID)
	require.Equal(t, "test", sampler.lastOperation)
}

func TestNewTracer(t *testing.T) {
	cfg := &Configuration{ServiceName: "my-service"}
	_, closer, err := cfg.NewTracer(Metrics(metrics.NullFactory), Logger(log.NullLogger))
	defer closer.Close()

	assert.NoError(t, err)
}

func TestNewTracerWithNoDebugFlagOnForcedSampling(t *testing.T) {
	cfg := &Configuration{ServiceName: "my-service"}
	tracer, closer, err := cfg.NewTracer(Metrics(metrics.NullFactory), Logger(log.NullLogger), NoDebugFlagOnForcedSampling(true))
	defer closer.Close()

	span := tracer.StartSpan("testSpan").(*jaeger.Span)
	ext.SamplingPriority.Set(span, 1)

	assert.NoError(t, err)
	assert.False(t, span.SpanContext().IsDebug())
	assert.True(t, span.SpanContext().IsSampled())
}

func TestNewTracerWithoutServiceName(t *testing.T) {
	cfg := &Configuration{}
	_, _, err := cfg.NewTracer(Metrics(metrics.NullFactory), Logger(log.NullLogger))
	assert.Contains(t, err.Error(), "no service name provided")
}

func TestParseTags(t *testing.T) {
	os.Setenv("existing", "not-default")
	tags := "key=value,k1=${nonExisting:default}, k2=${withSpace:default},k3=${existing:default}"
	ts := parseTags(tags)
	assert.Equal(t, 4, len(ts))

	assert.Equal(t, "key", ts[0].Key)
	assert.Equal(t, "value", ts[0].Value)

	assert.Equal(t, "k1", ts[1].Key)
	assert.Equal(t, "default", ts[1].Value)

	assert.Equal(t, "k2", ts[2].Key)
	assert.Equal(t, "default", ts[2].Value)

	assert.Equal(t, "k3", ts[3].Key)
	assert.Equal(t, "not-default", ts[3].Value)

	os.Unsetenv("existing")
}

func TestServiceNameViaConfiguration(t *testing.T) {
	cfg := &Configuration{ServiceName: "my-service"}
	_, closer, err := cfg.New("")
	assert.NoError(t, err)
	defer closer.Close()
}

func TestTracerTags(t *testing.T) {
	cfg := &Configuration{Tags: []opentracing.Tag{{Key: "test", Value: 123}}}
	_, closer, err := cfg.New("test-service")
	assert.NoError(t, err)
	defer closer.Close()
}

func TestThrottlerDefaultConfig(t *testing.T) {
	cfg := &Configuration{
		Throttler: &ThrottlerConfig{},
	}
	_, closer, err := cfg.New("test-service")
	assert.NoError(t, err)
	defer closer.Close()
}
