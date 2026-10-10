// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"cmp"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

var (
	reasonVersionUnknown = healthcheck.TranslationId("health.rule.version.unknown.version")
	reasonLineUnknown    = healthcheck.TranslationId("health.rule.version.unknown.line")
	reasonLatestUnknown  = healthcheck.TranslationId("health.rule.version.unknown.latest")
)

// line is a release line, the major.minor of a version.
type line struct {
	major, minor int64
}

// parseLine is stricter than model.SplitVersion, which reads "v11" or "abc" as 0.
func parseLine(version string) (line, bool) {
	parts := strings.SplitN(version, ".", 3)
	if len(parts) < 2 {
		return line{}, false
	}

	major, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return line{}, false
	}
	minor, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return line{}, false
	}

	return line{major: major, minor: minor}, true
}

func (l line) compare(other line) int {
	return cmp.Or(cmp.Compare(l.major, other.major), cmp.Compare(l.minor, other.minor))
}

func (l line) String() string {
	return fmt.Sprintf("%d.%d", l.major, l.minor)
}

// supportingESR finds the entry for version's line and e, the highest ESR at or below it.
// belowFloor is true when the version predates the table; ok is false when it is newer than
// every entry, missing from it, or unparseable.
func supportingESR(table []model.ReleaseLifecycle, version string) (running, e model.ReleaseLifecycle, belowFloor, ok bool) {
	v, ok := parseLine(version)
	if !ok || len(table) == 0 {
		return running, e, false, false
	}

	for i, entry := range table {
		l, parsed := parseLine(entry.MajorMinor)
		if !parsed || l.compare(v) < 0 {
			return running, e, false, false
		}
		if l.compare(v) > 0 {
			continue
		}

		for _, older := range table[i:] {
			if older.ESR {
				return entry, older, false, true
			}
		}
		return running, e, false, false
	}

	return running, e, true, true
}

// target is the newest ESR newer than v that is still supported at the given time.
func target(table []model.ReleaseLifecycle, v line, at time.Time) (string, bool) {
	for _, entry := range table {
		l, ok := parseLine(entry.MajorMinor)
		if ok && entry.ESR && l.compare(v) > 0 && at.Before(entry.EOLDate) {
			return entry.MajorMinor, true
		}
	}

	return "", false
}

// assessment places the running version in the lifecycle table.
type assessment struct {
	version    line
	running    model.ReleaseLifecycle
	esr        model.ReleaseLifecycle
	belowFloor bool
	pastEOL    bool
}

// ended reports whether the running line is past its support, verified or not.
func (a assessment) ended() bool {
	return a.belowFloor || a.pastEOL
}

// assess returns the subject for every result and, when the version cannot be placed, the
// reason to report it as unknown. Dates come from CollectedAt so a packet read later reports
// what was true when it was collected.
func assess(table []model.ReleaseLifecycle, s *healthcheck.Snapshot) (a assessment, subject, reasonID string) {
	v, ok := parseLine(s.Version.Current)
	if !ok {
		return a, "", reasonVersionUnknown
	}

	running, e, belowFloor, ok := supportingESR(table, s.Version.Current)
	switch {
	case !ok:
		return a, v.String(), reasonLineUnknown
	case s.CollectedAt.IsZero():
		return a, v.String(), healthcheck.ReasonCollectedAtUnknown
	}

	return assessment{
		version:    v,
		running:    running,
		esr:        e,
		belowFloor: belowFloor,
		pastEOL:    !belowFloor && !s.CollectedAt.Before(e.EOLDate),
	}, v.String(), ""
}
