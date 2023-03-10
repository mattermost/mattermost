// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package debugbar

import (
	"bytes"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

type DebugBarLogTarget struct {
	debugBar *DebugBar
}

type DebugBarLogFilter struct{}

func (_ *DebugBarLogFilter) GetEnabledLevel(level logr.Level) (logr.Level, bool) {
	return level, true
}

type DebugBarLogFormatter struct{}

func (_ *DebugBarLogFormatter) IsStacktraceNeeded() bool {
	return false
}

func (_ *DebugBarLogFormatter) Format(rec *logr.LogRec, level logr.Level, buf *bytes.Buffer) (*bytes.Buffer, error) {
	return bytes.NewBuffer([]byte{}), nil
}

func NewDebugBarLogTarget(debugBar *DebugBar) *DebugBarLogTarget {
	return &DebugBarLogTarget{debugBar: debugBar}
}

func (dblt *DebugBarLogTarget) Init() error {
	return nil
}

func (dblt *DebugBarLogTarget) Shutdown() error {
	return nil
}

func (dblt *DebugBarLogTarget) Write(p []byte, rec *logr.LogRec) (int, error) {
	dblt.debugBar.SendLogEvent(rec.Level().Name, rec.Msg(), dblt.fieldsToStringsMap(rec.Fields()...))
	return len(p), nil
}

func (dblt *DebugBarLogTarget) fieldsToStringsMap(fields ...mlog.Field) map[string]string {
	result := map[string]string{}
	for _, field := range fields {
		value := &bytes.Buffer{}
		field.ValueString(value, nil)
		result[field.Key] = value.String()
	}
	return result
}
