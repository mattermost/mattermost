// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"time"
)

const (
	ScheduledPostRepeatTypeNone   = ""
	ScheduledPostRepeatTypeWeekly = "weekly"
)

func (s *ScheduledPost) IsRecurring() bool {
	return s.RepeatType == ScheduledPostRepeatTypeWeekly
}

// ComputeNextScheduledAt returns the next weekly occurrence strictly after nowMillis,
// preserving local wall-clock time in RepeatTimezone.
func (s *ScheduledPost) ComputeNextScheduledAt(nowMillis int64) (int64, error) {
	loc, err := time.LoadLocation(s.RepeatTimezone)
	if err != nil {
		return 0, fmt.Errorf("failed to load repeat timezone %q: %w", s.RepeatTimezone, err)
	}
	next := time.UnixMilli(s.ScheduledAt).In(loc).AddDate(0, 0, 7)
	for !next.After(time.UnixMilli(nowMillis).In(loc)) {
		next = next.AddDate(0, 0, 7)
	}
	return next.UTC().UnixMilli(), nil
}
