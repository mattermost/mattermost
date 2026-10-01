// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	seatsSubject          = "license.users"
	engagementConsolePath = "/admin_console/reporting/team_statistics"

	nearCapacityPct   = 90
	lowUtilizationPct = 30
	lowEngagementPct  = 60
)

var seatsOverDeployed = healthcheck.Rule{
	Code:     "SEATS_OVER_DEPLOYED",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.seats_over_deployed.title"),
		RemediationID: healthcheck.TranslationId("health.rule.seats_over_deployed.remediation"),
		ConsolePath:   licenseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    seatsSubject,
	Eval:       evalSeatsOverDeployed,
}

var seatsLimitReached = healthcheck.Rule{
	Code:     "SEATS_LIMIT_REACHED",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.seats_limit_reached.title"),
		RemediationID: healthcheck.TranslationId("health.rule.seats_limit_reached.remediation"),
		ConsolePath:   licenseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    seatsSubject,
	Eval:       evalSeatsLimitReached,
}

var seatsNearCapacity = healthcheck.Rule{
	Code:     "SEATS_NEAR_CAPACITY",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.seats_near_capacity.title"),
		RemediationID: healthcheck.TranslationId("health.rule.seats_near_capacity.remediation"),
		ConsolePath:   licenseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    seatsSubject,
	Eval:       evalSeatsNearCapacity,
}

var seatsLowUtilization = healthcheck.Rule{
	Code:     "SEATS_LOW_UTILIZATION",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.seats_low_utilization.title"),
		RemediationID: healthcheck.TranslationId("health.rule.seats_low_utilization.remediation"),
		ConsolePath:   licenseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    seatsSubject,
	Eval:       evalSeatsLowUtilization,
}

var seatsLowEngagement = healthcheck.Rule{
	Code:     "SEATS_LOW_ENGAGEMENT",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.seats_low_engagement.title"),
		RemediationID: healthcheck.TranslationId("health.rule.seats_low_engagement.remediation"),
		ConsolePath:   engagementConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "stats.monthly_active_users",
	Eval:       evalSeatsLowEngagement,
}

func activeUsers(stats *model.SupportPacketStats) *int64 { return stats.ActiveUsers }

// seatsUsed counts seats the way the server does: active users, less single-channel guests
// on every SKU but Entry. The server also skips the subtraction while guest accounts are
// disabled, but disabling them deactivates every guest, so the count is 0 either way.
func seatsUsed(s *healthcheck.Snapshot) (int64, bool) {
	active, ok := s.Stat(activeUsers)
	if !ok {
		return 0, false
	}
	if s.License.IsMattermostEntry() {
		return active, true
	}

	guests, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.SingleChannelGuests })
	if !ok {
		return 0, false
	}

	return max(active-guests, 0), true
}

// seatUtilization returns 100*used/seats. ok is false when any input is unknown: a ratio
// with an unknown numerator is not 0%.
func seatUtilization(s *healthcheck.Snapshot) (used int64, seats int, pct float64, ok bool) {
	seats, ok = s.LicenseSeats()
	if !ok {
		return 0, 0, 0, false
	}

	used, ok = seatsUsed(s)
	if !ok {
		return 0, 0, 0, false
	}

	return used, seats, 100 * float64(used) / float64(seats), true
}

func evalSeatUtilization(s *healthcheck.Snapshot, messageID string, fires func(pct float64) bool) []healthcheck.Result {
	used, seats, pct, ok := seatUtilization(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown("")}
	case fires(pct):
		return []healthcheck.Result{healthcheck.Firing(messageID).
			WithDetail("used", strconv.FormatInt(used, 10)).
			WithDetail("seats", strconv.Itoa(seats)).
			WithDetail("percent", formatPct(pct)).
			WithValue(pct)}
	default:
		return []healthcheck.Result{healthcheck.Resolved().WithValue(pct)}
	}
}

func evalSeatsOverDeployed(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalSeatUtilization(s, healthcheck.TranslationId("health.rule.seats_over_deployed.message"), func(pct float64) bool {
		return pct > 100
	})
}

func evalSeatsNearCapacity(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalSeatUtilization(s, healthcheck.TranslationId("health.rule.seats_near_capacity.message"), func(pct float64) bool {
		return pct >= nearCapacityPct && pct <= 100
	})
}

func evalSeatsLowUtilization(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalSeatUtilization(s, healthcheck.TranslationId("health.rule.seats_low_utilization.message"), func(pct float64) bool {
		return pct < lowUtilizationPct
	})
}

// evalSeatsLimitReached mirrors the server's hard limit, which applies only to licenses that
// enforce their seat count.
func evalSeatsLimitReached(s *healthcheck.Snapshot) []healthcheck.Result {
	// Every license has an expiry, so a missing one marks a packet written before the seat
	// enforcement flag was recorded, where false would mean "not recorded".
	if _, ok := s.LicenseExpiresAt(); !ok {
		return []healthcheck.Result{healthcheck.Unknown("")}
	}
	if !s.License.IsSeatCountEnforced {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	seats, ok := s.LicenseSeats()
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown("")}
	}
	used, ok := seatsUsed(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown("")}
	}

	limit := int64(seats + model.SafeDereference(s.License.ExtraUsers))
	if used < limit {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(used))}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.seats_limit_reached.message")).
		WithDetail("used", strconv.FormatInt(used, 10)).
		WithDetail("limit", strconv.FormatInt(limit, 10)).
		WithValue(float64(used))}
}

func evalSeatsLowEngagement(s *healthcheck.Snapshot) []healthcheck.Result {
	active, ok := s.Stat(activeUsers)
	if !ok || active == 0 {
		return []healthcheck.Result{healthcheck.Unknown("")}
	}
	monthly, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.MonthlyActiveUsers })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown("")}
	}

	pct := 100 * float64(monthly) / float64(active)
	if pct >= lowEngagementPct {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(pct)}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.seats_low_engagement.message")).
		WithDetail("monthly_active", strconv.FormatInt(monthly, 10)).
		WithDetail("active", strconv.FormatInt(active, 10)).
		WithDetail("percent", formatPct(pct)).
		WithValue(pct)}
}

func formatPct(pct float64) string {
	return strconv.FormatFloat(pct, 'f', 1, 64)
}
