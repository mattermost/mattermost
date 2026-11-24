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

func configSnapshot(set func(cfg *model.Config)) *healthcheck.Snapshot {
	cfg := &model.Config{}
	set(cfg)

	return &healthcheck.Snapshot{
		Config:   &model.SupportPacketConfig{Config: cfg},
		Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
	}
}

type messagingWant struct {
	state     healthcheck.State
	messageID string
	value     *float64
	details   map[string]string
}

func assertResult(t *testing.T, rule healthcheck.Rule, snapshot *healthcheck.Snapshot, want messagingWant) {
	t.Helper()

	results := rule.Eval(snapshot)
	require.Len(t, results, 1, rule.Code)
	assert.Equal(t, want.state, results[0].State, rule.Code)
	assert.Equal(t, want.messageID, results[0].MessageID, rule.Code)
	assert.Equal(t, want.value, results[0].Value, rule.Code)
	assert.Equal(t, want.details, results[0].Details, rule.Code)
}

var (
	resolvedWant      = messagingWant{state: healthcheck.StateResolved}
	configUnknownWant = messagingWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
)

func withLicenseFeatures(s *healthcheck.Snapshot, features *model.Features) *healthcheck.Snapshot {
	diag := &model.SupportPacketDiagnostics{License: model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise, Features: features}}
	licensed := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{{
		Hostname:    "app-1",
		IsLeader:    true,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: diag},
	}})
	licensed.Config, licensed.Sections = s.Config, s.Sections
	return licensed
}

func TestPushIDOnly(t *testing.T) {
	t.Parallel()

	fullContents := configSnapshot(func(cfg *model.Config) {
		cfg.EmailSettings.SendPushNotifications = new(true)
		cfg.EmailSettings.PushNotificationContents = new(model.FullNotification)
	})
	snapshot := func(enabled bool, contents string) *healthcheck.Snapshot {
		return withLicenseFeatures(configSnapshot(func(cfg *model.Config) {
			cfg.EmailSettings.SendPushNotifications = new(enabled)
			cfg.EmailSettings.PushNotificationContents = new(contents)
		}), &model.Features{IDLoadedPushNotifications: new(true)})
	}
	licenseUnknown := messagingWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonLicenseUnavailable}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     messagingWant
	}{
		{name: "config section absent", snapshot: &healthcheck.Snapshot{}, want: configUnknownWant},
		{
			name: "contents unset",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.EmailSettings.SendPushNotifications = new(true)
			}),
			want: configUnknownWant,
		},
		{name: "push disabled with full contents", snapshot: snapshot(false, model.FullNotification), want: resolvedWant},
		{
			name:     "full",
			snapshot: snapshot(true, model.FullNotification),
			want:     messagingWant{state: healthcheck.StateFiring, messageID: "health.rule.push_id_only.message"},
		},
		{name: "generic", snapshot: snapshot(true, model.GenericNotification), want: resolvedWant},
		{name: "generic no channel", snapshot: snapshot(true, model.GenericNoChannelNotification), want: resolvedWant},
		{name: "id loaded", snapshot: snapshot(true, model.IdLoadedNotification), want: resolvedWant},
		{name: "full without license", snapshot: fullContents, want: licenseUnknown},
		{name: "full with features not in packet", snapshot: withLicenseFeatures(fullContents, nil), want: licenseUnknown},
		{
			name:     "full without id_loaded feature",
			snapshot: withLicenseFeatures(fullContents, &model.Features{IDLoadedPushNotifications: new(false)}),
			want:     resolvedWant,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, pushIDOnly, tc.snapshot, tc.want)
		})
	}
}

func TestPushIDOnlyAndPushServerCodesFireTogether(t *testing.T) {
	t.Parallel()

	snapshot := withLicenseFeatures(configSnapshot(func(cfg *model.Config) {
		cfg.EmailSettings.SendPushNotifications = new(true)
		cfg.EmailSettings.PushNotificationServer = new("https://push-test.mattermost.com")
		cfg.EmailSettings.PushNotificationContents = new(model.FullNotification)
	}), &model.Features{IDLoadedPushNotifications: new(true)})

	assert.Equal(t, healthcheck.StateFiring, pushIDOnly.Eval(snapshot)[0].State)
	assert.Equal(t, healthcheck.StateFiring, pushTestProxy.Eval(snapshot)[0].State)
	assert.NotEqual(t, pushIDOnly.Subject, pushTestProxy.Subject)
}

