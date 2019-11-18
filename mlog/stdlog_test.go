// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mlog

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"go.uber.org/zap/zapcore"
)

func TestStdLogInterpretZapEntry(t *testing.T) {
	for _, tc := range []struct {
		testname        string
		message         string
		expectedMessage string
		expectedLevel   zapcore.Level
	}{
		{"Debug Basic", "[DEBUG]My message", "My message", zapcore.DebugLevel},
		{"Debug Basic2", "[DEBG]My message", "My message", zapcore.DebugLevel},
		{"Warn Basic", "[WARN]My message", "My message", zapcore.WarnLevel},
		{"Error Basic", "[ERROR]My message", "My message", zapcore.ErrorLevel},
		{"Error Basic2", "[EROR]My message", "My message", zapcore.ErrorLevel},
		{"Error Basic3", "[ERR]My message", "My message", zapcore.ErrorLevel},
		{"Info Basic", "[INFO]My message", "My message", zapcore.InfoLevel},
		{"Unknown level", "[UNKNOWN]My message", "[UNKNOWN]My message", zapcore.PanicLevel},
		{"No level", "My message", "My message", zapcore.PanicLevel},
		{"Empty message", "", "", zapcore.PanicLevel},
		{"Malformed level", "INFO]My message", "INFO]My message", zapcore.PanicLevel},
	} {
		t.Run(tc.testname, func(t *testing.T) {
			inEntry := zapcore.Entry{
				Level:   zapcore.PanicLevel,
				Message: tc.message,
			}
			resultEntry := stdLogInterpretZapEntry(inEntry)
			assert.Equal(t, tc.expectedMessage, resultEntry.Message)
			assert.Equal(t, tc.expectedLevel, resultEntry.Level)
		})
	}
}
