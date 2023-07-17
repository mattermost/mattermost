// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"time"

	mm_model "github.com/mattermost/mattermost/server/public/model"
)

// GetMillis is a convenience method to get milliseconds since epoch.
func GetMillis() int64 {
	return mm_model.GetMillis()
}

// GetMillisForTime is a convenience method to get milliseconds since epoch for provided Time.
func GetMillisForTime(thisTime time.Time) int64 {
	return mm_model.GetMillisForTime(thisTime)
}

// GetTimeForMillis is a convenience method to get time.Time for milliseconds since epoch.
func GetTimeForMillis(millis int64) time.Time {
	return mm_model.GetTimeForMillis(millis)
}
