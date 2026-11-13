// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestEOLRules(t *testing.T) {
	t.Parallel()

	runCases(t, []ruleCase{
		{
			name:     "regular release past its own EOL is pointed at the latest release, not an ESR",
			snapshot: newSnapshot("11.0.1", "12.0.0"),
			subject:  "11.0",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.latest",
				details:   map[string]string{"version": "11.0.1", "eol_date": "2026-01-15"},
			}),
		},
		{
			name:     "regular release on its EOL date",
			snapshot: newSnapshot("11.9.0", "11.11.1"),
			now:      reg119EOL,
			subject:  "11.9",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.latest",
				details:   map[string]string{"version": "11.9.0", "eol_date": "2026-10-15"},
			}),
		},
		{
			name:     "collected while supported, evaluated after its EOL date",
			snapshot: &healthcheck.Snapshot{CollectedAt: reg119EOL.Add(-30 * day), Version: healthcheck.VersionInfo{Current: "11.9.0"}},
			now:      reg119EOL.Add(day),
			subject:  "11.9",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.latest",
				details:   map[string]string{"version": "11.9.0", "eol_date": "2026-10-15"},
			}),
		},
		{
			name:     "regular release the day before its EOL date",
			snapshot: newSnapshot("11.9.0", "11.11.1"),
			now:      reg119EOL.Add(-day),
			subject:  "11.9",
			want:     behindBy("11.9.0", "11.11.1", 2),
		},
		{
			name:     "ESR past its EOL date",
			snapshot: newSnapshot("10.5.14", ""),
			subject:  "10.5",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.target",
				details:   map[string]string{"version": "10.5.14", "eol_date": "2026-03-15", "target": "11.8"},
			}),
		},
		{
			name:     "below the floor",
			snapshot: newSnapshot("10.4.2", "12.0.0"),
			subject:  "10.4",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.below_floor_target",
				details:   map[string]string{"version": "10.4.2", "target": "11.8"},
			}),
		},
		{
			name:     "below the floor with no supported ESR left",
			snapshot: newSnapshot("9.11.0", ""),
			now:      date(2028, time.January, 1),
			subject:  "9.11",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.below_floor",
				details:   map[string]string{"version": "9.11.0"},
			}),
		},
		{
			name:     "ESR with no supported ESR left to move to",
			snapshot: newSnapshot("10.11.4", ""),
			now:      date(2028, time.January, 1),
			subject:  "10.11",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message",
				details:   map[string]string{"version": "10.11.4", "eol_date": "2026-12-15"},
			}),
		},
		{
			name:     "supported regular release",
			snapshot: newSnapshot("11.10.0", "11.10.0"),
			subject:  "11.10",
			want:     allCodes(resolved),
		},
		{
			name:     "supported ESR",
			snapshot: newSnapshot("11.8.3", "12.0.0"),
			subject:  "11.8",
			want:     allCodes(resolved),
		},
	})
}

func TestESRNearEOL(t *testing.T) {
	t.Parallel()

	runCases(t, []ruleCase{
		{
			name:     "ESR 89 days before EOL",
			snapshot: newSnapshot("10.11.4", "12.0.0"),
			now:      esr1011EOL.Add(-89 * day),
			subject:  "10.11",
			want: with(allCodes(resolved), "VERSION_ESR_NEAR_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_esr_near_eol.message",
				details:   map[string]string{"version": "10.11.4", "esr": "10.11", "eol_date": "2026-12-15"},
				value:     new(89.0),
			}),
		},
		{
			name:     "ESR 91 days before EOL",
			snapshot: newSnapshot("10.11.4", "12.0.0"),
			now:      esr1011EOL.Add(-91 * day),
			subject:  "10.11",
			want:     allCodes(resolved),
		},
		{
			name:     "regular release 30 days before its EOL",
			snapshot: newSnapshot("11.9.0", "12.0.0"),
			now:      reg119EOL.Add(-30 * day),
			subject:  "11.9",
			want:     behindBy("11.9.0", "12.0.0", 3),
		},
		{
			name:     "ESR on its EOL date is past it, not near it",
			snapshot: newSnapshot("10.11.4", "12.0.0"),
			now:      esr1011EOL,
			subject:  "10.11",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.target",
				details:   map[string]string{"version": "10.11.4", "eol_date": "2026-12-15", "target": "11.8"},
			}),
		},
	})
}
