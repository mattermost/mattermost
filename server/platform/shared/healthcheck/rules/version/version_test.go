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
	evaluatedAt = date(2026, time.September, 25)

	reg106EOL  = date(2025, time.June, 15)
	esr105EOL  = date(2026, time.March, 15)
	reg119EOL  = date(2026, time.October, 15)
	esr1011EOL = date(2026, time.December, 15)
	esr118EOL  = date(2027, time.June, 15)
)

// stubTable is fictional, so the tests do not move when release engineering edits the real one.
var stubTable = []model.ReleaseLifecycle{
	{MajorMinor: "12.0", EOLDate: date(2027, time.January, 15)},
	{MajorMinor: "11.11", EOLDate: date(2026, time.December, 15)},
	{MajorMinor: "11.10", EOLDate: date(2026, time.November, 15)},
	{MajorMinor: "11.9", EOLDate: reg119EOL},
	{MajorMinor: "11.8", EOLDate: esr118EOL, ESR: true},
	{MajorMinor: "11.0", EOLDate: date(2026, time.January, 15)},
	{MajorMinor: "10.12", EOLDate: date(2025, time.December, 15)},
	{MajorMinor: "10.11", EOLDate: esr1011EOL, ESR: true},
	{MajorMinor: "10.6", EOLDate: reg106EOL},
	{MajorMinor: "10.5", EOLDate: esr105EOL, ESR: true},
}

func stubRules(now time.Time) map[string]func(*healthcheck.Snapshot) []healthcheck.Result {
	clock := func() time.Time { return now }
	return map[string]func(*healthcheck.Snapshot) []healthcheck.Result{
		"VERSION_EOL":          evalVersionEOL(stubTable, clock),
		"VERSION_ESR_NEAR_EOL": evalVersionESRNearEOL(stubTable, clock),
		"VERSION_BEHIND_ONE":   evalBehind(stubTable, clock, behindOneMessage, isOneBehind),
		"VERSION_BEHIND":       evalBehind(stubTable, clock, behindMessage, isSeveralBehind),
	}
}

const (
	behindOneMessage = "health.rule.version_behind_one.message"
	behindMessage    = "health.rule.version_behind.message"
)

func newSnapshot(current, latest string) *healthcheck.Snapshot {
	return &healthcheck.Snapshot{Version: healthcheck.VersionInfo{Current: current, Latest: latest}}
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
	for code := range stubRules(evaluatedAt) {
		wants[code] = w
	}
	return wants
}

func with(wants map[string]want, code string, w want) map[string]want {
	wants[code] = w
	return wants
}

func value(v float64) *float64 { return &v }

func behindBy(version, latest string, n int) map[string]want {
	code, messageID := "VERSION_BEHIND", behindMessage
	if n == 1 {
		code, messageID = "VERSION_BEHIND_ONE", behindOneMessage
	}
	return with(allCodes(resolved), code, want{
		state:     healthcheck.StateFiring,
		messageID: messageID,
		details:   map[string]string{"version": version, "latest": latest},
		value:     value(float64(n)),
	})
}

type ruleCase struct {
	name     string
	snapshot *healthcheck.Snapshot
	// now defaults to evaluatedAt.
	now     time.Time
	subject string
	want    map[string]want
}

func runCases(t *testing.T, testCases []ruleCase) {
	t.Helper()

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			now := tc.now
			if now.IsZero() {
				now = evaluatedAt
			}
			for code, eval := range stubRules(now) {
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
		{"VERSION_ESR_NEAR_EOL", healthcheck.SeverityWarning, healthcheck.VolatilityStable},
		{"VERSION_BEHIND_ONE", healthcheck.SeverityInfo, healthcheck.VolatilityFeed},
		{"VERSION_BEHIND", healthcheck.SeverityWarning, healthcheck.VolatilityFeed},
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

func TestUnknownVersion(t *testing.T) {
	t.Parallel()

	runCases(t, []ruleCase{
		{
			name:     "line newer than the table",
			snapshot: newSnapshot("12.1.0", "12.1.0"),
			subject:  "12.1",
			want:     allCodes(unknown(reasonLineUnknown)),
		},
		{
			name:     "line missing from the table",
			snapshot: newSnapshot("11.5.0", "12.0.0"),
			subject:  "11.5",
			want:     allCodes(unknown(reasonLineUnknown)),
		},
		{
			name:     "unparseable version",
			snapshot: newSnapshot("v11.0.1", "12.0.0"),
			want:     allCodes(unknown(reasonVersionUnknown)),
		},
		{
			name:     "empty version",
			snapshot: newSnapshot("", "12.0.0"),
			want:     allCodes(unknown(reasonVersionUnknown)),
		},
	})
}