func TestMaxNotificationsPerChannel(t *testing.T) {
	t.Parallel()

	snapshot := func(limit int64) *healthcheck.Snapshot {
		return configSnapshot(func(cfg *model.Config) {
			cfg.TeamSettings.MaxNotificationsPerChannel = new(limit)
		})
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     messagingWant
	}{
		{name: "config section absent", snapshot: &healthcheck.Snapshot{}, want: configUnknownWant},
		{name: "setting unset", snapshot: configSnapshot(func(*model.Config) {}), want: configUnknownWant},
		{
			name:     "default",
			snapshot: snapshot(1000),
			want:     messagingWant{state: healthcheck.StateResolved, value: new(float64(1000))},
		},
		{
			name:     "at the limit",
			snapshot: snapshot(5000),
			want:     messagingWant{state: healthcheck.StateResolved, value: new(float64(5000))},
		},
		{
			name:     "above the limit",
			snapshot: snapshot(5001),
			want: messagingWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.max_notifications_per_channel.message",
				value:     new(float64(5001)),
				details:   map[string]string{"limit": "5001"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, maxNotificationsPerChannel, tc.snapshot, tc.want)
		})
	}
}

// smtpSnapshot has SendEmailNotifications set to enabled, the other email features off, the given SMTP
// server and port, and the given nodes.
func smtpSnapshot(enabled bool, server, port *string, nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
	s := healthcheck.NewSnapshot(nodes)
	cfg := configSnapshot(func(cfg *model.Config) {
		cfg.EmailSettings.SendEmailNotifications = new(enabled)
		cfg.EmailSettings.RequireEmailVerification = new(false)
		cfg.ServiceSettings.EnableEmailInvitations = new(false)
		cfg.EmailSettings.EnableSignInWithEmail = new(false)
		cfg.EmailSettings.EnableSignInWithUsername = new(false)
		cfg.EmailSettings.SMTPServer = server
		cfg.EmailSettings.SMTPPort = port
	})
	s.Config, s.Sections = cfg.Config, cfg.Sections
	return s
}

func nodeWithEmail(hostname, status, smtpErr string) *healthcheck.NodeSnapshot {
	diag := &model.SupportPacketDiagnostics{}
	diag.Notifications.Email.Status = status
	diag.Notifications.Email.Error = smtpErr
	return &healthcheck.NodeSnapshot{
		Hostname:    hostname,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: diag},
	}
}

func leaderWithEmail(status, smtpErr string) *healthcheck.NodeSnapshot {
	leader := nodeWithEmail("app-1", status, smtpErr)
	leader.IsLeader = true
	return leader
}

