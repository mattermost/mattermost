// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScheduledRecapConstants(t *testing.T) {
	t.Run("day of week bitmask values", func(t *testing.T) {
		assert.Equal(t, 1, Sunday)
		assert.Equal(t, 2, Monday)
		assert.Equal(t, 4, Tuesday)
		assert.Equal(t, 8, Wednesday)
		assert.Equal(t, 16, Thursday)
		assert.Equal(t, 32, Friday)
		assert.Equal(t, 64, Saturday)
	})

	t.Run("weekdays constant", func(t *testing.T) {
		expected := Monday | Tuesday | Wednesday | Thursday | Friday
		assert.Equal(t, 62, expected)
		assert.Equal(t, expected, Weekdays)
	})

	t.Run("weekend constant", func(t *testing.T) {
		expected := Saturday | Sunday
		assert.Equal(t, 65, expected)
		assert.Equal(t, expected, Weekend)
	})

	t.Run("every day constant", func(t *testing.T) {
		expected := Weekdays | Weekend
		assert.Equal(t, 127, expected)
		assert.Equal(t, expected, EveryDay)
	})

	t.Run("channel mode constants", func(t *testing.T) {
		assert.Equal(t, "specific", ChannelModeSpecific)
		assert.Equal(t, "all_unreads", ChannelModeAllUnreads)
	})

	t.Run("time period constants", func(t *testing.T) {
		assert.Equal(t, "last_24h", TimePeriodLast24h)
		assert.Equal(t, "last_week", TimePeriodLastWeek)
		assert.Equal(t, "since_last_read", TimePeriodSinceLastRead)
	})
}

