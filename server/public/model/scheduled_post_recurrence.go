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

// ComputeNextScheduledAt returns the next occurrence strictly after nowMillis for
// the post's repeat type, preserving local wall-clock time in RepeatTimezone.
func (s *ScheduledPost) ComputeNextScheduledAt(nowMillis int64) (int64, error) {
	switch s.RepeatType {
	case ScheduledPostRepeatTypeWeekly:
		loc, err := time.LoadLocation(s.RepeatTimezone)
		if err != nil {
			return 0, fmt.Errorf("failed to load repeat timezone %q: %w", s.RepeatTimezone, err)
		}

		// AddDate on a time in loc adds 7 local days, keeping the wall-clock time across DST changes.
		now := time.UnixMilli(nowMillis)
		next := time.UnixMilli(s.ScheduledAt).In(loc).AddDate(0, 0, 7)
		for !next.After(now) {
			next = next.AddDate(0, 0, 7)
		}
		return next.UnixMilli(), nil
	default:
		return 0, fmt.Errorf("unsupported scheduled post repeat type %q", s.RepeatType)
	}
}
