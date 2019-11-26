package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// LogService exposes methods to log to the Mattermost server log.
//
// Note that standard error is automatically sent to the Mattermost server log, and standard
// output is redirected to standard error. This service enables optional structured logging.
type LogService struct {
	api plugin.API
}

// Error logs an error message, optionally structured with alternating key, value parameters.
func (u *LogService) Error(message string, keyValuePairs ...interface{}) {
	u.api.LogError(message, keyValuePairs...)
}

// Warn logs an error message, optionally structured with alternating key, value parameters.
func (u *LogService) Warn(message string, keyValuePairs ...interface{}) {
	u.api.LogWarn(message, keyValuePairs...)
}

// Info logs an error message, optionally structured with alternating key, value parameters.
func (u *LogService) Info(message string, keyValuePairs ...interface{}) {
	u.api.LogInfo(message, keyValuePairs...)
}

// Debug logs an error message, optionally structured with alternating key, value parameters.
func (u *LogService) Debug(message string, keyValuePairs ...interface{}) {
	u.api.LogDebug(message, keyValuePairs...)
}
