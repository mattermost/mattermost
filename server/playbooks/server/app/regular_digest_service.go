package app

import (
	"time"
)

func ShouldSendWeeklyDigestMessage(userInfo UserInfo, timezone *time.Location, currentTime time.Time) bool {
	if userInfo.DigestNotificationSettings.DisableWeeklyDigest {
		return false
	}

	lastSentTime := time.UnixMilli(userInfo.LastDailyTodoDMAt).In(timezone)

	currentYear, currentWeek := currentTime.ISOWeek()
	lastSentYear, lastSentWeek := lastSentTime.ISOWeek()
	isFirstLoginOfTheWeek := currentYear != lastSentYear || currentWeek != lastSentWeek

	return isFirstLoginOfTheWeek
}

func ShouldSendDailyDigestMessage(userInfo UserInfo, timezone *time.Location, currentTime time.Time) bool {
	if userInfo.DigestNotificationSettings.DisableDailyDigest {
		return false
	}
	// DM message if it's the next day and been more than an hour since the last post
	// Hat tip to Github plugin for the logic.
	lastSentTime := time.UnixMilli(userInfo.LastDailyTodoDMAt).In(timezone)

	isMoreThanOneHourPassed := currentTime.Sub(lastSentTime).Hours() >= 1

	isDifferentDay := currentTime.Day() != lastSentTime.Day() ||
		currentTime.Month() != lastSentTime.Month() ||
		currentTime.Year() != lastSentTime.Year()

	return isMoreThanOneHourPassed && isDifferentDay
}
