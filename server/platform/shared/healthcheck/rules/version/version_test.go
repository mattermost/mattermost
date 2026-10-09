// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const day = 24 * time.Hour

func date(year int, month time.Month, d int) time.Time {
	return time.Date(year, month, d, 0, 0, 0, 0, time.UTC)
}

var (
	collectedAt = date(2026, time.September, 25)

	esr105EOL  = date(2026, time.March, 15)
	esr1011EOL = date(2026, time.December, 15)
	esr118EOL  = date(2027, time.June, 15)
)

// stubTable is fictional, so the tests do not move when release engineering edits the real one.
var stubTable = []model.ReleaseLifecycle{
	{MajorMinor: "12.0"},
	{MajorMinor: "11.11"},
	{MajorMinor: "11.10"},
	{MajorMinor: "11.9"},
	{MajorMinor: "11.8", ESR: true, EOLDate: esr118EOL},
	{MajorMinor: "11.0"},
	{MajorMinor: "10.12"},
	{MajorMinor: "10.11", ESR: true, EOLDate: esr1011EOL},
	{MajorMinor: "10.6"},
	{MajorMinor: "10.5", ESR: true, EOLDate: esr105EOL},
}

var stubRules = map[string]func(*healthcheck.Snapshot) []healthcheck.Result{
	"VERSION_EOL":            evalVersionEOL(stubTable),
	"VERSION_EOL_UNVERIFIED": evalVersionEOLUnverified(stubTable),
	"VERSION_ESR_NEAR_EOL":   evalVersionESRNearEOL(stubTable),
	"VERSION_BEHIND_MAJOR":   evalBehind(stubTable, behindMajorMessage, isBehindMajor),
	"VERSION_BEHIND_MINOR":   evalBehind(stubTable, behindMinorMessage, isBehindMinor),
}

const (
	behindMajorMessage = "health.rule.version_behind_major.message"
	behindMinorMessage = "health.rule.version_behind_minor.message"
)

func newSnapshot(current, latest string, buildDate time.Time) *healthcheck.Snapshot {
	return &healthcheck.Snapshot{
		CollectedAt: collectedAt,
		Version:     healthcheck.VersionInfo{Current: current, Latest: latest, BuildDate: buildDate},
	}
}

type want struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
	value     *float64
}

var resolved = want{state: healthcheck.StateResolved}

func unknown(reasonID string) want { return want{state: healthcheck.StateUnknown, messageID: reasonID} }

func allCodes(w want) map[string]want {
	wants := map[string]want{}
	for code := range stubRules {
		wants[code] = w
	}
	return wants
}

func with(wants map[string]want, code string, w want) map[string]want {
	wants[code] = w
	return wants
}

type ruleCase struct {
	name     string
	snapshot *healthcheck.Snapshot
	subject  string
	want     map[string]want
}

func runCases(t *testing.T, testCases []ruleCase) {
	t.Helper()

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			for code, eval := range stubRules {
				w, ok := tc.want[code]
				require.True(t, ok, "no expectation for %s", code)

				results := eval(tc.snapshot)
				require.Len(t, results, 1, code)
				assert.Equal(t, w.state, results[0].State, code)
				assert.Equal(t, w.messageID, results[0].MessageID, code)
				assert.Equal(t, tc.subject, results[0].Subject, code)
				assert.Equal(t, w.details, results[0].Details, code)
				assert.Equal(t, w.value, results[0].Value, code)
			}
		})
	}
}

func TestRulesAreRegistered(t *testing.T) {
	registry := healthcheck.Builtin()
	require.NoError(t, registry.Validate())

	for _, tc := range []struct {
		code       string
		severity   healthcheck.Severity
		volatility healthcheck.Volatility
	}{
		{"VERSION_EOL", healthcheck.SeverityCritical, healthcheck.VolatilityStable},
		{"VERSION_EOL_UNVERIFIED", healthcheck.SeverityWarning, healthcheck.VolatilityStable},
		{"VERSION_ESR_NEAR_EOL", healthcheck.SeverityWarning, healthcheck.VolatilityStable},
		{"VERSION_BEHIND_MAJOR", healthcheck.SeverityWarning, healthcheck.VolatilityFeed},
		{"VERSION_BEHIND_MINOR", healthcheck.SeverityWarning, healthcheck.VolatilityFeed},
	} {
		rule, ok := registry.Get(tc.code)
		require.True(t, ok, tc.code)
		assert.Equal(t, tc.severity, rule.Severity, tc.code)
		assert.Equal(t, tc.volatility, rule.Volatility, tc.code)
		assert.Equal(t, model.AreaVersion, rule.Area, tc.code)
		assert.Equal(t, healthcheck.SurfaceProduct, rule.Surface, tc.code)
		assert.False(t, rule.AppliesToCloud, tc.code)
		assert.NotNil(t, rule.Eval, tc.code)
		assert.False(t, rule.IsNodeScoped(), tc.code)
	}
}

