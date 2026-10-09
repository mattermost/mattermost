// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

var behindMajor = healthcheck.Rule{
	Code:     "VERSION_BEHIND_MAJOR",
	Area:     model.AreaVersion,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.version_behind_major.title"),
		RemediationID: healthcheck.TranslationId("health.rule.version_behind_major.remediation"),
		DocsURL:       releasesDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityFeed,
	Eval:       evalBehind(model.ReleaseLifecycles(), healthcheck.TranslationId("health.rule.version_behind_major.message"), isBehindMajor),
}

var behindMinor = healthcheck.Rule{
	Code:     "VERSION_BEHIND_MINOR",
	Area:     model.AreaVersion,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.version_behind_minor.title"),
		RemediationID: healthcheck.TranslationId("health.rule.version_behind_minor.remediation"),
		DocsURL:       releasesDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityFeed,
	Eval:       evalBehind(model.ReleaseLifecycles(), healthcheck.TranslationId("health.rule.version_behind_minor.message"), isBehindMinor),
}

func isBehindMajor(running, latest line) bool {
	return latest.major > running.major
}

// One minor behind stays silent: N-1 is a supported place to be.
func isBehindMinor(running, latest line) bool {
	return latest.major == running.major && latest.minor-running.minor >= 2
}

// evalBehind applies only to regular releases that are still supported, before reading the
// feed: ESR customers are not expected to track the latest release, and an ended line gets an
// EOL finding instead.
func evalBehind(table []model.ReleaseLifecycle, messageID string, behind func(running, latest line) bool) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		a, subject, reasonID := assess(table, s)
		switch {
		case reasonID != "":
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonID)}
		case a.running.ESR || a.ended():
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}

		latest, ok := parseLine(s.Version.Latest)
		switch {
		case !ok:
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonLatestUnknown)}
		case behind(a.version, latest):
			return []healthcheck.Result{healthcheck.FiringSubject(subject, messageID).
				WithDetail("version", s.Version.Current).
				WithDetail("latest", s.Version.Latest)}
		default:
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}
	}
}
