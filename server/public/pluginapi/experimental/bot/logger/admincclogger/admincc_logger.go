package admincclogger

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/logger"
	"github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/poster"
	"github.com/mattermost/mattermost/server/public/pluginapi/experimental/common"
)

type adminCCLogger struct {
	logger.Logger
	dmer           poster.DMer
	logLevel       logger.LogLevel
	includeContext bool
	userIDs        []string
}

/*
New promotes the provided logger into a admin cc logger, sending direct messages to all the admin
ids provided through the dmer provided, about all events below the logLevel. If logVerbose is set,
it will also send the context.

- l Logger: A logger to promote.

- dmer DMer: A DMer to send the messages to the admins.

- logLevel: The highest type of message to be stored in telemetry.

- includeContext: Whether the log context should be messaged to the admins.

- userIDs: The user IDs of the admins.
*/
func New(l logger.Logger, dmer poster.DMer, logLevel logger.LogLevel, includeContext bool, userIDs ...string) logger.Logger {
	return &adminCCLogger{
		Logger:         l,
		dmer:           dmer,
		logLevel:       logLevel,
		includeContext: includeContext,
		userIDs:        userIDs,
	}
}

// NewFromAPI creates a adminCCLogger directly from a LogAPI instead of passing a logger.
func NewFromAPI(api common.LogAPI, dmer poster.DMer, logLevel logger.LogLevel, includeContext bool, userIDs ...string) logger.Logger {
	return New(logger.New(api), dmer, logLevel, includeContext, userIDs...)
}

func (l *adminCCLogger) Debugf(format string, args ...interface{}) {
	l.Logger.Debugf(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 4 {
		l.logToAdmins("DEBUG", message)
	}
}

func (l *adminCCLogger) Errorf(format string, args ...interface{}) {
	l.Logger.Errorf(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 1 {
		l.logToAdmins("ERROR", message)
	}
}

func (l *adminCCLogger) Infof(format string, args ...interface{}) {
	l.Logger.Infof(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 3 {
		l.logToAdmins("INFO", message)
	}
}

func (l *adminCCLogger) Warnf(format string, args ...interface{}) {
	l.Logger.Warnf(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 2 {
		l.logToAdmins("WARN", message)
	}
}

func (l *adminCCLogger) logToAdmins(level, message string) {
	context := l.Context()
	if l.includeContext && len(context) > 0 {
		message += "\n" + common.JSONBlock(context)
	}
	_ = l.dmAdmins("(log " + level + ") " + message)
}

func (l *adminCCLogger) dmAdmins(format string, args ...interface{}) error {
	for _, id := range l.userIDs {
		_, err := l.dmer.DM(id, format, args)
		if err != nil {
			return err
		}
	}
	return nil
}