func TestScheduledRecapComputeNextRunAt(t *testing.T) {
	t.Run("monday only schedule", func(t *testing.T) {
		sr := &ScheduledRecap{
			DaysOfWeek: Monday,
			TimeOfDay:  "09:00",
			Timezone:   "America/New_York",
		}

		// Start from Sunday 2024-01-07 10:00 AM EST
		fromTime := time.Date(2024, 1, 7, 10, 0, 0, 0, time.UTC)

		nextRunAt, err := sr.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		// Should be Monday 2024-01-08 09:00 AM EST = 14:00 UTC
		result := time.UnixMilli(nextRunAt)
		loc, _ := time.LoadLocation("America/New_York")
		localResult := result.In(loc)

		assert.Equal(t, time.Monday, localResult.Weekday())
		assert.Equal(t, 9, localResult.Hour())
		assert.Equal(t, 0, localResult.Minute())
	})

	t.Run("weekday schedule skips weekend", func(t *testing.T) {
		sr := &ScheduledRecap{
			DaysOfWeek: Weekdays,
			TimeOfDay:  "08:00",
			Timezone:   "America/Los_Angeles",
		}

		// Start from Friday 2024-01-05 at 17:00 PST (past 8am)
		loc, _ := time.LoadLocation("America/Los_Angeles")
		fromTime := time.Date(2024, 1, 5, 17, 0, 0, 0, loc)

		nextRunAt, err := sr.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		result := time.UnixMilli(nextRunAt)
		localResult := result.In(loc)

		// Should skip Saturday and Sunday, land on Monday
		assert.Equal(t, time.Monday, localResult.Weekday())
		assert.Equal(t, 8, localResult.Hour())
	})

	t.Run("every day schedule returns next day", func(t *testing.T) {
		sr := &ScheduledRecap{
			DaysOfWeek: EveryDay,
			TimeOfDay:  "06:00",
			Timezone:   "Europe/London",
		}

		// Start from Wednesday 2024-01-10 at 07:00 GMT (past 6am)
		loc, _ := time.LoadLocation("Europe/London")
		fromTime := time.Date(2024, 1, 10, 7, 0, 0, 0, loc)

		nextRunAt, err := sr.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		result := time.UnixMilli(nextRunAt)
		localResult := result.In(loc)

		// Should be Thursday 2024-01-11 at 06:00
		assert.Equal(t, time.Thursday, localResult.Weekday())
		assert.Equal(t, 6, localResult.Hour())
	})

	t.Run("same day before scheduled time", func(t *testing.T) {
		sr := &ScheduledRecap{
			DaysOfWeek: Monday,
			TimeOfDay:  "15:00",
			Timezone:   "America/New_York",
		}

		// Start from Monday 2024-01-08 at 10:00 AM EST (before 3pm)
		loc, _ := time.LoadLocation("America/New_York")
		fromTime := time.Date(2024, 1, 8, 10, 0, 0, 0, loc)

		nextRunAt, err := sr.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		result := time.UnixMilli(nextRunAt)
		localResult := result.In(loc)

		// Should be same day Monday at 15:00
		assert.Equal(t, 8, localResult.Day())
		assert.Equal(t, time.Monday, localResult.Weekday())
		assert.Equal(t, 15, localResult.Hour())
	})

	t.Run("different timezones produce different UTC millis", func(t *testing.T) {
		srEast := &ScheduledRecap{
			DaysOfWeek: Monday,
			TimeOfDay:  "09:00",
			Timezone:   "America/New_York",
		}

		srWest := &ScheduledRecap{
			DaysOfWeek: Monday,
			TimeOfDay:  "09:00",
			Timezone:   "America/Los_Angeles",
		}

		// Start from Sunday before both times
		fromTime := time.Date(2024, 1, 7, 0, 0, 0, 0, time.UTC)

		nextRunEast, err := srEast.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		nextRunWest, err := srWest.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		// Pacific is 3 hours behind Eastern, so West should be larger (later)
		assert.Greater(t, nextRunWest, nextRunEast)

		// The difference should be 3 hours = 3 * 60 * 60 * 1000 ms
		diff := nextRunWest - nextRunEast
		assert.Equal(t, int64(3*60*60*1000), diff)
	})

	t.Run("DST spring forward - March 2024", func(t *testing.T) {
		// In America/New_York, on March 10, 2024, 2:00 AM becomes 3:00 AM
		// A schedule for 2:30 AM doesn't exist on that day
		// Go's time.Date returns the equivalent time before DST transition
		// i.e., 2:30 AM requested becomes 1:30 AM EST (which is a valid time)
		sr := &ScheduledRecap{
			DaysOfWeek: Sunday,
			TimeOfDay:  "02:30",
			Timezone:   "America/New_York",
		}

		// Start from Saturday March 9, 2024 at noon
		loc, _ := time.LoadLocation("America/New_York")
		fromTime := time.Date(2024, 3, 9, 12, 0, 0, 0, loc)

		nextRunAt, err := sr.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		result := time.UnixMilli(nextRunAt)
		localResult := result.In(loc)

		// Go normalizes non-existent times to the equivalent valid time
		// 2:30 AM on March 10 becomes 1:30 AM EST (before DST kicks in)
		// This is documented Go behavior for time.Date with non-existent times
		assert.Equal(t, time.Sunday, localResult.Weekday())
		assert.Equal(t, 1, localResult.Hour())
		assert.Equal(t, 30, localResult.Minute())
	})

	t.Run("DST fall back - November 2024", func(t *testing.T) {
		// In America/New_York, on November 3, 2024, 1:30 AM occurs twice
		// Go's time.Date picks the first occurrence (before DST ends)
		sr := &ScheduledRecap{
			DaysOfWeek: Sunday,
			TimeOfDay:  "01:30",
			Timezone:   "America/New_York",
		}

		// Start from Saturday November 2, 2024 at noon
		loc, _ := time.LoadLocation("America/New_York")
		fromTime := time.Date(2024, 11, 2, 12, 0, 0, 0, loc)

		nextRunAt, err := sr.ComputeNextRunAt(fromTime)
		require.NoError(t, err)

		result := time.UnixMilli(nextRunAt)
		localResult := result.In(loc)

		// Should be Sunday at 1:30 AM (first occurrence, still in DST)
		assert.Equal(t, time.Sunday, localResult.Weekday())
		assert.Equal(t, 1, localResult.Hour())
		assert.Equal(t, 30, localResult.Minute())
	})

	t.Run("error on invalid timezone", func(t *testing.T) {
		sr := &ScheduledRecap{
			DaysOfWeek: Monday,
			TimeOfDay:  "09:00",
			Timezone:   "Invalid/Timezone",
		}

		fromTime := time.Now()
		_, err := sr.ComputeNextRunAt(fromTime)
		require.Error(t, err)
	})

	t.Run("error on invalid time format", func(t *testing.T) {
		sr := &ScheduledRecap{
			DaysOfWeek: Monday,
			TimeOfDay:  "9:00",
			Timezone:   "America/New_York",
		}

		fromTime := time.Now()
		_, err := sr.ComputeNextRunAt(fromTime)
		require.Error(t, err)
	})

	t.Run("error on zero days of week", func(t *testing.T) {
		sr := &ScheduledRecap{
			DaysOfWeek: 0,
			TimeOfDay:  "09:00",
			Timezone:   "America/New_York",
		}

		fromTime := time.Now()
		_, err := sr.ComputeNextRunAt(fromTime)
		require.Error(t, err)
	})
}