func TestSMTPNotConfigured(t *testing.T) {
	t.Parallel()

	messageID := "health.rule.smtp_not_configured.message"
	refusedErr := "dial tcp [::1]:10025: connect: connection refused"
	firing := messagingWant{state: healthcheck.StateFiring, messageID: messageID}
	probeFailedWant := messagingWant{
		state:     healthcheck.StateFiring,
		messageID: messageID,
		details:   map[string]string{"nodes": "app-1", "error": refusedErr},
	}
	partialWant := messagingWant{
		state:     healthcheck.StateFiring,
		messageID: "health.rule.smtp_not_configured.message.partial",
		details:   map[string]string{"nodes": "app-1", "error": refusedErr},
	}
	notCollected := messagingWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
	defaultServer := func(enabled bool, nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
		return smtpSnapshot(enabled, new(model.EmailSMTPDefaultServer), new(model.EmailSMTPDefaultPort), nodes...)
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     messagingWant
	}{
		{name: "config section absent", snapshot: &healthcheck.Snapshot{}, want: configUnknownWant},
		{name: "default server refuses the probe", snapshot: defaultServer(true, leaderWithEmail(model.StatusFail, refusedErr)), want: probeFailedWant},
		{
			name: "default server refuses on every node",
			snapshot: defaultServer(true,
				leaderWithEmail(model.StatusFail, refusedErr),
				nodeWithEmail("app-2", model.StatusFail, refusedErr)),
			want: messagingWant{
				state:     healthcheck.StateFiring,
				messageID: messageID,
				details:   map[string]string{"nodes": "app-1, app-2", "error": refusedErr},
			},
		},
		{name: "default server answers the probe", snapshot: defaultServer(true, leaderWithEmail(model.StatusOk, "")), want: resolvedWant},
		{name: "default server not probed", snapshot: defaultServer(true), want: notCollected},
		{
			name: "default server refuses on one node only",
			snapshot: defaultServer(true,
				leaderWithEmail(model.StatusFail, refusedErr),
				nodeWithEmail("app-2", model.StatusOk, "")),
			want: partialWant,
		},
		{name: "empty server", snapshot: smtpSnapshot(true, new(""), new("10025")), want: firing},
		{name: "server unset", snapshot: smtpSnapshot(true, nil, new("10025")), want: configUnknownWant},
		{
			name:     "localhost relay on port 25",
			snapshot: smtpSnapshot(true, new("localhost"), new("25"), leaderWithEmail(model.StatusFail, "dial tcp: connection refused")),
			want:     resolvedWant,
		},
		{
			name:     "ignores a failed probe of a configured server",
			snapshot: smtpSnapshot(true, new("smtp.example.com"), new("587"), leaderWithEmail(model.StatusFail, "dial tcp: connection refused")),
			want:     resolvedWant,
		},
		{name: "email features off", snapshot: defaultServer(false, leaderWithEmail(model.StatusFail, refusedErr)), want: resolvedWant},
		{
			name: "only username sign-in uses email",
			snapshot: func() *healthcheck.Snapshot {
				s := defaultServer(false, leaderWithEmail(model.StatusFail, refusedErr))
				s.Config.Config.EmailSettings.EnableSignInWithUsername = new(true)
				return s
			}(),
			want: probeFailedWant,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, smtpNotConfigured, tc.snapshot, tc.want)
		})
	}
}

func TestSMTPNotConfiguredAndUnreachableNeverFireTogether(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name                       string
		server, port               string
		probe                      *healthcheck.NodeSnapshot
		notConfigured, unreachable healthcheck.State
	}{
		{
			name:   "default server refuses the probe",
			server: "localhost", port: "10025",
			probe:         leaderWithEmail(model.StatusFail, "dial tcp [::1]:10025: connect: connection refused"),
			notConfigured: healthcheck.StateFiring, unreachable: healthcheck.StateResolved,
		},
		{
			name:   "empty server fails the probe",
			server: "", port: "10025",
			probe:         leaderWithEmail(model.StatusFail, "dial tcp: missing address"),
			notConfigured: healthcheck.StateFiring, unreachable: healthcheck.StateResolved,
		},
		{
			name:   "default server answered by a development mail server",
			server: "localhost", port: "10025",
			probe:         leaderWithEmail(model.StatusOk, ""),
			notConfigured: healthcheck.StateResolved, unreachable: healthcheck.StateResolved,
		},
		{
			name:   "configured server that fails",
			server: "smtp.example.com", port: "587",
			probe:         leaderWithEmail(model.StatusFail, "dial tcp: connection refused"),
			notConfigured: healthcheck.StateResolved, unreachable: healthcheck.StateFiring,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			snapshot := smtpSnapshot(true, new(tc.server), new(tc.port), tc.probe)
			assert.Equal(t, tc.notConfigured, smtpNotConfigured.Eval(snapshot)[0].State, smtpNotConfigured.Code)
			assert.Equal(t, tc.unreachable, smtpUnreachable.Eval(snapshot)[0].State, smtpUnreachable.Code)
		})
	}
}

