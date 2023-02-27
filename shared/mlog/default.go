// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
)

// defaultLog manually encodes the log to STDERR, providing a basic, default logging implementation
// before mlog is fully configured.
func defaultLog(level Level, msg string, fields ...Field) {
	mFields := make(map[string]string)
	buf := &bytes.Buffer{}

	for _, fld := range fields {
		buf.Reset()
		fld.ValueString(buf, shouldQuote)
		mFields[fld.Key] = buf.String()
	}

	log := struct {
		Level   string            `json:"level"`
		Message string            `json:"msg"`
		Fields  map[string]string `json:"fields,omitempty"`
	}{
		level.Name,
		msg,
		mFields,
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

func defaultCustomMultiLog(lvl []Level, msg string, fields ...Field) {
	for _, level := range lvl {
		defaultLog(level, msg, fields...)
	}
}

// shouldQuote returns true if val contains any characters that require quotations.
func shouldQuote(val string) bool {
	for _, c := range val {
		if !((c >= '0' && c <= '9') ||
			(c >= 'a' && c <= 'z') ||
			(c >= 'A' && c <= 'Z') ||
			c == '-' || c == '.' || c == '_' || c == '/' || c == '@' || c == '^' || c == '+') {
			return true
		}
	}
	return false
}
