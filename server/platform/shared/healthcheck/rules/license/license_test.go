// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

var collectedAt = time.Date(2026, time.September, 25, 10, 0, 0, 0, time.UTC)

const day = 24 * time.Hour

// newSnapshot returns a healthy licensed workspace that no rule in this package fires on.
func newSnapshot() *healthcheck.Snapshot {
	return &healthcheck.Snapshot{
		CollectedAt: collectedAt,
		License: &model.License{
			Features:     &model.Features{Users: new(500)},
			SkuShortName: model.LicenseShortSkuEnterprise,
			ExpiresAt:    collectedAt.Add(365 * day).UnixMilli(),
		},
		Stats: &model.SupportPacketStats{
			ActiveUsers:         new(int64(300)),
			SingleChannelGuests: new(int64(0)),
			MonthlyActiveUsers:  new(int64(250)),
			IncomingWebhooks:    new(int64(20)),
			BotAccounts:         new(int64(10)),
		},
		Config: &model.SupportPacketConfig{Config: &model.Config{
			GuestAccountsSettings: model.GuestAccountsSettings{Enable: new(true)},
		}},
		Plugins: &model.SupportPacketPluginList{
			Enabled: []model.Manifest{{Id: "com.mattermost.calls"}, {Id: "playbooks"}, {Id: "mattermost-ai"}},
		},
		Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil, model.SectionPlugins: nil, model.SectionStats: nil},
	}
}

type want struct {
	state  healthcheck.State
	value  *float64
	reason string
}

var resolved = want{state: healthcheck.StateResolved}

func firing(value float64) want     { return want{state: healthcheck.StateFiring, value: &value} }
func resolvedAt(value float64) want { return want{state: healthcheck.StateResolved, value: &value} }
func firingNoValue() want           { return want{state: healthcheck.StateFiring} }
func unknown(reasonID string) want  { return want{state: healthcheck.StateUnknown, reason: reasonID} }

func assertResults(t *testing.T, rules []healthcheck.Rule, snapshot *healthcheck.Snapshot, wants map[string]want) {
	t.Helper()

	for _, rule := range rules {
		w, ok := wants[rule.Code]
		require.True(t, ok, "no expectation for %s", rule.Code)

		results := rule.Eval(snapshot)
		require.Len(t, results, 1, rule.Code)
		assert.Equal(t, w.state, results[0].State, rule.Code)
		if w.state == healthcheck.StateUnknown {
			assert.Equal(t, w.reason, results[0].MessageID, rule.Code)
		}
		if w.value == nil {
			assert.Nil(t, results[0].Value, rule.Code)
		} else if assert.NotNil(t, results[0].Value, rule.Code) {
			assert.InDelta(t, *w.value, *results[0].Value, 0.001, rule.Code)
		}
	}
}

func TestRulesAreRegistered(t *testing.T) {
	registry := healthcheck.Builtin()
	require.NoError(t, registry.Validate())

	for _, code := range []string{
		"LICENSE_EXPIRED", "LICENSE_EXPIRING", "LICENSE_TRIAL",
		"SEATS_OVER_DEPLOYED", "SEATS_LIMIT_REACHED", "SEATS_NEAR_CAPACITY", "SEATS_LOW_UTILIZATION",
		"SEATS_LOW_ENGAGEMENT", "WORKFLOW_USAGE_CHAT_ONLY", "WORKFLOW_USAGE_LIGHT",
	} {
		rule, ok := registry.Get(code)
		require.True(t, ok, code)
		assert.Equal(t, model.AreaLicense, rule.Area, code)
		assert.Equal(t, healthcheck.SurfaceProduct, rule.Surface, code)
		assert.False(t, rule.IsNodeScoped(), code)
	}
}

func TestExpiryRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{licenseExpired, licenseExpiring}
	expiringIn := func(d time.Duration) *healthcheck.Snapshot {
		s := newSnapshot()
		s.License.ExpiresAt = collectedAt.Add(d).UnixMilli()
		return s
	}

	testCases := []struct {
		name     string
		snapshot func() *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "expires in a year",
			snapshot: newSnapshot,
			want:     map[string]want{"LICENSE_EXPIRED": resolved, "LICENSE_EXPIRING": resolved},
		},
		{
			name:     "expires in exactly 30 days",
			snapshot: func() *healthcheck.Snapshot { return expiringIn(30 * day) },
			want:     map[string]want{"LICENSE_EXPIRED": resolved, "LICENSE_EXPIRING": resolved},
		},
		{
			name:     "expires in just under 30 days",
			snapshot: func() *healthcheck.Snapshot { return expiringIn(30*day - time.Millisecond) },
			want:     map[string]want{"LICENSE_EXPIRED": resolved, "LICENSE_EXPIRING": firing(29)},
		},
		{
			name:     "expires in 20 days",
			snapshot: func() *healthcheck.Snapshot { return expiringIn(20 * day) },
			want:     map[string]want{"LICENSE_EXPIRED": resolved, "LICENSE_EXPIRING": firing(20)},
		},
		{
			name:     "expires at collection",
			snapshot: func() *healthcheck.Snapshot { return expiringIn(0) },
			want:     map[string]want{"LICENSE_EXPIRED": resolved, "LICENSE_EXPIRING": firing(0)},
		},
		{
			name:     "expired a millisecond before collection",
			snapshot: func() *healthcheck.Snapshot { return expiringIn(-time.Millisecond) },
			want:     map[string]want{"LICENSE_EXPIRED": firing(-1), "LICENSE_EXPIRING": resolved},
		},
		{
			name:     "expired 3 days before collection",
			snapshot: func() *healthcheck.Snapshot { return expiringIn(-3 * day) },
			want:     map[string]want{"LICENSE_EXPIRED": firing(-3), "LICENSE_EXPIRING": resolved},
		},
		{
			name: "measured against collection, not now",
			snapshot: func() *healthcheck.Snapshot {
				now := time.Now().Truncate(time.Millisecond)
				s := newSnapshot()
				s.CollectedAt = now.Add(-40 * day)
				s.License.ExpiresAt = now.Add(-20 * day).UnixMilli()
				return s
			},
			want: map[string]want{"LICENSE_EXPIRED": resolved, "LICENSE_EXPIRING": firing(20)},
		},
		{
			name: "zero collection time",
			snapshot: func() *healthcheck.Snapshot {
				s := expiringIn(-3 * day)
				s.CollectedAt = time.Time{}
				return s
			},
			want: map[string]want{"LICENSE_EXPIRED": unknown(healthcheck.ReasonCollectedAtUnknown), "LICENSE_EXPIRING": unknown(healthcheck.ReasonCollectedAtUnknown)},
		},
		{
			name: "expiry not recorded",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.License.ExpiresAt = 0
				return s
			},
			want: map[string]want{"LICENSE_EXPIRED": unknown(healthcheck.ReasonLicenseUnavailable), "LICENSE_EXPIRING": unknown(healthcheck.ReasonLicenseUnavailable)},
		},
		{
			name: "no license",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.License = nil
				return s
			},
			want: map[string]want{"LICENSE_EXPIRED": unknown(healthcheck.ReasonLicenseUnavailable), "LICENSE_EXPIRING": unknown(healthcheck.ReasonLicenseUnavailable)},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, rules, tc.snapshot(), tc.want)
		})
	}

	t.Run("firing results carry the expiry date", func(t *testing.T) {
		t.Parallel()

		expired := evalLicenseExpired(expiringIn(-3 * day))[0]
		assert.Equal(t, "health.rule.license_expired.message", expired.MessageID)
		assert.Equal(t, "2026-09-22", expired.Details["expires_at"])

		expiring := evalLicenseExpiring(expiringIn(20 * day))[0]
		assert.Equal(t, "health.rule.license_expiring.message", expiring.MessageID)
		assert.Equal(t, "2026-10-15", expiring.Details["expires_at"])
	})
}