func TestScheduledRecapIsValid(t *testing.T) {
	validRecap := func() *ScheduledRecap {
		return &ScheduledRecap{
			Id:          NewId(),
			UserId:      NewId(),
			Title:       "Daily Standup Recap",
			DaysOfWeek:  Weekdays,
			TimeOfDay:   "09:00",
			Timezone:    "America/New_York",
			TimePeriod:  TimePeriodLast24h,
			ChannelMode: ChannelModeSpecific,
			ChannelIds:  []string{NewId()},
			IsRecurring: true,
			Enabled:     true,
		}
	}

	t.Run("valid scheduled recap passes", func(t *testing.T) {
		sr := validRecap()
		assert.Nil(t, sr.IsValid())
	})

	t.Run("invalid id fails", func(t *testing.T) {
		sr := validRecap()
		sr.Id = "invalid"
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("invalid user id fails", func(t *testing.T) {
		sr := validRecap()
		sr.UserId = ""
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("empty title fails", func(t *testing.T) {
		sr := validRecap()
		sr.Title = ""
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("title too long fails", func(t *testing.T) {
		sr := validRecap()
		sr.Title = string(make([]byte, ScheduledRecapTitleMaxLength+1))
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("zero days of week fails", func(t *testing.T) {
		sr := validRecap()
		sr.DaysOfWeek = 0
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("days of week over 127 fails", func(t *testing.T) {
		sr := validRecap()
		sr.DaysOfWeek = 128
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("invalid time format fails", func(t *testing.T) {
		testCases := []string{
			"9:00",     // single digit hour
			"25:00",    // invalid hour
			"09:60",    // invalid minute
			"9am",      // wrong format
			"09:00:00", // too many colons
			"",         // empty
		}

		for _, tc := range testCases {
			sr := validRecap()
			sr.TimeOfDay = tc
			assert.NotNil(t, sr.IsValid(), "expected failure for time: %s", tc)
		}
	})

	t.Run("valid time formats pass", func(t *testing.T) {
		testCases := []string{
			"00:00",
			"09:00",
			"12:30",
			"23:59",
		}

		for _, tc := range testCases {
			sr := validRecap()
			sr.TimeOfDay = tc
			assert.Nil(t, sr.IsValid(), "expected success for time: %s", tc)
		}
	})

	t.Run("invalid timezone fails", func(t *testing.T) {
		sr := validRecap()
		sr.Timezone = "PST" // Abbreviation, not IANA
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("invalid time period fails", func(t *testing.T) {
		sr := validRecap()
		sr.TimePeriod = "invalid"
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("invalid channel mode fails", func(t *testing.T) {
		sr := validRecap()
		sr.ChannelMode = "invalid"
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("specific mode with empty channel ids fails", func(t *testing.T) {
		sr := validRecap()
		sr.ChannelMode = ChannelModeSpecific
		sr.ChannelIds = []string{}
		assert.NotNil(t, sr.IsValid())
	})

	t.Run("all unreads mode with empty channel ids passes", func(t *testing.T) {
		sr := validRecap()
		sr.ChannelMode = ChannelModeAllUnreads
		sr.ChannelIds = []string{}
		assert.Nil(t, sr.IsValid())
	})
}

func TestScheduledRecapPreSave(t *testing.T) {
	t.Run("generates id if empty", func(t *testing.T) {
		sr := &ScheduledRecap{}
		sr.PreSave()
		assert.Len(t, sr.Id, 26)
	})

	t.Run("sets create_at and update_at", func(t *testing.T) {
		sr := &ScheduledRecap{}
		sr.PreSave()
		assert.NotZero(t, sr.CreateAt)
		assert.Equal(t, sr.CreateAt, sr.UpdateAt)
	})

	t.Run("preserves existing id", func(t *testing.T) {
		existingId := NewId()
		sr := &ScheduledRecap{Id: existingId}
		sr.PreSave()
		assert.Equal(t, existingId, sr.Id)
	})
}

func TestScheduledRecapPreUpdate(t *testing.T) {
	t.Run("updates update_at", func(t *testing.T) {
		sr := &ScheduledRecap{
			UpdateAt: 1000,
		}
		sr.PreUpdate()
		assert.Greater(t, sr.UpdateAt, int64(1000))
	})
}

func TestScheduledRecapAuditable(t *testing.T) {
	t.Run("returns all expected fields", func(t *testing.T) {
		sr := &ScheduledRecap{
			Id:          NewId(),
			UserId:      NewId(),
			Title:       "Test Recap",
			DaysOfWeek:  Weekdays,
			TimeOfDay:   "09:00",
			Timezone:    "America/New_York",
			TimePeriod:  TimePeriodLast24h,
			ChannelMode: ChannelModeSpecific,
			ChannelIds:  []string{"ch1", "ch2"},
			AgentId:     NewId(),
			IsRecurring: true,
			Enabled:     true,
			CreateAt:    1000,
			UpdateAt:    2000,
			DeleteAt:    0,
		}

		audit := sr.Auditable()

		assert.Equal(t, sr.Id, audit["id"])
		assert.Equal(t, sr.UserId, audit["user_id"])
		assert.Equal(t, sr.Title, audit["title"])
		assert.Equal(t, sr.DaysOfWeek, audit["days_of_week"])
		assert.Equal(t, sr.TimeOfDay, audit["time_of_day"])
		assert.Equal(t, sr.Timezone, audit["timezone"])
		assert.Equal(t, sr.TimePeriod, audit["time_period"])
		assert.Equal(t, sr.ChannelMode, audit["channel_mode"])
		assert.Equal(t, sr.ChannelIds, audit["channel_ids"])
		assert.Equal(t, sr.AgentId, audit["agent_id"])
		assert.Equal(t, sr.IsRecurring, audit["is_recurring"])
		assert.Equal(t, sr.Enabled, audit["enabled"])
		assert.Equal(t, sr.CreateAt, audit["create_at"])
		assert.Equal(t, sr.UpdateAt, audit["update_at"])
		assert.Equal(t, sr.DeleteAt, audit["delete_at"])
	})
}

func TestScheduledRecapDayOfWeekBitmask(t *testing.T) {
	t.Run("single day", func(t *testing.T) {
		// Monday = 2
		assert.Equal(t, 2, Monday)
		assert.True(t, Monday&Monday != 0)
		assert.False(t, Monday&Tuesday != 0)
	})

	t.Run("multiple days Mon+Wed+Fri", func(t *testing.T) {
		days := Monday | Wednesday | Friday // 2 + 8 + 32 = 42
		assert.Equal(t, 42, days)

		assert.True(t, days&Monday != 0)
		assert.False(t, days&Tuesday != 0)
		assert.True(t, days&Wednesday != 0)
		assert.False(t, days&Thursday != 0)
		assert.True(t, days&Friday != 0)
		assert.False(t, days&Saturday != 0)
		assert.False(t, days&Sunday != 0)
	})

	t.Run("weekdays constant", func(t *testing.T) {
		assert.True(t, Weekdays&Monday != 0)
		assert.True(t, Weekdays&Tuesday != 0)
		assert.True(t, Weekdays&Wednesday != 0)
		assert.True(t, Weekdays&Thursday != 0)
		assert.True(t, Weekdays&Friday != 0)
		assert.False(t, Weekdays&Saturday != 0)
		assert.False(t, Weekdays&Sunday != 0)
	})

	t.Run("weekend constant", func(t *testing.T) {
		assert.False(t, Weekend&Monday != 0)
		assert.False(t, Weekend&Friday != 0)
		assert.True(t, Weekend&Saturday != 0)
		assert.True(t, Weekend&Sunday != 0)
	})

	t.Run("every day constant includes all days", func(t *testing.T) {
		assert.True(t, EveryDay&Sunday != 0)
		assert.True(t, EveryDay&Monday != 0)
		assert.True(t, EveryDay&Tuesday != 0)
		assert.True(t, EveryDay&Wednesday != 0)
		assert.True(t, EveryDay&Thursday != 0)
		assert.True(t, EveryDay&Friday != 0)
		assert.True(t, EveryDay&Saturday != 0)
	})
}
