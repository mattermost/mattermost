// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license

import (
	"math"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(licenseExpired, licenseExpiring,
		seatsOverDeployed, seatsLimitReached, seatsNearCapacity)
}

const (
	licenseConsolePath = "/admin_console/about/license"
	expiresAtSubject   = "license.expires_at"
	expiringWithin     = 30 * 24 * time.Hour
)

var licenseExpired = healthcheck.Rule{
	Code:     "LICENSE_EXPIRED",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.license_expired.title"),
		RemediationID: healthcheck.TranslationId("health.rule.license_expired.remediation"),
		ConsolePath:   licenseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    expiresAtSubject,
	Eval:       evalLicenseExpired,
}

var licenseExpiring = healthcheck.Rule{
	Code:     "LICENSE_EXPIRING",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.license_expiring.title"),
		RemediationID: healthcheck.TranslationId("health.rule.license_expiring.remediation"),
		ConsolePath:   licenseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    expiresAtSubject,
	Eval:       evalLicenseExpiring,
}

// Measured from CollectedAt, not now, so a packet read later reports what was true then.
func timeToExpiry(s *healthcheck.Snapshot) (expiresAt time.Time, remaining time.Duration, reasonID string) {
	expiresAt, ok := s.LicenseExpiresAt()
	if !ok {
		return time.Time{}, 0, healthcheck.ReasonLicenseUnavailable
	}
	if s.CollectedAt.IsZero() {
		return time.Time{}, 0, healthcheck.ReasonCollectedAtUnknown
	}

	return expiresAt, expiresAt.Sub(s.CollectedAt), ""
}

func firingExpiry(messageID string, expiresAt time.Time, remaining time.Duration) healthcheck.Result {
	return healthcheck.Firing(messageID).
		WithDetail("expires_at", expiresAt.Format(time.DateOnly)).
		WithValue(math.Floor(remaining.Hours() / 24))
}

func evalLicenseExpired(s *healthcheck.Snapshot) []healthcheck.Result {
	expiresAt, remaining, reasonID := timeToExpiry(s)
	license, _ := s.License()
	switch {
	// The server never expires an Entry license, see doLicenseExpirationCheck.
	case license.IsMattermostEntry():
		return []healthcheck.Result{healthcheck.Resolved()}
	case reasonID != "":
		return []healthcheck.Result{healthcheck.Unknown(reasonID)}
	case remaining < 0:
		messageID := healthcheck.TranslationId("health.rule.license_expired.message")
		if license.IsTrial {
			messageID = healthcheck.TranslationId("health.rule.license_expired.message.trial")
		}
		return []healthcheck.Result{firingExpiry(messageID, expiresAt, remaining)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalLicenseExpiring(s *healthcheck.Snapshot) []healthcheck.Result {
	expiresAt, remaining, reasonID := timeToExpiry(s)
	license, _ := s.License()
	switch {
	// The server never expires an Entry license, see doLicenseExpirationCheck.
	case license.IsMattermostEntry():
		return []healthcheck.Result{healthcheck.Resolved()}
	case reasonID != "":
		return []healthcheck.Result{healthcheck.Unknown(reasonID)}
	case remaining >= 0 && remaining < expiringWithin:
		messageID := healthcheck.TranslationId("health.rule.license_expiring.message")
		if license.IsTrial {
			messageID = healthcheck.TranslationId("health.rule.license_expiring.message.trial")
		}
		return []healthcheck.Result{firingExpiry(messageID, expiresAt, remaining)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
