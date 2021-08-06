// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"encoding/json"
	"fmt"
	"os"
)

// defaultLog manually encodes the log to STDERR, providing a basic, default logging implementation
// before mlog is fully configured.
func defaultLog(level Level, msg string, fields ...Field) {
	log := struct {
		Level   string  `json:"level"`
		Message string  `json:"msg"`
		Fields  []Field `json:"fields,omitempty"`
	}{
		level.Name,
		msg,
		fields,
	}

	if b, err := json.Marshal(log); err != nil {
		fmt.Fprintf(os.Stderr, `{"level":"error","msg":"failed to encode log message"}%s`, "\n")
	} else {
		fmt.Fprintf(os.Stderr, "%s\n", b)
	}
}

func defaultIsLevelEnabled(level Level) bool {
	return true
}

func defaultTraceLog(msg string, fields ...Field) {
	defaultLog(LvlTrace, msg, fields...)
}

func defaultDebugLog(msg string, fields ...Field) {
	defaultLog(LvlDebug, msg, fields...)
}

func defaultInfoLog(msg string, fields ...Field) {
	defaultLog(LvlInfo, msg, fields...)
}

func defaultWarnLog(msg string, fields ...Field) {
	defaultLog(LvlWarn, msg, fields...)
}

func defaultErrorLog(msg string, fields ...Field) {
	defaultLog(LvlError, msg, fields...)
}

func defaultCriticalLog(msg string, fields ...Field) {
	defaultLog(LvlCritical, msg, fields...)
}

func defaultCustomLog(lvl Level, msg string, fields ...Field) {
	defaultLog(lvl, msg, fields...)
}

func defaultCustomMultiLog(lvl []Level, msg string, fields ...Field) {
	for _, level := range lvl {
		defaultLog(level, msg, fields...)
	}
}
