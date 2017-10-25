// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// glue functions that allow logger.go to leverage log4Go to write JSON-formatted log records to a file

package logger

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/utils"
)

// newJSONLogWriter is a utility method for creating a FileLogWriter set up to
// output JSON record log messages instead of line-based ones.
func newJSONLogWriter(fname string, rotate bool) *l4g.FileLogWriter {
	return l4g.NewFileLogWriter(fname, rotate).SetFormat(
		`{"level": "%L", 
		  "timestamp": "%D %T", 
		  "source": "%S", 
		  "message": %M 
		}`).SetRotateLines(utils.LOG_ROTATE_SIZE)
}

// NewJSONFileLogger - Create a new logger with a "file" filter configured to send JSON-formatted log messages at
// or above lvl to a file with the specified filename.
func NewJSONFileLogger(lvl l4g.Level, filename string) l4g.Logger {
	return l4g.Logger{
		"file": &l4g.Filter{Level: lvl, LogWriter: newJSONLogWriter(filename, false)},
	}
}
