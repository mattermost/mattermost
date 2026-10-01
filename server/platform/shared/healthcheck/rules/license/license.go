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
	healthcheck.Register(licenseExpired, licenseExpiring, licenseTrial,
		seatsOverDeployed, seatsLimitReached, seatsNearCapacity, seatsLowUtilization,
		seatsLowEngagement, workflowChatOnly, workflowLight)
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

var licenseTrial = healthcheck.Rule{
	Code:     "LICENSE_TRIAL",
	Area:     model.AreaLicense,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.license_trial.title"),
		RemediationID: healthcheck.TranslationId("health.rule.license_trial.remediation"),
		ConsolePath:   licenseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "license.is_trial",
	Eval:       evalLicenseTrial,
}

// timeToExpiry is measured from collection, not now, so a packet read later reports what
// was true when it was generated.
func timeToExpiry(s *healthcheck.Snapshot) (expiresAt time.Time, remaining time.Duration, ok bool) {
	expiresAt, ok = s.LicenseExpiresAt()
	if !ok || s.CollectedAt.IsZero() {
		return time.Time{}, 0, false
	}

	return expiresAt, expiresAt.Sub(s.CollectedAt), true
}

func firingExpiry(messageID string, expiresAt time.Time, remaining time.Duration) healthcheck.Result {
	return healthcheck.Firing(messageID).
		WithDetail("expires_at", expiresAt.Format(time.DateOnly)).
		WithValue(math.Floor(remaining.Hours() / 24))
}

func evalLicenseExpired(s *healthcheck.Snapshot) []healthcheck.Result {
	expiresAt, remaining, ok := timeToExpiry(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown("")}
	case remaining < 0:
		return []healthcheck.Result{firingExpiry(healthcheck.TranslationId("health.rule.license_expired.message"), expiresAt, remaining)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalLicenseExpiring(s *healthcheck.Snapshot) []healthcheck.Result {
	expiresAt, remaining, ok := timeToExpiry(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown("")}
	case remaining >= 0 && remaining < expiringWithin:
		return []healthcheck.Result{firingExpiry(healthcheck.TranslationId("health.rule.license_expiring.message"), expiresAt, remaining)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalLicenseTrial(s *healthcheck.Snapshot) []healthcheck.Result {
	switch {
	case s.License == nil:
		return []healthcheck.Result{healthcheck.Unknown("")}
	case s.License.IsTrial:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.license_trial.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
