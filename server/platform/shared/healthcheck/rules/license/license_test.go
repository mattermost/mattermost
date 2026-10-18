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
	diag := &model.SupportPacketDiagnostics{License: model.SupportPacketLicense{
		Users:        500,
		SkuShortName: model.LicenseShortSkuEnterprise,
		ExpiresAt:    collectedAt.Add(365 * day).UnixMilli(),
	}}
	s := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{{
		Hostname:    "app-1",
		IsLeader:    true,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: diag},
	}})
	s.CollectedAt = collectedAt
	s.Stats = &model.SupportPacketStats{
		ActiveUsers:         new(int64(300)),
		SingleChannelGuests: new(int64(0)),
	}
	s.Config = &model.SupportPacketConfig{Config: &model.Config{
		GuestAccountsSettings: model.GuestAccountsSettings{Enable: new(true)},
	}}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil, model.SectionStats: nil}
	return s
}

// licenseOf returns the leader's license summary, which tests edit in place.
func licenseOf(s *healthcheck.Snapshot) *model.SupportPacketLicense {
	license, _ := s.License()
	return license
}

func removeLicense(s *healthcheck.Snapshot) {
	leader, _ := s.Leader()
	leader.Diagnostics = nil
}

type want struct {
	state  healthcheck.State
	value  *float64
	reason string
}

var resolved = want{state: healthcheck.StateResolved}

func firing(value float64) want     { return want{state: healthcheck.StateFiring, value: &value} }
func resolvedAt(value float64) want { return want{state: healthcheck.StateResolved, value: &value} }
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
		"LICENSE_EXPIRED", "LICENSE_EXPIRING",
		"SEATS_OVER_DEPLOYED", "SEATS_LIMIT_REACHED", "SEATS_NEAR_CAPACITY",
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
		licenseOf(s).ExpiresAt = collectedAt.Add(d).UnixMilli()
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
				licenseOf(s).ExpiresAt = now.Add(-20 * day).UnixMilli()
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
				licenseOf(s).ExpiresAt = 0
				return s
			},
			want: map[string]want{"LICENSE_EXPIRED": unknown(healthcheck.ReasonLicenseUnavailable), "LICENSE_EXPIRING": unknown(healthcheck.ReasonLicenseUnavailable)},
		},
		{
			name: "no license",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				removeLicense(s)
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

		entry := expiringIn(-3 * day)
		licenseOf(entry).SkuShortName = model.LicenseShortSkuMattermostEntry
		entryExpired := evalLicenseExpired(entry)[0]
		assert.Equal(t, "health.rule.license_expired.message.entry", entryExpired.MessageID)
		assert.Equal(t, "2026-09-22", entryExpired.Details["expires_at"])

		expiring := evalLicenseExpiring(expiringIn(20 * day))[0]
		assert.Equal(t, "health.rule.license_expiring.message", expiring.MessageID)
		assert.Equal(t, "2026-10-15", expiring.Details["expires_at"])
	})

	t.Run("trial licenses get their own message", func(t *testing.T) {
		t.Parallel()

		trial := func(d time.Duration) *healthcheck.Snapshot {
			s := expiringIn(d)
			licenseOf(s).IsTrial = true
			return s
		}

		expired := evalLicenseExpired(trial(-3 * day))[0]
		assert.Equal(t, "health.rule.license_expired.message.trial", expired.MessageID)
		assert.Equal(t, "2026-09-22", expired.Details["expires_at"])

		expiring := evalLicenseExpiring(trial(20 * day))[0]
		assert.Equal(t, "health.rule.license_expiring.message.trial", expiring.MessageID)
		assert.Equal(t, "2026-10-15", expiring.Details["expires_at"])
	})
}
