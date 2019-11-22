package pluginapi

import (
	"fmt"
	"io/ioutil"

	"github.com/mattermost/mattermost-server/plugin"
	"github.com/sirupsen/logrus"
)

// LogrusHook is a logrus.Hook for emitting plugin logs through the RPC API for inclusion in the
// server logs.
//
// To configure the default Logrus logger for use with plugin logging, simply invoke:
//
//   pluginapi.ConfigureLogrus(logrus.StandardLogger)
//
// Alternatively, construct your own logger to pass to pluginapi.ConfigureLogrus.
type LogrusHook struct {
	API plugin.API
}

// NewLogrusHook creates a new instance of LogrusHook.
func NewLogrusHook(api plugin.API) *LogrusHook {
	return &LogrusHook{
		API: api,
	}
}

// Levels allows LogrusHook to process any log level.
func (lh *LogrusHook) Levels() []logrus.Level {
	return logrus.AllLevels
}

// Fire proxies logrus entries through the plugin API at the appropriate level.
func (lh *LogrusHook) Fire(entry *logrus.Entry) error {
	fields := []interface{}{}
	for key, value := range entry.Data {
		fields = append(fields, key)
		fields = append(fields, fmt.Sprintf("%+v", value))
	}

	switch entry.Level {
	case logrus.PanicLevel, logrus.FatalLevel, logrus.ErrorLevel:
		lh.API.LogError(entry.Message, fields...)
	case logrus.WarnLevel:
		lh.API.LogWarn(entry.Message, fields...)
	case logrus.InfoLevel:
		lh.API.LogInfo(entry.Message, fields...)
	case logrus.DebugLevel, logrus.TraceLevel:
		lh.API.LogDebug(entry.Message, fields...)
	}

	return nil
}

// ConfigureLogrus configures the given logrus logger with a hook to proxy through the RPC API,
// discarding the default output to avoid duplicating the events across the standard STDOUT proxy.
func ConfigureLogrus(logger *logrus.Logger, api plugin.API) {
	hook := NewLogrusHook(api)
	logger.Hooks.Add(hook)
	logger.SetOutput(ioutil.Discard)
}