func TestLicenseTrial(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{licenseTrial}

	t.Run("trial", func(t *testing.T) {
		t.Parallel()
		s := newSnapshot()
		s.License.IsTrial = true
		assertResults(t, rules, s, map[string]want{"LICENSE_TRIAL": firingNoValue()})
		assert.Equal(t, "health.rule.license_trial.message", evalLicenseTrial(s)[0].MessageID)
	})

	t.Run("not a trial", func(t *testing.T) {
		t.Parallel()
		assertResults(t, rules, newSnapshot(), map[string]want{"LICENSE_TRIAL": resolved})
	})

	t.Run("no license", func(t *testing.T) {
		t.Parallel()
		s := newSnapshot()
		s.License = nil
		assertResults(t, rules, s, map[string]want{"LICENSE_TRIAL": unknown(healthcheck.ReasonLicenseUnavailable)})
	})
}

func TestSeatUtilizationRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{seatsOverDeployed, seatsNearCapacity, seatsLowUtilization, seatsLimitReached}
	seated := func(active, guests int64) *healthcheck.Snapshot {
		s := newSnapshot()
		s.Stats.ActiveUsers = new(active)
		s.Stats.SingleChannelGuests = new(guests)
		return s
	}
	all := func(w want) map[string]want {
		return map[string]want{"SEATS_OVER_DEPLOYED": w, "SEATS_NEAR_CAPACITY": w, "SEATS_LOW_UTILIZATION": w, "SEATS_LIMIT_REACHED": resolved}
	}

	testCases := []struct {
		name     string
		snapshot func() *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "healthy",
			snapshot: newSnapshot,
			want:     all(resolvedAt(60)),
		},
		{
			name:     "single-channel guests do not take seats",
			snapshot: func() *healthcheck.Snapshot { return seated(520, 30) },
			want: map[string]want{
				"SEATS_OVER_DEPLOYED":   resolvedAt(98),
				"SEATS_NEAR_CAPACITY":   firing(98),
				"SEATS_LOW_UTILIZATION": resolvedAt(98),
				"SEATS_LIMIT_REACHED":   resolved,
			},
		},
		{
			name: "entry licenses count single-channel guests",
			snapshot: func() *healthcheck.Snapshot {
				s := seated(520, 30)
				s.License.SkuShortName = model.LicenseShortSkuMattermostEntry
				return s
			},
			want: map[string]want{
				"SEATS_OVER_DEPLOYED":   firing(104),
				"SEATS_NEAR_CAPACITY":   resolvedAt(104),
				"SEATS_LOW_UTILIZATION": resolvedAt(104),
				"SEATS_LIMIT_REACHED":   resolved,
			},
		},
		{
			name: "single-channel guests take seats with guest accounts disabled",
			snapshot: func() *healthcheck.Snapshot {
				s := seated(520, 30)
				s.Config.GuestAccountsSettings.Enable = new(false)
				return s
			},
			want: map[string]want{
				"SEATS_OVER_DEPLOYED":   firing(104),
				"SEATS_NEAR_CAPACITY":   resolvedAt(104),
				"SEATS_LOW_UTILIZATION": resolvedAt(104),
				"SEATS_LIMIT_REACHED":   resolved,
			},
		},
		{
			name: "guest accounts setting unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.Config = nil
				return s
			},
			want: all(unknown(healthcheck.ReasonConfigUnavailable)),
		},
		{
			name:     "one seat over",
			snapshot: func() *healthcheck.Snapshot { return seated(501, 0) },
			want: map[string]want{
				"SEATS_OVER_DEPLOYED":   firing(100.2),
				"SEATS_NEAR_CAPACITY":   resolvedAt(100.2),
				"SEATS_LOW_UTILIZATION": resolvedAt(100.2),
				"SEATS_LIMIT_REACHED":   resolved,
			},
		},
		{
			name:     "exactly full",
			snapshot: func() *healthcheck.Snapshot { return seated(500, 0) },
			want: map[string]want{
				"SEATS_OVER_DEPLOYED":   resolvedAt(100),
				"SEATS_NEAR_CAPACITY":   firing(100),
				"SEATS_LOW_UTILIZATION": resolvedAt(100),
				"SEATS_LIMIT_REACHED":   resolved,
			},
		},
		{
			name:     "exactly 90 percent",
			snapshot: func() *healthcheck.Snapshot { return seated(450, 0) },
			want: map[string]want{
				"SEATS_OVER_DEPLOYED":   resolvedAt(90),
				"SEATS_NEAR_CAPACITY":   firing(90),
				"SEATS_LOW_UTILIZATION": resolvedAt(90),
				"SEATS_LIMIT_REACHED":   resolved,
			},
		},
		{
			name:     "just under 90 percent",
			snapshot: func() *healthcheck.Snapshot { return seated(449, 0) },
			want:     all(resolvedAt(89.8)),
		},
		{
			name:     "exactly 30 percent",
			snapshot: func() *healthcheck.Snapshot { return seated(150, 0) },
			want:     all(resolvedAt(30)),
		},
		{
			name:     "just under 30 percent",
			snapshot: func() *healthcheck.Snapshot { return seated(149, 0) },
			want: map[string]want{
				"SEATS_OVER_DEPLOYED":   resolvedAt(29.8),
				"SEATS_NEAR_CAPACITY":   resolvedAt(29.8),
				"SEATS_LOW_UTILIZATION": firing(29.8),
				"SEATS_LIMIT_REACHED":   resolved,
			},
		},
		{
			name: "active users unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.Stats.ActiveUsers = nil
				return s
			},
			want: all(unknown(healthcheck.ReasonStatsUnavailable)),
		},
		{
			name: "single-channel guests unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.Stats.SingleChannelGuests = nil
				return s
			},
			want: all(unknown(healthcheck.ReasonStatsUnavailable)),
		},
		{
			name: "single-channel guests unknown on entry",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.License.SkuShortName = model.LicenseShortSkuMattermostEntry
				s.Stats.SingleChannelGuests = nil
				return s
			},
			want: all(resolvedAt(60)),
		},
		{
			name: "stats not collected",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.Stats = nil
				return s
			},
			want: all(unknown(healthcheck.ReasonStatsUnavailable)),
		},
		{
			name: "seat count unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.License.Features.Users = nil
				return s
			},
			want: all(unknown(healthcheck.ReasonLicenseUnavailable)),
		},
		{
			name: "no license",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.License = nil
				return s
			},
			want: map[string]want{"SEATS_OVER_DEPLOYED": unknown(healthcheck.ReasonLicenseUnavailable), "SEATS_NEAR_CAPACITY": unknown(healthcheck.ReasonLicenseUnavailable), "SEATS_LOW_UTILIZATION": unknown(healthcheck.ReasonLicenseUnavailable), "SEATS_LIMIT_REACHED": unknown(healthcheck.ReasonLicenseUnavailable)},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, rules, tc.snapshot(), tc.want)
		})
	}

	t.Run("firing results carry the counts", func(t *testing.T) {
		t.Parallel()

		result := evalSeatsNearCapacity(seated(520, 30))[0]
		assert.Equal(t, "health.rule.seats_near_capacity.message", result.MessageID)
		assert.Equal(t, map[string]string{"used": "490", "seats": "500", "percent": "98.0"}, result.Details)
	})
}

