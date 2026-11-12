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
			name:     "test proxy with the hosted service licensed",
			snapshot: withLicenseFeatures(pushSnapshot(true, "https://push-test.mattermost.com"), &model.Features{MHPNS: new(true)}),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  resolved,
				"PUSH_BAD_SCHEME": resolved,
				"PUSH_TEST_PROXY": {state: healthcheck.StateFiring, messageID: "health.rule.push_test_proxy.message.hosted", url: "https://push-test.mattermost.com"},
			},
		},
		{
			name:     "test proxy without the hosted service licensed",
			snapshot: withLicenseFeatures(pushSnapshot(true, "https://push-test.mattermost.com"), &model.Features{MHPNS: new(false)}),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  resolved,
				"PUSH_BAD_SCHEME": resolved,
				"PUSH_TEST_PROXY": {state: healthcheck.StateFiring, messageID: "health.rule.push_test_proxy.message", url: "https://push-test.mattermost.com"},
			},
		},
		{
			name:     "https test proxy with port and path",
			snapshot: pushSnapshot(true, "HTTPS://Push-Test.mattermost.com:443/"),
			want: map[string]pushWant{
				"PUSH_EMPTY_URL":  resolved,
				"PUSH_BAD_SCHEME": resolved,
				"PUSH_TEST_PROXY": {state: healthcheck.StateFiring, messageID: "health.rule.push_test_proxy.message", url: "HTTPS://Push-Test.mattermost.com:443/"},
			},
		},
		{
			name:     "test proxy host only in query",
			snapshot: pushSnapshot(true, "https://push.example.com/?ref=push-test.mattermost.com"),
			want:     map[string]pushWant{"PUSH_EMPTY_URL": resolved, "PUSH_BAD_SCHEME": resolved, "PUSH_TEST_PROXY": resolved},
		},
		{
			name:     "lookalike test proxy host",
			snapshot: pushSnapshot(true, "https://push-test.mattermost.com.example.com"),
			want:     map[string]pushWant{"PUSH_EMPTY_URL": resolved, "PUSH_BAD_SCHEME": resolved, "PUSH_TEST_PROXY": resolved},
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
	require.Equal(t, healthcheck.StateFiring, pushEmptyURL.Eval(blank)[0].State)
	require.Equal(t, healthcheck.StateResolved, pushBadScheme.Eval(blank)[0].State)

	httpURL := pushSnapshot(true, "http://push.example.com")
	require.Equal(t, healthcheck.StateResolved, pushEmptyURL.Eval(httpURL)[0].State)
	require.Equal(t, healthcheck.StateFiring, pushBadScheme.Eval(httpURL)[0].State)

	require.Equal(t, pushEmptyURL.Subject, pushBadScheme.Subject)
	assert.NotEqual(t,
		healthcheck.Fingerprint(pushEmptyURL.Code, pushEmptyURL.Subject, ""),
		healthcheck.Fingerprint(pushBadScheme.Code, pushBadScheme.Subject, ""),
	)
}

func pushProxySnapshot(enabled bool, server string, nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
	config := pushSnapshot(enabled, server)
	snapshot := healthcheck.NewSnapshot(nodes)
	snapshot.Config = config.Config
	snapshot.Sections = config.Sections
	return snapshot
}

func pushProxyNode(hostname, status, probeErr string, sectionErr error) *healthcheck.NodeSnapshot {
	diag := &model.SupportPacketDiagnostics{}
	diag.Notifications.Push.Status = status
	diag.Notifications.Push.Error = probeErr

	var sectionErrors model.SectionErrors
	if sectionErr != nil {
		sectionErrors = model.SectionErrors{model.SectionPushProbe: sectionErr}
	}
	return &healthcheck.NodeSnapshot{
		Hostname: hostname,
		Diagnostics: &model.NodeDiagnostics{
			Diagnostics: diag,
			Errors:      sectionErrors,
		},
	}
}

