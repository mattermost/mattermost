// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestAdvanceWeeklyScheduledNextOccurrence(t *testing.T) {
	tz := "America/New_York"
	loc, err := time.LoadLocation(tz)
	require.NoError(t, err)

	// Thursday March 26, 2026 9:00 AM local
	base := time.Date(2026, time.March, 26, 9, 0, 0, 0, loc)
	now := base.Add(1 * time.Minute) // just after send

	next := AdvanceWeeklyScheduledNextOccurrence(base.UnixMilli(), tz, now.UnixMilli())
	nextTime := time.UnixMilli(next).In(loc)
	require.Equal(t, time.Thursday, nextTime.Weekday())
	require.Equal(t, 9, nextTime.Hour())
	require.Equal(t, 0, nextTime.Minute())
	// Next Thursday April 2
	require.Equal(t, time.April, nextTime.Month())
	require.Equal(t, 2, nextTime.Day())
}
