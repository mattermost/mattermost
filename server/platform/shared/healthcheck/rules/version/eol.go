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
	healthcheck.Register(versionEOL, versionESRNearEOL, behindOne, behind)
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
	Eval:       evalVersionEOL(model.ReleaseLifecycles(), time.Now),
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
	Eval:       evalVersionESRNearEOL(model.ReleaseLifecycles(), time.Now),
}

func evalVersionEOL(table []model.ReleaseLifecycle, now func() time.Time) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		at := now()
		a, subject, reasonID := assess(table, s, at)
		switch {
		case reasonID != "":
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonID)}
		case !a.ended():
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}

		result := healthcheck.FiringSubject(subject, healthcheck.TranslationId("health.rule.version_eol.message")).
			WithDetail("version", s.Version.Current)
		next, hasTarget := target(table, a.version, at)
		switch {
		case a.belowFloor && hasTarget:
			result.MessageID = healthcheck.TranslationId("health.rule.version_eol.message.below_floor_target")
		case a.belowFloor:
			result.MessageID = healthcheck.TranslationId("health.rule.version_eol.message.below_floor")
		case hasTarget:
			result.MessageID = healthcheck.TranslationId("health.rule.version_eol.message.target")
		}
		if !a.belowFloor {
			result = result.WithDetail("eol_date", a.running.EOLDate.Format(time.DateOnly))
		}
		if hasTarget {
			result = result.WithDetail("target", next)
		}
		return []healthcheck.Result{result}
	}
}

func evalVersionESRNearEOL(table []model.ReleaseLifecycle, now func() time.Time) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		at := now()
		a, subject, reasonID := assess(table, s, at)
		if reasonID != "" {
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonID)}
		}

		remaining := a.running.EOLDate.Sub(at)
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
