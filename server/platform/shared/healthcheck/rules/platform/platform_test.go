// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type want struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
	value     *float64
}

var (
	resolved      = want{state: healthcheck.StateResolved}
	configUnknown = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	statsUnknown  = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonStatsUnavailable}
)

func firing(messageID string, details map[string]string) want {
	return want{state: healthcheck.StateFiring, messageID: messageID, details: details}
}

func (w want) withValue(v float64) want {
	w.value = &v
	return w
}

// configSnapshot returns a snapshot over nodes whose config holds the server defaults, changed by mutate.
func configSnapshot(mutate func(*model.Config), nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	if mutate != nil {
		mutate(cfg)
	}

	s := healthcheck.NewSnapshot(nodes)
	s.Config = &model.SupportPacketConfig{Config: cfg}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	return s
}

func withUsers(s *healthcheck.Snapshot, users int64) *healthcheck.Snapshot {
	s.Stats = &model.SupportPacketStats{RegisteredUsers: new(users)}
	s.Sections[model.SectionStats] = nil
	return s
}

func assertResult(t *testing.T, expected want, results []healthcheck.Result, msgAndArgs ...any) {
	t.Helper()

	require.Len(t, results, 1, msgAndArgs...)
	assert.Equal(t, expected.state, results[0].State, msgAndArgs...)
	assert.Equal(t, expected.messageID, results[0].MessageID, msgAndArgs...)
	assert.Equal(t, expected.details, results[0].Details, msgAndArgs...)
	assert.Equal(t, expected.value, results[0].Value, msgAndArgs...)
}

func assertRules(t *testing.T, rules []healthcheck.Rule, s *healthcheck.Snapshot, wants map[string]want) {
	t.Helper()

	for _, rule := range rules {
		expected, ok := wants[rule.Code]
		require.True(t, ok, "no expectation for %s", rule.Code)
		assertResult(t, expected, rule.Eval(s), rule.Code)
	}
}

func TestRegistered(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		rule       healthcheck.Rule
		code       string
		severity   healthcheck.Severity
		surface    healthcheck.Surface
		volatility healthcheck.Volatility
		subject    string
	}{
		{rateLimitOffLarge, "RATELIMIT_OFF_LARGE", healthcheck.SeverityInfo, healthcheck.SurfaceInternal, healthcheck.VolatilityThreshold, "RateLimitSettings.Enable"},
		{rateLimitStoreSmall, "RATELIMIT_STORE_SMALL", healthcheck.SeverityInfo, healthcheck.SurfaceProduct, healthcheck.VolatilityStable, "RateLimitSettings.MemoryStoreSize"},
	}

	registry := healthcheck.Builtin()
	for _, tc := range testCases {
		t.Run(tc.code, func(t *testing.T) {
			t.Parallel()

			registered, ok := registry.Get(tc.code)
			require.True(t, ok)

			for _, rule := range []healthcheck.Rule{tc.rule, registered} {
				assert.Equal(t, tc.code, rule.Code)
				assert.Equal(t, model.AreaPlatform, rule.Area)
				assert.Equal(t, tc.surface, rule.Surface)
				assert.Equal(t, tc.severity, rule.Severity)
				assert.Equal(t, tc.volatility, rule.Volatility)
				assert.Equal(t, tc.subject, rule.Subject)
				assert.False(t, rule.AppliesToCloud)
				assert.NotNil(t, rule.Eval)
				assert.Nil(t, rule.EvalNode)
			}
		})
	}
}
