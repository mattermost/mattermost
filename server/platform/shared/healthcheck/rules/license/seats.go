// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	seatsSubject    = "license.users"
	nearCapacityPct = 90
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

func activeUsers(stats *model.SupportPacketStats) *int64 { return stats.ActiveUsers }

// seatsUsed mirrors GetServerLimits: single-channel guests are free unless on Entry or with guest accounts disabled.
func seatsUsed(s *healthcheck.Snapshot) (used int64, reasonID string) {
	active, ok := s.Stat(activeUsers)
	if !ok {
		return 0, healthcheck.ReasonStatsUnavailable
	}
	if license, licensed := s.License(); licensed && license.SkuShortName == model.LicenseShortSkuMattermostEntry {
		return active, ""
	}

	guestsEnabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.GuestAccountsSettings.Enable })
	if !ok {
		return 0, healthcheck.ReasonConfigUnavailable
	}
	if !guestsEnabled {
		return active, ""
	}

	guests, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.SingleChannelGuests })
	if !ok {
		return 0, healthcheck.ReasonStatsUnavailable
	}

	return max(active-guests, 0), ""
}

// An unknown input yields a reasonID rather than 0%, which would read as a real ratio.
func seatUtilization(s *healthcheck.Snapshot) (used int64, seats int, pct float64, reasonID string) {
	seats, ok := s.LicenseSeats()
	if !ok {
		return 0, 0, 0, healthcheck.ReasonLicenseUnavailable
	}

	used, reasonID = seatsUsed(s)
	if reasonID != "" {
		return 0, 0, 0, reasonID
	}

	return used, seats, 100 * float64(used) / float64(seats), ""
}

func evalSeatUtilization(s *healthcheck.Snapshot, messageID string, fires func(pct float64) bool) []healthcheck.Result {
	used, seats, pct, reasonID := seatUtilization(s)
	switch {
	case reasonID != "":
		return []healthcheck.Result{healthcheck.Unknown(reasonID)}
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

func evalSeatsLimitReached(s *healthcheck.Snapshot) []healthcheck.Result {
	// Packets predating the seat enforcement flag also lack an expiry, so false there means unrecorded.
	license, ok := s.License()
	if !ok || license.ExpiresAt == 0 {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonLicenseUnavailable)}
	}
	if !license.IsSeatCountEnforced {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	used, seats, _, reasonID := seatUtilization(s)
	if reasonID != "" {
		return []healthcheck.Result{healthcheck.Unknown(reasonID)}
	}

	limit := int64(seats + model.SafeDereference(license.ExtraUsers))
	if used < limit {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(used))}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.seats_limit_reached.message")).
		WithDetail("used", strconv.FormatInt(used, 10)).
		WithDetail("limit", strconv.FormatInt(limit, 10)).
		WithValue(float64(used))}
}

func formatPct(pct float64) string {
	return strconv.FormatFloat(pct, 'f', 1, 64)
}
