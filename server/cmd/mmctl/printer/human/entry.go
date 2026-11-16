// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type LogEntry struct {
	Time    time.Time
	Level   string
	Message string
	Caller  string
	Fields  []mlog.Field
}
