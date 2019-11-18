// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import "go.uber.org/zap"

// Made for the plugin interface, use the regular logger for other uses
type SugarLogger struct {
	wrappedLogger *Logger
	zapSugar      *zap.SugaredLogger
}

func (l *SugarLogger) Debug(msg string, keyValuePairs ...interface{}) {
	l.zapSugar.Debugw(msg, keyValuePairs...)
}

func (l *SugarLogger) Info(msg string, keyValuePairs ...interface{}) {
	l.zapSugar.Infow(msg, keyValuePairs...)
}

func (l *SugarLogger) Error(msg string, keyValuePairs ...interface{}) {
	l.zapSugar.Errorw(msg, keyValuePairs...)
}

func (l *SugarLogger) Warn(msg string, keyValuePairs ...interface{}) {
	l.zapSugar.Warnw(msg, keyValuePairs...)
}
