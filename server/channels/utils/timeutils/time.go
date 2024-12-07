// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timeutils

import (
	"time"
)

const (
	RFC3339Milli = "2006-01-02T15:04:05.999Z07:00"
)

func FormatMillis(millis int64) string {
	return time.UnixMilli(millis).Format(RFC3339Milli)
}

func FormatDeleteAt(deleteAt int64) string {
	if 0 == deleteAt {
		return ""
	}

	return FormatMillis(deleteAt)
}
