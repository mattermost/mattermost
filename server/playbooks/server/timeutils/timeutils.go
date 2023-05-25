// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timeutils

import (
	"fmt"
	"math"
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func GetTimeForMillis(unixMillis int64) time.Time {
	return time.Unix(0, unixMillis*int64(1000000))
}

func DurationString(start, end time.Time) string {
	duration := end.Sub(start).Round(time.Second)

	if duration.Seconds() < 60 {
		return "< 1m"
	}

	if duration.Minutes() < 60 {
		return fmt.Sprintf("%.fm", math.Floor(duration.Minutes()))
	}

	if duration.Hours() < 24 {
		hours := math.Floor(duration.Hours())
		minutes := math.Mod(math.Floor(duration.Minutes()), 60)
		if minutes == 0 {
			return fmt.Sprintf("%.fh", hours)
		}
		return fmt.Sprintf("%.fh %.fm", hours, minutes)
	}

	days := math.Floor(duration.Hours() / 24)
	duration %= 24 * time.Hour
	hours := math.Floor(duration.Hours())
	minutes := math.Mod(math.Floor(duration.Minutes()), 60)
	if minutes == 0 {
		if hours == 0 {
			return fmt.Sprintf("%.fd", days)
		}
		return fmt.Sprintf("%.fd %.fh", days, hours)
	}
	if hours == 0 {
		return fmt.Sprintf("%.fd %.fm", days, minutes)
	}
	return fmt.Sprintf("%.fd %.fh %.fm", days, hours, minutes)
}

func GetUserTimezone(user *model.User) (*time.Location, error) {
	key := "automaticTimezone"
	if user.Timezone["useAutomaticTimezone"] == "false" {
		key = "manualTimezone"
	}
	return time.LoadLocation(user.Timezone[key])
}

func IsSameDay(time1, time2 time.Time) bool {
	return time1.YearDay() == time2.YearDay() && time1.Year() == time2.Year()
}

// getDaysDiff returns days difference between two date.
func GetDaysDiff(start, end time.Time) int {
	days := int(end.Sub(start).Hours() / 24)

	if start.AddDate(0, 0, days).YearDay() != end.YearDay() {
		days++
	}
	return days
}
