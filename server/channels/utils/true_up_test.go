// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGetNextTrueUpReviewDueDate(t *testing.T) {
	t.Run("Due date always falls on the 15th", func(t *testing.T) {
		// Before the 15th
		now := time.Date(2022, time.March, 14, 0, 0, 0, 0, time.Local)
		due := GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, trueUpReviewDueDay, due.Day())

		// On the 15th
		now = time.Date(2022, time.December, 15, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, trueUpReviewDueDay, due.Day())

		// After the 15th
		now = time.Date(2022, time.September, 16, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, trueUpReviewDueDay, due.Day())
	})

	t.Run("Due date will always be in next quarter if the current date is past the 15th", func(t *testing.T) {
		now := time.Date(2022, time.March, 16, 0, 0, 0, 0, time.Local)
		due := GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.April, due.Month())

		now = time.Date(2022, time.June, 16, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.July, due.Month())

		now = time.Date(2022, time.September, 16, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.October, due.Month())

		now = time.Date(2022, time.December, 16, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.January, due.Month())
	})

	t.Run("Due date will always be in the current quarter if the current date is before or on the 15th", func(t *testing.T) {
		now := time.Date(2022, time.April, 15, 0, 0, 0, 0, time.Local)
		due := GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.April, due.Month())

		now = time.Date(2022, time.July, 15, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.July, due.Month())

		now = time.Date(2022, time.October, 14, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.October, due.Month())

		now = time.Date(2022, time.January, 14, 0, 0, 0, 0, time.Local)
		due = GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.January, due.Month())
	})

	t.Run("Due date will be in the next year if the next quarter is not within the current year", func(t *testing.T) {
		now := time.Date(2022, time.October, 21, 0, 0, 0, 0, time.Local)
		due := GetNextTrueUpReviewDueDate(now)
		assert.Equal(t, time.January, due.Month())
		assert.Equal(t, 2023, due.Year())
	})
}

func TestIsTrueUpReviewDueDateWithinTheNext15Days(t *testing.T) {
	t.Run("Ensure a date within 30 days before the due date returns true", func(t *testing.T) {
		// 1 Day before the due date
		now := time.Date(2022, time.March, 16, 0, 0, 0, 0, time.Local)
		// Due date is December 15th, 2022
		due := GetNextTrueUpReviewDueDate(now)

		res := IsTrueUpReviewDueDateWithinTheNext30Days(now, due)
		assert.True(t, res)
	})

	t.Run("Ensure a date that is more than two weeks before the due date returns false", func(t *testing.T) {
		// 15 Days before the due date
		now := time.Date(2022, time.October, 16, 0, 0, 0, 0, time.Local)
		// Due date is December 15th, 2022
		due := GetNextTrueUpReviewDueDate(now)

		res := IsTrueUpReviewDueDateWithinTheNext30Days(now, due)
		assert.False(t, res)
	})

	t.Run("Ensure a date that is past the due date returns false", func(t *testing.T) {
		now := time.Date(2022, time.April, 15, 0, 0, 0, 0, time.Local)

		// Due date is April 16th, 2022
		dueNow := time.Date(2022, time.April, 16, 0, 0, 0, 0, time.Local)
		due := GetNextTrueUpReviewDueDate(dueNow)

		res := IsTrueUpReviewDueDateWithinTheNext30Days(now, due)
		assert.False(t, res)
	})

	t.Run("Ensure a date that is on the due date returns true", func(t *testing.T) {
		now := time.Date(2022, time.January, 15, 0, 0, 0, 0, time.Local)
		due := GetNextTrueUpReviewDueDate(now)
		fmt.Printf("\n\ndue date: %s\n\n", due.Format("2006-Jan-02"))
		fmt.Printf("\n\nnow: %s\n\n", now.Format("2006-Jan-02"))

		res := IsTrueUpReviewDueDateWithinTheNext30Days(now, due)
		assert.True(t, res)
	})

	t.Run("Ensure a date that is on the first day of the due date window returns true", func(t *testing.T) {
		now := time.Date(2022, time.December, 16, 0, 0, 0, 0, time.Local)
		due := GetNextTrueUpReviewDueDate(now)

		res := IsTrueUpReviewDueDateWithinTheNext30Days(now, due)
		assert.True(t, res)
	})
}
