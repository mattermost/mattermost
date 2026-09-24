// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifications

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func pushSnapshot(enabled bool, url string) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.EmailSettings.SendPushNotifications = new(enabled)
	cfg.EmailSettings.PushNotificationServer = new(url)

	return &healthcheck.Snapshot{
		Config:   &model.SupportPacketConfig{Config: cfg},
		Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
	}
}

type pushWant struct {
	state     healthcheck.State
	messageID string
	url       string
}

func TestPushRules(t *testing.T) {
	t.Parallel()

	resolved := pushWant{state: healthcheck.StateResolved}
	unknown := pushWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	rules := []healthcheck.Rule{pushEmptyURL, pushBadScheme, pushTestProxy}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]pushWant
	}{
		{
			name:     "config section absent",
			snapshot: &healthcheck.Snapshot{},
			want:     map[string]pushWant{"PUSH_EMPTY_URL": unknown, "PUSH_BAD_SCHEME": unknown, "PUSH_TEST_PROXY": unknown},
		},
		{
			name: "config section failed",
			snapshot: &healthcheck.Snapshot{
				Config:   pushSnapshot(true, "").Config,
				Sections: map[model.WorkspaceSection]error{model.SectionConfig: errors.New("boom")},
			},
			want: map[string]pushWant{"PUSH_EMPTY_URL": unknown, "PUSH_BAD_SCHEME": unknown, "PUSH_TEST_PROXY": unknown},
		},
		{
			name:     "push disabled with blank url",
			snapshot: pushSnapshot(false, ""),
			want:     map[string]pushWant{"PUSH_EMPTY_URL": resolved, "PUSH_BAD_SCHEME": resolved, "PUSH_TEST_PROXY": resolved},
		},
		{
			name:     "blank url",
			snapshot: pushSnapshot(true, ""),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  {state: healthcheck.StateFiring, messageID: "health.rule.push_empty_url.message"},
				"PUSH_BAD_SCHEME": resolved,
				"PUSH_TEST_PROXY": resolved,
			},
		},
		{
			name:     "http scheme",
			snapshot: pushSnapshot(true, "http://push.example.com"),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  resolved,
				"PUSH_BAD_SCHEME": {state: healthcheck.StateFiring, messageID: "health.rule.push_bad_scheme.message.http", url: "http://push.example.com"},
				"PUSH_TEST_PROXY": resolved,
			},
		},
		{
			name:     "missing scheme",
			snapshot: pushSnapshot(true, "push.example.com"),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  resolved,
				"PUSH_BAD_SCHEME": {state: healthcheck.StateFiring, messageID: "health.rule.push_bad_scheme.message.missing", url: "push.example.com"},
				"PUSH_TEST_PROXY": resolved,
			},
		},
		{
			name:     "https production proxy",
			snapshot: pushSnapshot(true, "https://push.mattermost.com"),
			want:     map[string]pushWant{"PUSH_EMPTY_URL": resolved, "PUSH_BAD_SCHEME": resolved, "PUSH_TEST_PROXY": resolved},
		},
		{
			name:     "https test proxy",
			snapshot: pushSnapshot(true, "https://push-test.mattermost.com"),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  resolved,
				"PUSH_BAD_SCHEME": resolved,
				"PUSH_TEST_PROXY": {state: healthcheck.StateFiring, messageID: "health.rule.push_test_proxy.message", url: "https://push-test.mattermost.com"},
			},
		},
		{
			name:     "http test proxy reports only the scheme",
			snapshot: pushSnapshot(true, "http://push-test.mattermost.com"),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  resolved,
				"PUSH_BAD_SCHEME": {state: healthcheck.StateFiring, messageID: "health.rule.push_bad_scheme.message.http", url: "http://push-test.mattermost.com"},
				"PUSH_TEST_PROXY": resolved,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			for _, rule := range rules {
				results := rule.Eval(tc.snapshot)
				require.Len(t, results, 1, rule.Code)

				want := tc.want[rule.Code]
				assert.Equal(t, want.state, results[0].State, rule.Code)
				assert.Equal(t, want.messageID, results[0].MessageID, rule.Code)
				assert.Equal(t, want.url, results[0].Details["url"], rule.Code)
			}
		})
	}
}

func TestPushFingerprintsDifferByCode(t *testing.T) {
	t.Parallel()

	blank := pushSnapshot(true, "")
	require.Equal(t, healthcheck.StateFiring, evalPushEmptyURL(blank)[0].State)
	require.Equal(t, healthcheck.StateResolved, evalPushBadScheme(blank)[0].State)

	httpURL := pushSnapshot(true, "http://push.example.com")
	require.Equal(t, healthcheck.StateResolved, evalPushEmptyURL(httpURL)[0].State)
	require.Equal(t, healthcheck.StateFiring, evalPushBadScheme(httpURL)[0].State)

	require.Equal(t, pushEmptyURL.Subject, pushBadScheme.Subject)
	assert.NotEqual(t,
		healthcheck.Fingerprint(pushEmptyURL.Code, pushEmptyURL.Subject, ""),
		healthcheck.Fingerprint(pushBadScheme.Code, pushBadScheme.Subject, ""),
	)
}
