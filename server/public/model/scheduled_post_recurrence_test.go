// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestComputeNextScheduledAt(t *testing.T) {
	tz := "America/New_York"
	loc, err := time.LoadLocation(tz)
	require.NoError(t, err)

	// Thursday March 26, 2026 9:00 AM local
	base := time.Date(2026, time.March, 26, 9, 0, 0, 0, loc)

	t.Run("advances one week preserving wall-clock time", func(t *testing.T) {
		scheduledPost := &ScheduledPost{
			ScheduledAt:    base.UnixMilli(),
			RepeatType:     ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: tz,
		}
		now := base.Add(1 * time.Minute) // just after send

		next, err := scheduledPost.ComputeNextScheduledAt(now.UnixMilli())
		require.NoError(t, err)
		nextTime := time.UnixMilli(next).In(loc)
		require.Equal(t, time.Thursday, nextTime.Weekday())
		require.Equal(t, 9, nextTime.Hour())
		require.Equal(t, 0, nextTime.Minute())
		// Next Thursday April 2
		require.Equal(t, time.April, nextTime.Month())
		require.Equal(t, 2, nextTime.Day())
	})

	t.Run("skips past occurrences when the post is overdue by more than a week", func(t *testing.T) {
		scheduledPost := &ScheduledPost{
			ScheduledAt:    base.UnixMilli(),
			RepeatType:     ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: tz,
		}
		now := base.AddDate(0, 0, 16) // more than two weeks later

		next, err := scheduledPost.ComputeNextScheduledAt(now.UnixMilli())
		require.NoError(t, err)
		nextTime := time.UnixMilli(next).In(loc)
		require.True(t, nextTime.After(now))
		require.Equal(t, time.Thursday, nextTime.Weekday())
		require.Equal(t, 9, nextTime.Hour())
	})

	t.Run("returns an error for an invalid timezone", func(t *testing.T) {
		scheduledPost := &ScheduledPost{
			ScheduledAt:    base.UnixMilli(),
			RepeatType:     ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "Not/AZone",
		}

		_, err := scheduledPost.ComputeNextScheduledAt(base.UnixMilli())
		require.Error(t, err)
	})
}

func TestScheduledPostIsRecurring(t *testing.T) {
	require.True(t, (&ScheduledPost{RepeatType: ScheduledPostRepeatTypeWeekly}).IsRecurring())
	require.False(t, (&ScheduledPost{}).IsRecurring())
}
