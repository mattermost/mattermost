// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

type LogEntry struct {
	Time    time.Time
	Level   string
	Message string
	Caller  string
	Fields  []mlog.Field
}

// Provide default string representation. Used by SimpleWriter
func (f LogEntry) String() string {
	var sb strings.Builder
	if !f.Time.IsZero() {
		sb.WriteString(f.Time.Format(time.RFC3339Nano))
		sb.WriteRune(' ')
	}
	if f.Level != "" {
		sb.WriteString(f.Level)
		sb.WriteRune(' ')
	}
	if f.Caller != "" {
		sb.WriteString(f.Caller)
		sb.WriteRune(' ')
	}
	for _, field := range f.Fields {
		sb.WriteString(field.Key)
		sb.WriteRune('=')
		sb.WriteString(fmt.Sprint(field.Interface))
		sb.WriteRune(' ')
	}
	if f.Message != "" {
		// If the message is multiple lines, start the whole message on a new line
		if strings.ContainsRune(f.Message, '\n') {
			sb.WriteRune('\n')
		}
		sb.WriteString(f.Message)
	}

	return sb.String()
}