func TestReleaseBranchGuard(t *testing.T) {
	_, e, belowFloor, ok := supportingESR(model.ReleaseLifecycles(), model.CurrentVersion)
	require.True(t, ok, "no release lifecycle entry for %s", model.CurrentVersion)
	require.False(t, belowFloor)

	assert.True(t, time.Now().Before(e.EOLDate),
		"ESR %s supporting %s ended on %s: extend its EOL date in version_lifecycle.go if support was extended",
		e.MajorMinor, model.CurrentVersion, e.EOLDate.Format(time.DateOnly))
}

func TestSupportingESR(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		version    string
		running    string
		esr        string
		belowFloor bool
		ok         bool
	}{
		{version: "11.8.3", running: "11.8", esr: "11.8", ok: true},
		{version: "12.0.0", running: "12.0", esr: "11.8", ok: true},
		{version: "11.0.1", running: "11.0", esr: "10.11", ok: true},
		{version: "10.5.0", running: "10.5", esr: "10.5", ok: true},
		{version: "10.4.9", belowFloor: true, ok: true},
		{version: "9.11.0", belowFloor: true, ok: true},
		{version: "12.1.0"},
		{version: "11.5.0"},
		{version: "v11.0.1"},
		{version: "11"},
		{version: ""},
	} {
		running, e, belowFloor, ok := supportingESR(stubTable, tc.version)
		assert.Equal(t, tc.ok, ok, tc.version)
		assert.Equal(t, tc.belowFloor, belowFloor, tc.version)
		assert.Equal(t, tc.running, running.MajorMinor, tc.version)
		assert.Equal(t, tc.esr, e.MajorMinor, tc.version)
	}
}

func TestEOLRules(t *testing.T) {
	t.Parallel()

	after105EOL := esr105EOL.Add(day)
	before105EOL := esr105EOL.Add(-day)

	runCases(t, []ruleCase{
		{
			name:     "regular release past support built after the EOL date",
			snapshot: newSnapshot("10.6.3", "12.0.0", after105EOL),
			subject:  "10.6",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.target",
				details:   map[string]string{"version": "10.6.3", "esr": "10.5", "eol_date": "2026-03-15", "target": "11.8"},
			}),
		},
		{
			name:     "regular release past support built on the EOL date",
			snapshot: newSnapshot("10.6.3", "12.0.0", esr105EOL),
			subject:  "10.6",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.target",
				details:   map[string]string{"version": "10.6.3", "esr": "10.5", "eol_date": "2026-03-15", "target": "11.8"},
			}),
		},
		{
			name:     "regular release past support built before the EOL date",
			snapshot: newSnapshot("10.6.3", "12.0.0", before105EOL),
			subject:  "10.6",
			want: with(allCodes(resolved), "VERSION_EOL_UNVERIFIED", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol_unverified.message.target",
				details:   map[string]string{"version": "10.6.3", "esr": "10.5", "eol_date": "2026-03-15", "target": "11.8"},
			}),
		},
		{
			name:     "ESR past support with no build date",
			snapshot: newSnapshot("10.5.14", "", time.Time{}),
			subject:  "10.5",
			want: with(allCodes(resolved), "VERSION_EOL_UNVERIFIED", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol_unverified.message.target",
				details:   map[string]string{"version": "10.5.14", "esr": "10.5", "eol_date": "2026-03-15", "target": "11.8"},
			}),
		},
		{
			name:     "below the floor with no build date",
			snapshot: newSnapshot("10.4.2", "12.0.0", time.Time{}),
			subject:  "10.4",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.below_floor_target",
				details:   map[string]string{"version": "10.4.2", "target": "11.8"},
			}),
		},
		{
			name:     "below the floor built after every EOL date",
			snapshot: &healthcheck.Snapshot{CollectedAt: date(2028, time.January, 1), Version: healthcheck.VersionInfo{Current: "9.11.0", BuildDate: date(2028, time.January, 1)}},
			subject:  "9.11",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.below_floor",
				details:   map[string]string{"version": "9.11.0"},
			}),
		},
		{
			name:     "no supported ESR left to move to",
			snapshot: &healthcheck.Snapshot{CollectedAt: date(2028, time.January, 1), Version: healthcheck.VersionInfo{Current: "11.9.0", BuildDate: date(2028, time.January, 1)}},
			subject:  "11.9",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message",
				details:   map[string]string{"version": "11.9.0", "esr": "11.8", "eol_date": "2027-06-15"},
			}),
		},
		{
			name:     "supported regular release",
			snapshot: newSnapshot("11.0.1", "11.0.1", time.Time{}),
			subject:  "11.0",
			want:     allCodes(resolved),
		},
		{
			name:     "supported ESR",
			snapshot: newSnapshot("11.8.3", "12.0.0", time.Time{}),
			subject:  "11.8",
			want:     allCodes(resolved),
		},
	})
}

