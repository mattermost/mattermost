package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/plugin"
)

// LogService exposes methods to log to the Mattermost server log.
//
// Note that standard error is automatically sent to the Mattermost server log, and standard
// output is redirected to standard error. This service enables optional structured logging.
type LogService struct {
	api plugin.API
}

// Error logs an error message, optionally structured with alternating key, value parameters.
func (l *LogService) Error(message string, keyValuePairs ...interface{}) {
	l.api.LogError(message, keyValuePairs...)
}

// Warn logs an error message, optionally structured with alternating key, value parameters.
func (l *LogService) Warn(message string, keyValuePairs ...interface{}) {
	l.api.LogWarn(message, keyValuePairs...)
}

// Info logs an error message, optionally structured with alternating key, value parameters.
func (l *LogService) Info(message string, keyValuePairs ...interface{}) {
	l.api.LogInfo(message, keyValuePairs...)
}

// Debug logs an error message, optionally structured with alternating key, value parameters.
func (l *LogService) Debug(message string, keyValuePairs ...interface{}) {
	l.api.LogDebug(message, keyValuePairs...)
}
