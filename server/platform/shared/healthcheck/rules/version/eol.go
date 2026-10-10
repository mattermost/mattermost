// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"math"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(versionEOL, versionEOLUnverified, versionESRNearEOL, behindMajor, behindMinor)
}

const (
	releasesDocsURL = "https://docs.mattermost.com/product-overview/mattermost-server-releases.html"
	nearEOLWithin   = 90 * 24 * time.Hour
)

var versionEOL = healthcheck.Rule{
	Code:     "VERSION_EOL",
	Area:     model.AreaVersion,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.version_eol.title"),
		RemediationID: healthcheck.TranslationId("health.rule.version_eol.remediation"),
		DocsURL:       releasesDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalVersionEOL(model.ReleaseLifecycles()),
}

var versionEOLUnverified = healthcheck.Rule{
	Code:     "VERSION_EOL_UNVERIFIED",
	Area:     model.AreaVersion,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.version_eol_unverified.title"),
		RemediationID: healthcheck.TranslationId("health.rule.version_eol_unverified.remediation"),
		DocsURL:       releasesDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalVersionEOLUnverified(model.ReleaseLifecycles()),
}

var versionESRNearEOL = healthcheck.Rule{
	Code:     "VERSION_ESR_NEAR_EOL",
	Area:     model.AreaVersion,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.version_esr_near_eol.title"),
		RemediationID: healthcheck.TranslationId("health.rule.version_esr_near_eol.remediation"),
		DocsURL:       releasesDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalVersionESRNearEOL(model.ReleaseLifecycles()),
}

// endedResult describes a past-EOL line, naming the ESR to move to when the table knows one.
func endedResult(table []model.ReleaseLifecycle, s *healthcheck.Snapshot, a assessment, subject, messageID, targetMessageID string) healthcheck.Result {
	result := healthcheck.FiringSubject(subject, messageID).WithDetail("version", s.Version.Current)
	if !a.belowFloor {
		result = result.WithDetail("esr", a.esr.MajorMinor).WithDetail("eol_date", a.esr.EOLDate.Format(time.DateOnly))
	}
	if next, ok := target(table, a.version, s.CollectedAt); ok {
		result.MessageID = targetMessageID
		result = result.WithDetail("target", next)
	}
	return result
}

// A BuildDate on or after the EOL date proves the table was maintained after support ended
// without extending it; an older build cannot know about an extension.
func evalVersionEOL(table []model.ReleaseLifecycle) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		a, subject, reasonID := assess(table, s)
		switch {
		case reasonID != "":
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonID)}
		case a.belowFloor:
			return []healthcheck.Result{endedResult(table, s, a, subject,
				healthcheck.TranslationId("health.rule.version_eol.message.below_floor"),
				healthcheck.TranslationId("health.rule.version_eol.message.below_floor_target"))}
		case a.pastEOL && !s.Version.BuildDate.Before(a.esr.EOLDate):
			return []healthcheck.Result{endedResult(table, s, a, subject,
				healthcheck.TranslationId("health.rule.version_eol.message"),
				healthcheck.TranslationId("health.rule.version_eol.message.target"))}
		default:
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}
	}
}

func evalVersionEOLUnverified(table []model.ReleaseLifecycle) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		a, subject, reasonID := assess(table, s)
		switch {
		case reasonID != "":
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonID)}
		case a.pastEOL && s.Version.BuildDate.Before(a.esr.EOLDate):
			return []healthcheck.Result{endedResult(table, s, a, subject,
				healthcheck.TranslationId("health.rule.version_eol_unverified.message"),
				healthcheck.TranslationId("health.rule.version_eol_unverified.message.target"))}
		default:
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}
	}
}

func evalVersionESRNearEOL(table []model.ReleaseLifecycle) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		a, subject, reasonID := assess(table, s)
		if reasonID != "" {
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonID)}
		}

		remaining := a.running.EOLDate.Sub(s.CollectedAt)
		if !a.running.ESR || remaining <= 0 || remaining > nearEOLWithin {
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}

		return []healthcheck.Result{healthcheck.FiringSubject(subject, healthcheck.TranslationId("health.rule.version_esr_near_eol.message")).
			WithDetail("version", s.Version.Current).
			WithDetail("esr", a.running.MajorMinor).
			WithDetail("eol_date", a.running.EOLDate.Format(time.DateOnly)).
			WithValue(math.Floor(remaining.Hours() / 24))}
	}
}
