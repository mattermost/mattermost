// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"slices"
	"time"
)

// ReleaseLifecycle classifies one release line.
type ReleaseLifecycle struct {
	MajorMinor string
	// EOLDate is the day support for this line ends.
	EOLDate time.Time
	ESR     bool
}

func eolDate(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

// releaseLifecycles is newest first, like versions. It ends at the oldest ESR still supported
// when the table was written, so every line below it had ended. Add an entry when a line is
// added to versions.
// Source: https://docs.mattermost.com/product-overview/mattermost-server-releases.html
var releaseLifecycles = []ReleaseLifecycle{
	{MajorMinor: "12.1", EOLDate: eolDate(2027, time.February, 15)},
	{MajorMinor: "12.0", EOLDate: eolDate(2027, time.January, 15)},
	{MajorMinor: "11.11", EOLDate: eolDate(2026, time.December, 15)},
	{MajorMinor: "11.10", EOLDate: eolDate(2026, time.November, 15)},
	{MajorMinor: "11.9", EOLDate: eolDate(2026, time.October, 15)},
	{MajorMinor: "11.8", EOLDate: eolDate(2026, time.September, 15)},
	{MajorMinor: "11.7", EOLDate: eolDate(2027, time.May, 15), ESR: true},
	{MajorMinor: "11.6", EOLDate: eolDate(2026, time.July, 15)},
	{MajorMinor: "11.5", EOLDate: eolDate(2026, time.June, 15)},
	{MajorMinor: "11.4", EOLDate: eolDate(2026, time.May, 15)},
	{MajorMinor: "11.3", EOLDate: eolDate(2026, time.April, 15)},
	{MajorMinor: "11.2", EOLDate: eolDate(2026, time.March, 15)},
	{MajorMinor: "11.1", EOLDate: eolDate(2026, time.February, 15)},
	{MajorMinor: "11.0", EOLDate: eolDate(2026, time.January, 15)},
	{MajorMinor: "10.12", EOLDate: eolDate(2025, time.December, 15)},
	{MajorMinor: "10.11", EOLDate: eolDate(2026, time.August, 15), ESR: true},
}

// ReleaseLifecycles returns a copy of the release lifecycle table, newest first.
func ReleaseLifecycles() []ReleaseLifecycle {
	return slices.Clone(releaseLifecycles)
}