func TestSMTPUnreachable(t *testing.T) {
	t.Parallel()

	withNodes := func(enabled bool, nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
		return smtpSnapshot(enabled, new("smtp.example.com"), new("587"), nodes...)
	}

	notCollected := messagingWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
	probeFailed := leaderWithEmail(model.StatusFail, "dial tcp: connection refused")
	probeErrored := leaderWithEmail(model.StatusOk, "")
	probeErrored.Diagnostics.Errors = model.SectionErrors{model.SectionSMTPProbe: errors.New("probe timed out")}
	follower := nodeWithEmail("app-2", model.StatusOk, "")
	probeFailedWant := messagingWant{
		state:     healthcheck.StateFiring,
		messageID: "health.rule.smtp_unreachable.message",
		details:   map[string]string{"nodes": "app-1", "error": "dial tcp: connection refused"},
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     messagingWant
	}{
		{name: "config section absent", snapshot: healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{probeFailed}), want: configUnknownWant},
		{name: "email disabled with failed probe", snapshot: withNodes(false, probeFailed), want: resolvedWant},
		{name: "email disabled without leader", snapshot: withNodes(false), want: resolvedWant},
		{
			name: "invitations enabled with notification emails off",
			snapshot: func() *healthcheck.Snapshot {
				s := withNodes(false, probeFailed)
				s.Config.Config.ServiceSettings.EnableEmailInvitations = new(true)
				return s
			}(),
			want: probeFailedWant,
		},
		{
			name: "email verification required with notification emails off",
			snapshot: func() *healthcheck.Snapshot {
				s := withNodes(false, probeFailed)
				s.Config.Config.EmailSettings.RequireEmailVerification = new(true)
				return s
			}(),
			want: probeFailedWant,
		},
		{
			name: "email sign-in enabled with notification emails off",
			snapshot: func() *healthcheck.Snapshot {
				s := withNodes(false, probeFailed)
				s.Config.Config.EmailSettings.EnableSignInWithEmail = new(true)
				return s
			}(),
			want: probeFailedWant,
		},
		{
			name: "username sign-in enabled with notification emails off",
			snapshot: func() *healthcheck.Snapshot {
				s := withNodes(false, probeFailed)
				s.Config.Config.EmailSettings.EnableSignInWithUsername = new(true)
				return s
			}(),
			want: probeFailedWant,
		},
		{
			name: "notification emails off and other settings unset",
			snapshot: func() *healthcheck.Snapshot {
				s := withNodes(false, probeFailed)
				s.Config.Config.ServiceSettings.EnableEmailInvitations = nil
				return s
			}(),
			want: configUnknownWant,
		},
		{name: "SMTP server unset", snapshot: smtpSnapshot(true, nil, new("587"), probeFailed), want: configUnknownWant},
		{name: "fail", snapshot: withNodes(true, probeFailed), want: probeFailedWant},
		{name: "ok", snapshot: withNodes(true, leaderWithEmail(model.StatusOk, "")), want: resolvedWant},
		{name: "disabled", snapshot: withNodes(true, leaderWithEmail(model.StatusDisabled, "")), want: resolvedWant},
		{name: "empty status", snapshot: withNodes(true, leaderWithEmail("", "")), want: notCollected},
		{name: "no nodes", snapshot: withNodes(true), want: notCollected},
		{name: "only a follower", snapshot: withNodes(true, follower), want: resolvedWant},
		{
			name: "every node fails",
			snapshot: withNodes(true,
				probeFailed,
				nodeWithEmail("app-2", model.StatusFail, "dial tcp: connection refused"),
				nodeWithEmail("app-3", model.StatusFail, "dial tcp: connection refused")),
			want: messagingWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.smtp_unreachable.message",
				details:   map[string]string{"nodes": "app-1, app-2, app-3", "error": "dial tcp: connection refused"},
			},
		},
		{
			name: "one node of three fails",
			snapshot: withNodes(true,
				leaderWithEmail(model.StatusOk, ""),
				nodeWithEmail("app-2", model.StatusFail, "dial tcp: i/o timeout"),
				nodeWithEmail("app-3", model.StatusOk, "")),
			want: messagingWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.smtp_unreachable.message.partial",
				details:   map[string]string{"nodes": "app-2", "error": "dial tcp: i/o timeout"},
			},
		},
		{
			name: "nodes without the probe are left out",
			snapshot: withNodes(true,
				probeFailed,
				&healthcheck.NodeSnapshot{Hostname: "app-2", CollectErr: healthcheck.ErrNodeNoReply},
				func() *healthcheck.NodeSnapshot {
					n := nodeWithEmail("app-3", model.StatusOk, "")
					n.Diagnostics.Errors = model.SectionErrors{model.SectionSMTPProbe: errors.New("probe timed out")}
					return n
				}()),
			want: probeFailedWant,
		},
		{
			name:     "leader without diagnostics",
			snapshot: withNodes(true, &healthcheck.NodeSnapshot{Hostname: "app-1", IsLeader: true}),
			want:     notCollected,
		},
		{name: "probe section errored", snapshot: withNodes(true, probeErrored), want: notCollected},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, smtpUnreachable, tc.snapshot, tc.want)
		})
	}
}