func TestSeatsLimitReached(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{seatsLimitReached, seatsOverDeployed}
	enforced := func(used int64, extraUsers *int) *healthcheck.Snapshot {
		s := newSnapshot()
		s.License.IsSeatCountEnforced = true
		s.License.ExtraUsers = extraUsers
		s.Stats.ActiveUsers = new(used)
		return s
	}

	testCases := []struct {
		name     string
		snapshot func() *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "at the limit with extra users",
			snapshot: func() *healthcheck.Snapshot { return enforced(505, new(5)) },
			want:     map[string]want{"SEATS_LIMIT_REACHED": firing(505), "SEATS_OVER_DEPLOYED": firing(101)},
		},
		{
			name:     "one under the limit with extra users",
			snapshot: func() *healthcheck.Snapshot { return enforced(504, new(5)) },
			want:     map[string]want{"SEATS_LIMIT_REACHED": resolvedAt(504), "SEATS_OVER_DEPLOYED": firing(100.8)},
		},
		{
			name:     "no extra users",
			snapshot: func() *healthcheck.Snapshot { return enforced(500, nil) },
			want:     map[string]want{"SEATS_LIMIT_REACHED": firing(500), "SEATS_OVER_DEPLOYED": resolvedAt(100)},
		},
		{
			name: "not enforced",
			snapshot: func() *healthcheck.Snapshot {
				s := enforced(600, nil)
				s.License.IsSeatCountEnforced = false
				return s
			},
			want: map[string]want{"SEATS_LIMIT_REACHED": resolved, "SEATS_OVER_DEPLOYED": firing(120)},
		},
		{
			name: "enforcement not recorded",
			snapshot: func() *healthcheck.Snapshot {
				s := enforced(600, nil)
				s.License.ExpiresAt = 0
				return s
			},
			want: map[string]want{"SEATS_LIMIT_REACHED": unknown(healthcheck.ReasonLicenseUnavailable), "SEATS_OVER_DEPLOYED": firing(120)},
		},
		{
			name: "enforced with active users unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := enforced(0, nil)
				s.Stats.ActiveUsers = nil
				return s
			},
			want: map[string]want{"SEATS_LIMIT_REACHED": unknown(healthcheck.ReasonStatsUnavailable), "SEATS_OVER_DEPLOYED": unknown(healthcheck.ReasonStatsUnavailable)},
		},
		{
			name: "enforced with seat count unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := enforced(600, nil)
				s.License.Features.Users = nil
				return s
			},
			want: map[string]want{"SEATS_LIMIT_REACHED": unknown(healthcheck.ReasonLicenseUnavailable), "SEATS_OVER_DEPLOYED": unknown(healthcheck.ReasonLicenseUnavailable)},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, rules, tc.snapshot(), tc.want)
		})
	}

	t.Run("firing results carry the limit", func(t *testing.T) {
		t.Parallel()

		result := evalSeatsLimitReached(enforced(505, new(5)))[0]
		assert.Equal(t, "health.rule.seats_limit_reached.message", result.MessageID)
		assert.Equal(t, map[string]string{"used": "505", "limit": "505"}, result.Details)
	})
}

