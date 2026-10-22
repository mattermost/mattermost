// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestSeatUtilizationRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{seatsOverDeployed, seatsNearCapacity, seatsLimitReached}
	seated := func(active, guests int64) *healthcheck.Snapshot {
		s := newSnapshot()
		s.Stats.ActiveUsers = new(active)
		s.Stats.SingleChannelGuests = new(guests)
		return s
	}
	all := func(w want) map[string]want {
		return map[string]want{"SEATS_OVER_DEPLOYED": w, "SEATS_NEAR_CAPACITY": w, "SEATS_LIMIT_REACHED": resolved}
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
				"SEATS_OVER_DEPLOYED": resolvedAt(98),
				"SEATS_NEAR_CAPACITY": firing(98),
				"SEATS_LIMIT_REACHED": resolved,
			},
		},
		{
			name: "entry licenses count single-channel guests",
			snapshot: func() *healthcheck.Snapshot {
				s := seated(520, 30)
				licenseOf(s).SkuShortName = model.LicenseShortSkuMattermostEntry
				return s
			},
			want: map[string]want{
				"SEATS_OVER_DEPLOYED": firing(104),
				"SEATS_NEAR_CAPACITY": resolvedAt(104),
				"SEATS_LIMIT_REACHED": resolved,
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
				"SEATS_OVER_DEPLOYED": firing(104),
				"SEATS_NEAR_CAPACITY": resolvedAt(104),
				"SEATS_LIMIT_REACHED": resolved,
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
				"SEATS_OVER_DEPLOYED": firing(100.2),
				"SEATS_NEAR_CAPACITY": resolvedAt(100.2),
				"SEATS_LIMIT_REACHED": resolved,
			},
		},
		{
			name:     "exactly full",
			snapshot: func() *healthcheck.Snapshot { return seated(500, 0) },
			want: map[string]want{
				"SEATS_OVER_DEPLOYED": resolvedAt(100),
				"SEATS_NEAR_CAPACITY": firing(100),
				"SEATS_LIMIT_REACHED": resolved,
			},
		},
		{
			name:     "exactly 90 percent",
			snapshot: func() *healthcheck.Snapshot { return seated(450, 0) },
			want: map[string]want{
				"SEATS_OVER_DEPLOYED": resolvedAt(90),
				"SEATS_NEAR_CAPACITY": firing(90),
				"SEATS_LIMIT_REACHED": resolved,
			},
		},
		{
			name:     "just under 90 percent",
			snapshot: func() *healthcheck.Snapshot { return seated(449, 0) },
			want:     all(resolvedAt(89.8)),
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
				licenseOf(s).SkuShortName = model.LicenseShortSkuMattermostEntry
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
				licenseOf(s).Users = 0
				return s
			},
			want: all(unknown(healthcheck.ReasonLicenseUnavailable)),
		},
		{
			name: "no license",
			snapshot: func() *healthcheck.Snapshot {
				s := newSnapshot()
				removeLicense(s)
				return s
			},
			want: map[string]want{"SEATS_OVER_DEPLOYED": unknown(healthcheck.ReasonLicenseUnavailable), "SEATS_NEAR_CAPACITY": unknown(healthcheck.ReasonLicenseUnavailable), "SEATS_LIMIT_REACHED": unknown(healthcheck.ReasonLicenseUnavailable)},
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

		result := evalSeatsNearCapacity(seated(520, 30))
		assert.Equal(t, "health.rule.seats_near_capacity.message", result.MessageID)
		assert.Equal(t, map[string]string{"used": "490", "seats": "500", "percent": "98.0"}, result.Details)
	})
}

func TestSeatsLimitReached(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{seatsLimitReached, seatsOverDeployed}
	enforced := func(used int64, extraUsers *int) *healthcheck.Snapshot {
		s := newSnapshot()
		licenseOf(s).IsSeatCountEnforced = true
		licenseOf(s).ExtraUsers = extraUsers
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
				licenseOf(s).IsSeatCountEnforced = false
				return s
			},
			want: map[string]want{"SEATS_LIMIT_REACHED": resolved, "SEATS_OVER_DEPLOYED": firing(120)},
		},
		{
			name: "enforcement not recorded",
			snapshot: func() *healthcheck.Snapshot {
				s := enforced(600, nil)
				licenseOf(s).ExpiresAt = 0
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
				licenseOf(s).Users = 0
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

		result := evalSeatsLimitReached(enforced(505, new(5)))
		assert.Equal(t, "health.rule.seats_limit_reached.message", result.MessageID)
		assert.Equal(t, map[string]string{"used": "505", "limit": "505"}, result.Details)
	})
}