func TestPushProxyUnreachable(t *testing.T) {
	t.Parallel()

	messageID := healthcheck.TranslationId("health.rule.push_proxy_unreachable.message")
	partialID := healthcheck.TranslationId("health.rule.push_proxy_unreachable.message.partial")
	failed := pushProxyNode("app-1", model.StatusFail, "dial tcp: connection refused", nil)

	configFailed := pushProxySnapshot(true, "https://push.example.com")
	configFailed.Sections[model.SectionConfig] = errors.New("config unavailable")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     healthcheck.Result
	}{
		{
			name:     "config unavailable",
			snapshot: &healthcheck.Snapshot{},
			want:     healthcheck.Unknown(healthcheck.ReasonConfigUnavailable),
		},
		{
			name:     "config section failed",
			snapshot: configFailed,
			want:     healthcheck.Unknown(healthcheck.ReasonConfigUnavailable),
		},
		{
			name:     "push disabled",
			snapshot: pushProxySnapshot(false, "https://push.example.com", failed),
			want:     healthcheck.Resolved(),
		},
		{
			name:     "empty URL is handled by config rule",
			snapshot: pushProxySnapshot(true, "", failed),
			want:     healthcheck.Resolved(),
		},
		{
			name:     "HTTP URL is handled by config rule",
			snapshot: pushProxySnapshot(true, "http://push.example.com", failed),
			want:     healthcheck.Resolved(),
		},
		{
			name:     "missing scheme is handled by config rule",
			snapshot: pushProxySnapshot(true, "push.example.com", failed),
			want:     healthcheck.Resolved(),
		},
		{
			name: "malformed HTTPS URL reports the failed probe",
			snapshot: pushProxySnapshot(true, "https://[::1",
				pushProxyNode("app-1", model.StatusFail, `parse "https://[::1": missing ']' in host`, nil)),
			want: healthcheck.Firing(messageID).
				WithDetail("nodes", "app-1").
				WithDetail("error", `parse "https://[::1": missing ']' in host`),
		},
		{
			name: "HTTPS URL without a host reports the failed probe",
			snapshot: pushProxySnapshot(true, "https:///push",
				pushProxyNode("app-1", model.StatusFail, `Get "https:///push/version": http: no Host in request URL`, nil)),
			want: healthcheck.Firing(messageID).
				WithDetail("nodes", "app-1").
				WithDetail("error", `Get "https:///push/version": http: no Host in request URL`),
		},
		{
			name:     "no node reported the probe",
			snapshot: pushProxySnapshot(true, "https://push.example.com"),
			want:     healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable),
		},
		{
			name: "probe section failed",
			snapshot: pushProxySnapshot(true, "https://push.example.com",
				pushProxyNode("app-1", model.StatusFail, "connection refused", errors.New("probe timed out"))),
			want: healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable),
		},
		{
			name: "empty probe status",
			snapshot: pushProxySnapshot(true, "https://push.example.com",
				pushProxyNode("app-1", "", "", nil)),
			want: healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable),
		},
		{
			name: "disabled probe status",
			snapshot: pushProxySnapshot(true, "https://push.example.com",
				pushProxyNode("app-1", model.StatusDisabled, "", nil)),
			want: healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable),
		},
		{
			name: "probe passed",
			snapshot: pushProxySnapshot(true, "HTTPS://push.example.com",
				pushProxyNode("app-1", model.StatusOk, "", nil)),
			want: healthcheck.Resolved(),
		},
		{
			name:     "probe failed",
			snapshot: pushProxySnapshot(true, "https://push.example.com", failed),
			want: healthcheck.Firing(messageID).
				WithDetail("nodes", "app-1").
				WithDetail("error", "dial tcp: connection refused"),
		},
		{
			name: "all nodes failed",
			snapshot: pushProxySnapshot(true, "https://push.example.com",
				pushProxyNode("app-2", model.StatusFail, "connection refused", nil),
				pushProxyNode("app-1", model.StatusFail, "connection refused", nil)),
			want: healthcheck.Firing(messageID).
				WithDetail("nodes", "app-1, app-2").
				WithDetail("error", "connection refused"),
		},
		{
			name: "one node failed",
			snapshot: pushProxySnapshot(true, "https://push.example.com",
				pushProxyNode("app-1", model.StatusOk, "", nil),
				pushProxyNode("app-2", model.StatusFail, "i/o timeout", nil),
				pushProxyNode("app-3", model.StatusOk, "", nil)),
			want: healthcheck.Firing(partialID).
				WithDetail("nodes", "app-2").
				WithDetail("error", "i/o timeout"),
		},
		{
			name: "URL credentials are masked in the error",
			snapshot: pushProxySnapshot(true, "https://user:secret@push.example.com",
				pushProxyNode("app-1", model.StatusFail, `Get "https://user:secret@push.example.com/version": connection refused`, nil)),
			want: healthcheck.Firing(messageID).
				WithDetail("nodes", "app-1").
				WithDetail("error", `Get "https://****@push.example.com/version": connection refused`),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			results := pushProxyUnreachable.Eval(tc.snapshot)
			require.Len(t, results, 1)
			assert.Equal(t, tc.want, results[0])
		})
	}
}