func TestESRNearEOL(t *testing.T) {
	t.Parallel()

	at := func(version string, collected time.Time) *healthcheck.Snapshot {
		s := newSnapshot(version, "12.0.0", time.Time{})
		s.CollectedAt = collected
		return s
	}
	value := func(v float64) *float64 { return &v }

	runCases(t, []ruleCase{
		{
			name:     "ESR 89 days before EOL",
			snapshot: at("10.11.4", esr1011EOL.Add(-89*day)),
			subject:  "10.11",
			want: with(allCodes(resolved), "VERSION_ESR_NEAR_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_esr_near_eol.message",
				details:   map[string]string{"version": "10.11.4", "esr": "10.11", "eol_date": "2026-12-15"},
				value:     value(89),
			}),
		},
		{
			name:     "ESR 91 days before EOL",
			snapshot: at("10.11.4", esr1011EOL.Add(-91*day)),
			subject:  "10.11",
			want:     allCodes(resolved),
		},
		{
			name:     "regular release on a line whose ESR is 89 days before EOL",
			snapshot: at("10.12.1", esr1011EOL.Add(-89*day)),
			subject:  "10.12",
			want:     with(allCodes(resolved), "VERSION_BEHIND_MAJOR", want{state: healthcheck.StateFiring, messageID: behindMajorMessage, details: map[string]string{"version": "10.12.1", "latest": "12.0.0"}}),
		},
		{
			name:     "ESR on its EOL date is past it, not near it",
			snapshot: at("10.11.4", esr1011EOL),
			subject:  "10.11",
			want: with(allCodes(resolved), "VERSION_EOL_UNVERIFIED", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol_unverified.message.target",
				details:   map[string]string{"version": "10.11.4", "esr": "10.11", "eol_date": "2026-12-15", "target": "11.8"},
			}),
		},
	})
}

