// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mlog

import (
	"encoding/json"
	"fmt"
)

// defaultLog manually encodes the log to STDOUT, providing a basic, default logging implementation
// before mlog is fully configured.
func defaultLog(level, msg string, fields ...Field) {
	log := struct {
		Level   string  `json:"level"`
		Message string  `json:"msg"`
		Fields  []Field `json:"fields,omitempty"`
	}{
		level,
		msg,
		fields,
	}

	if b, err := json.Marshal(log); err != nil {
		fmt.Printf(`{"level":"error","msg":"failed to encode log message"}%s`, "\n")
	} else {
		fmt.Printf("%s\n", b)
	}
}

func defaultDebugLog(msg string, fields ...Field) {
	defaultLog("debug", msg, fields...)
}

func defaultInfoLog(msg string, fields ...Field) {
	defaultLog("info", msg, fields...)
}

func defaultWarnLog(msg string, fields ...Field) {
	defaultLog("warn", msg, fields...)
}

func defaultErrorLog(msg string, fields ...Field) {
	defaultLog("error", msg, fields...)
}

func defaultCriticalLog(msg string, fields ...Field) {
	// We map critical to error in zap, so be consistent.
	defaultLog("error", msg, fields...)
}