func TestSeatsLowEngagement(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{seatsLowEngagement}
	engaged := func(active, monthly *int64) *healthcheck.Snapshot {
		s := newSnapshot()
		s.Stats.ActiveUsers = active
		s.Stats.MonthlyActiveUsers = monthly
		return s
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{name: "healthy", snapshot: newSnapshot(), want: resolvedAt(83.333)},
		{name: "exactly 60 percent", snapshot: engaged(new(int64(200)), new(int64(120))), want: resolvedAt(60)},
		{name: "just under 60 percent", snapshot: engaged(new(int64(200)), new(int64(119))), want: firing(59.5)},
		{name: "no monthly activity", snapshot: engaged(new(int64(200)), new(int64(0))), want: firing(0)},
		{name: "active users unknown(healthcheck.ReasonStatsUnavailable)", snapshot: engaged(nil, new(int64(120))), want: unknown(healthcheck.ReasonStatsUnavailable)},
		{name: "monthly active users unknown(healthcheck.ReasonStatsUnavailable)", snapshot: engaged(new(int64(200)), nil), want: unknown(healthcheck.ReasonStatsUnavailable)},
		{name: "no active users", snapshot: engaged(new(int64(0)), new(int64(0))), want: unknown(healthcheck.TranslationId("health.rule.seats_low_engagement.message.no_active_users"))},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, rules, tc.snapshot, map[string]want{"SEATS_LOW_ENGAGEMENT": tc.want})
		})
	}

	t.Run("firing results carry the counts", func(t *testing.T) {
		t.Parallel()

		result := evalSeatsLowEngagement(engaged(new(int64(200)), new(int64(119))))[0]
		assert.Equal(t, "health.rule.seats_low_engagement.message", result.MessageID)
		assert.Equal(t, map[string]string{"monthly_active": "119", "active": "200", "percent": "59.5"}, result.Details)
	})
}

func TestWorkflowRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{workflowChatOnly, workflowLight}
	usage := func(plugins int, webhooks, bots int64) *healthcheck.Snapshot {
		s := newSnapshot()
		s.Plugins.Enabled = s.Plugins.Enabled[:0]
		for range plugins {
			s.Plugins.Enabled = append(s.Plugins.Enabled, model.Manifest{Id: "plugin"})
		}
		s.Stats.IncomingWebhooks = new(webhooks)
		s.Stats.BotAccounts = new(bots)
		return s
	}
	chatOnly := map[string]want{"WORKFLOW_USAGE_CHAT_ONLY": firingNoValue(), "WORKFLOW_USAGE_LIGHT": resolved}
	light := map[string]want{"WORKFLOW_USAGE_CHAT_ONLY": resolved, "WORKFLOW_USAGE_LIGHT": firingNoValue()}
	neither := map[string]want{"WORKFLOW_USAGE_CHAT_ONLY": resolved, "WORKFLOW_USAGE_LIGHT": resolved}
	bothUnknown := func(reasonID string) map[string]want {
		return map[string]want{"WORKFLOW_USAGE_CHAT_ONLY": unknown(reasonID), "WORKFLOW_USAGE_LIGHT": unknown(reasonID)}
	}

	testCases := []struct {
		name     string
		snapshot func() *healthcheck.Snapshot
		want     map[string]want
	}{
		{name: "one plugin, no webhooks, two bots", snapshot: func() *healthcheck.Snapshot { return usage(1, 0, 2) }, want: chatOnly},
		{name: "no plugins", snapshot: func() *healthcheck.Snapshot { return usage(0, 9, 4) }, want: chatOnly},
		{name: "ten webhooks", snapshot: func() *healthcheck.Snapshot { return usage(1, 10, 0) }, want: light},
		{name: "five bots", snapshot: func() *healthcheck.Snapshot { return usage(1, 0, 5) }, want: light},
		{name: "two plugins", snapshot: func() *healthcheck.Snapshot { return usage(2, 0, 0) }, want: light},
		{name: "two plugins, 49 webhooks", snapshot: func() *healthcheck.Snapshot { return usage(2, 49, 100) }, want: light},
		{name: "two plugins, 50 webhooks", snapshot: func() *healthcheck.Snapshot { return usage(2, 50, 0) }, want: neither},
		{name: "three plugins", snapshot: func() *healthcheck.Snapshot { return usage(3, 0, 0) }, want: neither},
		{
			name: "plugins section absent",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				delete(s.Sections, model.SectionPlugins)
				return s
			},
			want: bothUnknown(healthcheck.ReasonPluginsUnavailable),
		},
		{
			name: "plugins section failed",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				s.Sections[model.SectionPlugins] = assert.AnError
				return s
			},
			want: bothUnknown(healthcheck.ReasonPluginsUnavailable),
		},
		{
			name: "incoming webhooks unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := usage(1, 0, 2)
				s.Stats.IncomingWebhooks = nil
				return s
			},
			want: bothUnknown(healthcheck.ReasonStatsUnavailable),
		},
		{
			name: "bot accounts unknown",
			snapshot: func() *healthcheck.Snapshot {
				s := usage(1, 0, 2)
				s.Stats.BotAccounts = nil
				return s
			},
			want: bothUnknown(healthcheck.ReasonStatsUnavailable),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, rules, tc.snapshot(), tc.want)
		})
	}

	t.Run("firing results carry the counts", func(t *testing.T) {
		t.Parallel()

		result := evalWorkflowChatOnly(usage(1, 0, 2))[0]
		assert.Equal(t, "health.rule.workflow_usage_chat_only.message", result.MessageID)
		assert.Equal(t, map[string]string{"plugins": "1", "webhooks": "0", "bots": "2"}, result.Details)
	})
}
