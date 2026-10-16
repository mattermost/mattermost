// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

var behindOne = healthcheck.Rule{
	Code:     "VERSION_BEHIND_ONE",
	Area:     model.AreaVersion,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.version_behind_one.title"),
		RemediationID: healthcheck.TranslationId("health.rule.version_behind_one.remediation"),
		DocsURL:       releasesDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityFeed,
	Eval:       evalBehind(model.ReleaseLifecycles(), healthcheck.TranslationId("health.rule.version_behind_one.message"), isOneBehind),
}

var behind = healthcheck.Rule{
	Code:     "VERSION_BEHIND",
	Area:     model.AreaVersion,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.version_behind.title"),
		RemediationID: healthcheck.TranslationId("health.rule.version_behind.remediation"),
		DocsURL:       releasesDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityFeed,
	Eval:       evalBehind(model.ReleaseLifecycles(), healthcheck.TranslationId("health.rule.version_behind.message"), isSeveralBehind),
}

func isOneBehind(n int) bool { return n == 1 }

func isSeveralBehind(n int) bool { return n >= 2 }

// releasesBehind counts the releases after running up to and including latest. Major and minor
// releases count alike. Lines newer than the table are counted from latest's minor, so lines of
// the table's newest major released after this build are missed and the count is a lower bound.
func releasesBehind(table []model.ReleaseLifecycle, running, latest line) int {
	if latest.compare(running) <= 0 {
		return 0
	}

	var n int
	var newest line
	for i, entry := range table {
		l, ok := parseLine(entry.MajorMinor)
		if !ok {
			continue
		}
		if i == 0 {
			newest = l
		}
		if l.compare(running) > 0 && l.compare(latest) <= 0 {
			n++
		}
	}

	switch {
	case latest.compare(newest) <= 0:
	case latest.major == newest.major:
		n += int(latest.minor - newest.minor)
	default:
		n += int(latest.minor) + 1
	}
	return n
}

// evalBehind applies only to regular releases that are still supported, before reading the
// feed: ESR customers are not expected to track the latest release, and an ended line gets an
// EOL finding instead.
func evalBehind(table []model.ReleaseLifecycle, messageID string, fires func(n int) bool) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		a, subject, reasonID := assess(table, s)
		switch {
		case reasonID != "":
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonID)}
		case a.running.ESR || a.ended():
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}

		latest, ok := parseLine(s.Version.Latest)
		if !ok {
			return []healthcheck.Result{healthcheck.UnknownSubject(subject, reasonLatestUnknown)}
		}

		n := releasesBehind(table, a.version, latest)
		if !fires(n) {
			return []healthcheck.Result{healthcheck.ResolvedSubject(subject)}
		}
		return []healthcheck.Result{healthcheck.FiringSubject(subject, messageID).
			WithDetail("version", s.Version.Current).
			WithDetail("latest", s.Version.Latest).
			WithValue(float64(n))}
	}
}