func TestBehindRules(t *testing.T) {
	t.Parallel()

	runCases(t, []ruleCase{
		{
			name:     "two minors behind",
			snapshot: newSnapshot("11.9.2", "11.11.1", time.Time{}),
			subject:  "11.9",
			want:     with(allCodes(resolved), "VERSION_BEHIND_MINOR", want{state: healthcheck.StateFiring, messageID: behindMinorMessage, details: map[string]string{"version": "11.9.2", "latest": "11.11.1"}}),
		},
		{
			name:     "one minor behind",
			snapshot: newSnapshot("11.10.0", "11.11.1", time.Time{}),
			subject:  "11.10",
			want:     allCodes(resolved),
		},
		{
			name:     "one major behind",
			snapshot: newSnapshot("10.12.4", "11.0.0", time.Time{}),
			subject:  "10.12",
			want:     with(allCodes(resolved), "VERSION_BEHIND_MAJOR", want{state: healthcheck.StateFiring, messageID: behindMajorMessage, details: map[string]string{"version": "10.12.4", "latest": "11.0.0"}}),
		},
		{
			name:     "latest older than the running version",
			snapshot: newSnapshot("12.0.0", "11.11.1", time.Time{}),
			subject:  "12.0",
			want:     allCodes(resolved),
		},
		{
			name:     "ESR behind latest",
			snapshot: newSnapshot("11.8.3", "12.0.0", time.Time{}),
			subject:  "11.8",
			want:     allCodes(resolved),
		},
		{
			name:     "airgapped regular release",
			snapshot: newSnapshot("11.9.2", "", time.Time{}),
			subject:  "11.9",
			want: with(with(allCodes(resolved),
				"VERSION_BEHIND_MAJOR", unknown(reasonLatestUnknown)),
				"VERSION_BEHIND_MINOR", unknown(reasonLatestUnknown)),
		},
		{
			name:     "airgapped ESR",
			snapshot: newSnapshot("11.8.3", "", time.Time{}),
			subject:  "11.8",
			want:     allCodes(resolved),
		},
		{
			name:     "airgapped regular release past support",
			snapshot: newSnapshot("10.6.3", "", time.Time{}),
			subject:  "10.6",
			want: with(allCodes(resolved), "VERSION_EOL_UNVERIFIED", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol_unverified.message.target",
				details:   map[string]string{"version": "10.6.3", "esr": "10.5", "eol_date": "2026-03-15", "target": "11.8"},
			}),
		},
		{
			name:     "unparseable latest",
			snapshot: newSnapshot("11.9.2", "v11.11.1", time.Time{}),
			subject:  "11.9",
			want: with(with(allCodes(resolved),
				"VERSION_BEHIND_MAJOR", unknown(reasonLatestUnknown)),
				"VERSION_BEHIND_MINOR", unknown(reasonLatestUnknown)),
		},
	})
}

func TestUnknownVersion(t *testing.T) {
	t.Parallel()

	runCases(t, []ruleCase{
		{
			name:     "line newer than the table",
			snapshot: newSnapshot("12.1.0", "12.1.0", collectedAt),
			subject:  "12.1",
			want:     allCodes(unknown(reasonLineUnknown)),
		},
		{
			name:     "line missing from the table",
			snapshot: newSnapshot("11.5.0", "12.0.0", collectedAt),
			subject:  "11.5",
			want:     allCodes(unknown(reasonLineUnknown)),
		},
		{
			name:     "unparseable version",
			snapshot: newSnapshot("v11.0.1", "12.0.0", collectedAt),
			want:     allCodes(unknown(reasonVersionUnknown)),
		},
		{
			name:     "empty version",
			snapshot: newSnapshot("", "12.0.0", collectedAt),
			want:     allCodes(unknown(reasonVersionUnknown)),
		},
		{
			name:     "collection time unknown",
			snapshot: &healthcheck.Snapshot{Version: healthcheck.VersionInfo{Current: "10.4.2", Latest: "12.0.0", BuildDate: collectedAt}},
			subject:  "10.4",
			want:     allCodes(unknown(healthcheck.ReasonCollectedAtUnknown)),
		},
	})
}

func TestDatesComeFromCollectedAt(t *testing.T) {
	t.Parallel()

	registry := healthcheck.NewRegistry()
	for code, eval := range stubRules {
		registry.Register(healthcheck.Rule{Code: code, Eval: eval})
	}
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{
		Registry: registry,
		Now:      func() time.Time { return esr105EOL.Add(365 * day) },
	})

	s := newSnapshot("10.6.3", "", time.Time{})
	s.CollectedAt = esr105EOL.Add(-day)

	evaluations := engine.Evaluate(s)
	require.Len(t, evaluations, len(stubRules))
	for _, evaluation := range evaluations {
		if evaluation.Code == "VERSION_BEHIND_MAJOR" || evaluation.Code == "VERSION_BEHIND_MINOR" {
			assert.Equal(t, healthcheck.StateUnknown, evaluation.Result.State, evaluation.Code)
			continue
		}
		assert.Equal(t, healthcheck.StateResolved, evaluation.Result.State, evaluation.Code)
	}
}
