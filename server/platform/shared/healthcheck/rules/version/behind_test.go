// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestBehindRules(t *testing.T) {
	t.Parallel()

	runCases(t, []ruleCase{
		{
			name:     "one release behind",
			snapshot: newSnapshot("11.10.0", "11.11.1"),
			subject:  "11.10",
			want:     behindBy("11.10.0", "11.11.1", 1),
		},
		{
			name:     "two releases behind",
			snapshot: newSnapshot("11.9.2", "11.11.1"),
			subject:  "11.9",
			want:     behindBy("11.9.2", "11.11.1", 2),
		},
		{
			name:     "a new major counts as one release",
			snapshot: newSnapshot("11.11.0", "12.0.0"),
			subject:  "11.11",
			want:     behindBy("11.11.0", "12.0.0", 1),
		},
		{
			name:     "two releases behind across a major",
			snapshot: newSnapshot("11.10.0", "12.0.0"),
			subject:  "11.10",
			want:     behindBy("11.10.0", "12.0.0", 2),
		},
		{
			name:     "latest newer than the table in the same major",
			snapshot: newSnapshot("12.0.0", "12.2.0"),
			subject:  "12.0",
			want:     behindBy("12.0.0", "12.2.0", 2),
		},
		{
			name:     "latest in a major newer than the table",
			snapshot: newSnapshot("11.11.0", "13.1.0"),
			subject:  "11.11",
			want:     behindBy("11.11.0", "13.1.0", 3),
		},
		{
			name:     "up to date",
			snapshot: newSnapshot("11.11.0", "11.11.2"),
			subject:  "11.11",
			want:     allCodes(resolved),
		},
		{
			name:     "latest older than the running version",
			snapshot: newSnapshot("12.0.0", "11.11.1"),
			subject:  "12.0",
			want:     allCodes(resolved),
		},
		{
			name:     "ESR behind latest",
			snapshot: newSnapshot("11.8.3", "12.0.0"),
			subject:  "11.8",
			want:     allCodes(resolved),
		},
		{
			name:     "airgapped regular release",
			snapshot: newSnapshot("11.9.2", ""),
			subject:  "11.9",
			want: with(with(allCodes(resolved),
				"VERSION_BEHIND_ONE", unknown(reasonLatestUnknown)),
				"VERSION_BEHIND", unknown(reasonLatestUnknown)),
		},
		{
			name:     "airgapped ESR",
			snapshot: newSnapshot("11.8.3", ""),
			subject:  "11.8",
			want:     allCodes(resolved),
		},
		{
			name:     "airgapped regular release past support",
			snapshot: newSnapshot("10.6.3", ""),
			subject:  "10.6",
			want: with(allCodes(resolved), "VERSION_EOL", want{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.version_eol.message.target",
				details:   map[string]string{"version": "10.6.3", "eol_date": "2025-06-15", "target": "11.8"},
			}),
		},
		{
			name:     "unparseable latest",
			snapshot: newSnapshot("11.9.2", "v11.11.1"),
			subject:  "11.9",
			want: with(with(allCodes(resolved),
				"VERSION_BEHIND_ONE", unknown(reasonLatestUnknown)),
				"VERSION_BEHIND", unknown(reasonLatestUnknown)),
		},
	})
}
