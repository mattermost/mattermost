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

func TestPushIDOnly(t *testing.T) {
	t.Parallel()

	snapshot := func(enabled bool, contents string) *healthcheck.Snapshot {
		return configSnapshot(func(cfg *model.Config) {
			cfg.EmailSettings.SendPushNotifications = new(enabled)
			cfg.EmailSettings.PushNotificationContents = new(contents)
		})
	}

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

	snapshot := configSnapshot(func(cfg *model.Config) {
		cfg.EmailSettings.SendPushNotifications = new(true)
		cfg.EmailSettings.PushNotificationServer = new("https://push-test.mattermost.com")
		cfg.EmailSettings.PushNotificationContents = new(model.FullNotification)
	})

	require.Equal(t, healthcheck.StateFiring, evalPushIDOnly(snapshot)[0].State)
	require.Equal(t, healthcheck.StateFiring, evalPushTestProxy(snapshot)[0].State)
	assert.NotEqual(t, pushIDOnly.Subject, pushTestProxy.Subject)
}

func TestLinkPreviewsDisabled(t *testing.T) {
	t.Parallel()

	snapshot := func(enabled bool) *healthcheck.Snapshot {
		return configSnapshot(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableLinkPreviews = new(enabled)
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
			name:     "disabled",
			snapshot: snapshot(false),
			want:     messagingWant{state: healthcheck.StateFiring, messageID: "health.rule.link_previews_disabled.message"},
		},
		{name: "enabled", snapshot: snapshot(true), want: resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, linkPreviewsDisabled, tc.snapshot, tc.want)
		})
	}
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
			want:     messagingWant{state: healthcheck.StateFiring, messageID: "health.rule.max_notifications_per_channel.message", value: new(float64(5001))},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, maxNotificationsPerChannel, tc.snapshot, tc.want)
		})
	}
}

func TestTypingMessagesAtScale(t *testing.T) {
	t.Parallel()

	snapshot := func(enabled bool, activeUsers *int64) *healthcheck.Snapshot {
		s := configSnapshot(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableUserTypingMessages = new(enabled)
		})
		if activeUsers != nil {
			s.Stats = &model.SupportPacketStats{ActiveUsers: activeUsers}
			s.Sections[model.SectionStats] = nil
		}
		return s
	}

	statsUnknown := messagingWant{state: healthcheck.StateUnknown, messageID: "health.rule.typing_messages_at_scale.message.stats_unavailable"}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     messagingWant
	}{
		{name: "config section absent", snapshot: &healthcheck.Snapshot{}, want: configUnknownWant},
		{name: "setting unset", snapshot: configSnapshot(func(*model.Config) {}), want: configUnknownWant},
		{name: "typing disabled with stats absent", snapshot: snapshot(false, nil), want: resolvedWant},
		{name: "typing disabled at scale", snapshot: snapshot(false, new(int64(20000))), want: resolvedWant},
		{name: "typing enabled with stats absent", snapshot: snapshot(true, nil), want: statsUnknown},
		{
			name: "typing enabled with active users uncollected",
			snapshot: func() *healthcheck.Snapshot {
				s := snapshot(true, nil)
				s.Stats = &model.SupportPacketStats{}
				return s
			}(),
			want: statsUnknown,
		},
		{
			name:     "below the threshold",
			snapshot: snapshot(true, new(int64(4999))),
			want:     messagingWant{state: healthcheck.StateResolved, value: new(float64(4999))},
		},
		{
			name:     "at the threshold",
			snapshot: snapshot(true, new(int64(5000))),
			want:     messagingWant{state: healthcheck.StateFiring, messageID: "health.rule.typing_messages_at_scale.message", value: new(float64(5000))},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, typingMessagesAtScale, tc.snapshot, tc.want)
		})
	}
}

func TestSMTPUnreachable(t *testing.T) {
	t.Parallel()

	withNodes := func(enabled bool, nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
		s := healthcheck.NewSnapshot(nodes)
		s.Config = &model.SupportPacketConfig{Config: &model.Config{}}
		s.Config.Config.EmailSettings.SendEmailNotifications = new(enabled)
		s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
		return s
	}
	leaderWithEmail := func(status, smtpErr string) *healthcheck.NodeSnapshot {
		diag := &model.SupportPacketDiagnostics{}
		diag.Notifications.Email.Status = status
		diag.Notifications.Email.Error = smtpErr
		return &healthcheck.NodeSnapshot{
			Hostname:    "app-1",
			IsLeader:    true,
			Diagnostics: &model.NodeDiagnostics{Diagnostics: diag},
		}
	}

	notCollected := messagingWant{state: healthcheck.StateUnknown, messageID: "health.rule.smtp_unreachable.message.not_collected"}
	probeFailed := leaderWithEmail(model.StatusFail, "dial tcp: connection refused")
	probeErrored := leaderWithEmail(model.StatusOk, "")
	probeErrored.Diagnostics.Errors = model.SectionErrors{model.SectionSMTPProbe: errors.New("probe timed out")}
	follower := leaderWithEmail(model.StatusOk, "")
	follower.IsLeader = false

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     messagingWant
	}{
		{name: "config section absent", snapshot: healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{probeFailed}), want: configUnknownWant},
		{name: "email disabled with failed probe", snapshot: withNodes(false, probeFailed), want: resolvedWant},
		{name: "email disabled without leader", snapshot: withNodes(false), want: resolvedWant},
		{
			name:     "fail",
			snapshot: withNodes(true, probeFailed),
			want: messagingWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.smtp_unreachable.message",
				details:   map[string]string{"error": "dial tcp: connection refused"},
			},
		},
		{name: "ok", snapshot: withNodes(true, leaderWithEmail(model.StatusOk, "")), want: resolvedWant},
		{name: "disabled", snapshot: withNodes(true, leaderWithEmail(model.StatusDisabled, "")), want: resolvedWant},
		{name: "empty status", snapshot: withNodes(true, leaderWithEmail("", "")), want: notCollected},
		{name: "no nodes", snapshot: withNodes(true), want: notCollected},
		{name: "only a follower", snapshot: withNodes(true, follower), want: notCollected},
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
