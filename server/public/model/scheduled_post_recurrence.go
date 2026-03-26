// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"time"
)

const (
	ScheduledPostRepeatTypeNone   = ""
	ScheduledPostRepeatTypeWeekly = "weekly"
)

// AdvanceWeeklyScheduledNextOccurrence returns the next weekly occurrence strictly after `nowMillis`.
// It preserves local wall-clock time in `timezone` (IANA), advancing by 7-day steps until the result is in the future.
func AdvanceWeeklyScheduledNextOccurrence(lastScheduledAtMillis int64, timezone string, nowMillis int64) int64 {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return lastScheduledAtMillis
	}
	next := time.UnixMilli(lastScheduledAtMillis).In(loc).AddDate(0, 0, 7)
	for !next.After(time.UnixMilli(nowMillis).In(loc)) {
		next = next.AddDate(0, 0, 7)
	}
	return next.UTC().UnixMilli()
}
