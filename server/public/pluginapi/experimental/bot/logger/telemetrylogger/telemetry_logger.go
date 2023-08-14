package telemetrylogger

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/plugin/experimental/bot/logger"
	"github.com/mattermost/mattermost/server/public/plugin/experimental/common"
	"github.com/mattermost/mattermost/server/public/plugin/experimental/telemetry"
)

type telemetryLogger struct {
	logger.Logger
	logLevel logger.LogLevel
	tracker  telemetry.Tracker
}

/*
New promotes the provided logger into a telemetry logger, storing all events below the logLevel
through the tracker.

- l Logger: A logger to promote.

- logLevel: The highest type of message to be stored in telemetry.

- tracker: The telemetry tracker to store the messages.
*/
func New(l logger.Logger, logLevel logger.LogLevel, tracker telemetry.Tracker) logger.Logger {
	return &telemetryLogger{
		Logger:   l,
		logLevel: logLevel,
		tracker:  tracker,
	}
}

// NewFromAPI creates a telemetryLogger directly from a LogAPI instead of passing a logger.
func NewFromAPI(api common.LogAPI, logLevel logger.LogLevel, tracker telemetry.Tracker) logger.Logger {
	return New(logger.New(api), logLevel, tracker)
}

func (l *telemetryLogger) Debugf(format string, args ...interface{}) {
	l.Logger.Debugf(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 4 {
		l.logToTelemetry("DEBUG", message)
	}
}

func (l *telemetryLogger) Errorf(format string, args ...interface{}) {
	l.Logger.Errorf(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 1 {
		l.logToTelemetry("ERROR", message)
	}
}

func (l *telemetryLogger) Infof(format string, args ...interface{}) {
	l.Logger.Infof(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 3 {
		l.logToTelemetry("INFO", message)
	}
}

func (l *telemetryLogger) Warnf(format string, args ...interface{}) {
	l.Logger.Warnf(format, args...)
	message := fmt.Sprintf(format, args...)
	if logger.Level(l.logLevel) >= 2 {
		l.logToTelemetry("WARN", message)
	}
}

func (l *telemetryLogger) logToTelemetry(level, message string) {
	properties := map[string]interface{}{}
	properties["message"] = message
	for k, v := range l.Context() {
		properties["context_"+k] = fmt.Sprintf("%v", v)
	}

	_ = l.tracker.TrackEvent("logger_"+level, properties)
}
