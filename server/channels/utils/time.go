// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"fmt"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func MillisFromTime(t time.Time) int64 {
	return t.UnixNano() / int64(time.Millisecond)
}

func TimeFromMillis(millis int64) time.Time {
	return time.Unix(0, millis*int64(time.Millisecond))
}

func StartOfDay(t time.Time) time.Time {
	year, month, day := t.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, t.Location())
}

func EndOfDay(t time.Time) time.Time {
	year, month, day := t.Date()
	return time.Date(year, month, day, 23, 59, 59, 999999999, t.Location())
}

func Yesterday() time.Time {
	return time.Now().AddDate(0, 0, -1)
}

type FormattedPostTime struct {
	Time     time.Time
	Year     string
	Month    string
	Day      string
	Hour     string
	Minute   string
	TimeZone string
}

func GetFormattedPostTime(user *model.User, post *model.Post, useMilitaryTime bool, translateFunc i18n.TranslateFunc) FormattedPostTime {
	preferredTimezone := user.GetPreferredTimezone()
	postTime := time.Unix(post.CreateAt/1000, 0)
	zone, _ := postTime.Zone()

	localTime := postTime
	if preferredTimezone != "" {
		loc, _ := time.LoadLocation(preferredTimezone)
		if loc != nil {
			localTime = postTime.In(loc)
			zone, _ = localTime.Zone()
		}
	}

	hour := localTime.Format("15")
	period := ""
	if !useMilitaryTime {
		hour = localTime.Format("3")
		period = " " + localTime.Format("PM")
	}

	return FormattedPostTime{
		Time:     localTime,
		Year:     strconv.Itoa(localTime.Year()),
		Month:    translateFunc(localTime.Month().String()),
		Day:      strconv.Itoa(localTime.Day()),
		Hour:     hour,
		Minute:   fmt.Sprintf("%02d"+period, localTime.Minute()),
		TimeZone: zone,
	}
}
