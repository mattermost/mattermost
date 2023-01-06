// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"time"
)

const trueUpReviewDueDay = 15
const day = time.Hour * 24

type DueDateWindow struct {
	Start time.Time
	End   time.Time
}

func GetNextTrueUpReviewDueDate(now time.Time) time.Time {
	nowYear := now.Year()
	nowMonth := now.Month()
	nowDay := now.Day()
	finalQuarterYear := nowYear
	if nowMonth >= time.October && nowMonth <= time.December {
		finalQuarterYear = nowYear + 1
	}
	trueUpSubmissionWindows := []DueDateWindow{
		{
			Start: time.Date(now.Year(), time.January, 16, 0, 0, 0, 0, now.Location()),
			End:   time.Date(now.Year(), time.April, 15, 0, 0, 0, 0, now.Location()),
		},
		{
			Start: time.Date(now.Year(), time.April, 16, 0, 0, 0, 0, now.Location()),
			End:   time.Date(now.Year(), time.July, 15, 0, 0, 0, 0, now.Location()),
		},
		{
			Start: time.Date(now.Year(), time.July, 16, 0, 0, 0, 0, now.Location()),
			End:   time.Date(now.Year(), time.October, 15, 0, 0, 0, 0, now.Location()),
		},
		{
			Start: time.Date(now.Year(), time.October, 16, 0, 0, 0, 0, now.Location()),
			End:   time.Date(finalQuarterYear, time.January, 15, 0, 0, 0, 0, now.Location()),
		},
	}

	for _, window := range trueUpSubmissionWindows {
		withinWindow := false
		// Our due dates "wrap" around (i.e. can go into the next year), so we'll need to check the months different. Since January = 1 and December = 12, the checks
		// for the current month being greater or equal to the start month and less than or equal to the end month will not work.
		if window.End.Month() == time.January {
			withinWindow = (nowMonth != time.January && nowMonth >= window.Start.Month()) || nowMonth == window.End.Month()
		} else {
			withinWindow = nowMonth >= window.Start.Month() && nowMonth <= window.End.Month()
		}

		// Only check the days if the current month is equal to the start or end months.
		// The dates of the middle month(s) don't matter so much.
		isFirstMonth := nowMonth == window.Start.Month()
		if isFirstMonth {
			withinWindow = withinWindow && nowDay >= window.Start.Day()
		}
		isFinalMonth := nowMonth == window.End.Month()
		if isFinalMonth {
			withinWindow = withinWindow && nowDay <= window.End.Day()
		}

		if withinWindow {
			return window.End
		}
	}

	return trueUpSubmissionWindows[0].End
}

func IsTrueUpReviewDueDateWithinTheNext30Days(now time.Time, dueDate time.Time) bool {
	dueDateWindow := dueDate.Add(-day * 30)

	if now.Before(dueDateWindow) || now.After(dueDate) {
		return false
	}

	return true
}
