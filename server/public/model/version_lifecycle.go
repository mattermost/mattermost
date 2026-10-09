// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"slices"
	"time"
)

// ReleaseLifecycle classifies one release line. ESR is fixed when the line ships; EOLDate is a
// forecast and may be extended, which is why health rules weigh it against the build date.
type ReleaseLifecycle struct {
	MajorMinor string
	ESR        bool
	// EOLDate is the day support ends, zero for regular releases.
	EOLDate time.Time
}

// releaseLifecycles is newest first, like versions. It ends at the oldest ESR still receiving
// patches when the table was written, so every line below it had ended. Add an entry when a
// line is added to versions, and cherry-pick EOL extensions to every supported release branch.
// Source: https://docs.mattermost.com/product-overview/mattermost-server-releases.html
var releaseLifecycles = []ReleaseLifecycle{
	{MajorMinor: "12.0"},
	{MajorMinor: "11.11"},
	{MajorMinor: "11.10"},
	{MajorMinor: "11.9"},
	{MajorMinor: "11.8"},
	{MajorMinor: "11.7", ESR: true, EOLDate: time.Date(2027, time.May, 15, 0, 0, 0, 0, time.UTC)},
	{MajorMinor: "11.6"},
	{MajorMinor: "11.5"},
	{MajorMinor: "11.4"},
	{MajorMinor: "11.3"},
	{MajorMinor: "11.2"},
	{MajorMinor: "11.1"},
	{MajorMinor: "11.0"},
	{MajorMinor: "10.12"},
	{MajorMinor: "10.11", ESR: true, EOLDate: time.Date(2026, time.August, 15, 0, 0, 0, 0, time.UTC)},
}

// ReleaseLifecycles returns a copy of the release lifecycle table, newest first.
func ReleaseLifecycles() []ReleaseLifecycle {
	return slices.Clone(releaseLifecycles)
}
