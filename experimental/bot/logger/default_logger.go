// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package logger

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"
	"github.com/mattermost/mattermost-plugin-api/experimental/common"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

type defaultLogger struct {
	Config
	admin
	logContext LogContext
	pluginAPI  plugin.API
}

func NewLogger(c Config, api plugin.API, p poster.Poster, adminUserIDs string) Logger {
	var loggerAdmin admin = nil
	if p != nil {
		loggerAdmin = NewAdmin(adminUserIDs, p)
	}
	return &defaultLogger{
		Config:    c,
		admin:     loggerAdmin,
		pluginAPI: api,
	}
}

func (l *defaultLogger) With(logContext LogContext) Logger {
	newLogger := *l
	if len(newLogger.logContext) == 0 {
		newLogger.logContext = map[string]interface{}{}
	}
	for k, v := range logContext {
		newLogger.logContext[k] = v
	}
	return &newLogger
}

func (l *defaultLogger) Timed() Logger {
	return l.With(LogContext{
		timed: time.Now(),
	})
}

func (l *defaultLogger) Debugf(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.pluginAPI.LogDebug(message, toKeyValuePairs(l.logContext)...)
	if level(l.AdminLogLevel) >= 4 {
		l.logToAdmins("DEBUG", message)
	}
}

func (l *defaultLogger) Errorf(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.pluginAPI.LogError(message, toKeyValuePairs(l.logContext)...)
	if level(l.AdminLogLevel) >= 1 {
		l.logToAdmins("ERROR", message)
	}
}

func (l *defaultLogger) Infof(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.pluginAPI.LogInfo(message, toKeyValuePairs(l.logContext)...)
	if level(l.AdminLogLevel) >= 3 {
		l.logToAdmins("INFO", message)
	}
}

func (l *defaultLogger) Warnf(format string, args ...interface{}) {
	measure(l.logContext)
	message := fmt.Sprintf(format, args...)
	l.pluginAPI.LogWarn(message, toKeyValuePairs(l.logContext)...)
	if level(l.AdminLogLevel) >= 2 {
		l.logToAdmins("WARN", message)
	}
}

func (l *defaultLogger) logToAdmins(level, message string) {
	if l.admin == nil {
		return
	}

	if l.AdminLogVerbose && len(l.logContext) > 0 {
		message += "\n" + common.JSONBlock(l.logContext)
	}
	l.DMAdmins("(log " + level + ") " + message)
}
