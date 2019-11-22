package pluginapi_test

import (
	"pluginapi"
	"testing"

	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

func TestLogrus(t *testing.T) {
	testCases := []struct {
		Level   logrus.Level
		APICall string
	}{
		{logrus.PanicLevel, "LogError"},
		{logrus.FatalLevel, "LogError"},
		{logrus.ErrorLevel, "LogError"},
		{logrus.WarnLevel, "LogWarn"},
		{logrus.InfoLevel, "LogInfo"},
		{logrus.DebugLevel, "LogDebug"},
		{logrus.TraceLevel, "LogDebug"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Level.String(), func(t *testing.T) {
			logger := logrus.New()
			logger.SetLevel(logrus.TraceLevel) // not testing logrus filtering

			api := &plugintest.API{}
			defer api.AssertExpectations(t)

			pluginapi.ConfigureLogrus(logger, api)

			// Parameter order of map is non-deterministic, so expect either.
			api.On(testCase.APICall, "message", "a", "a", "b", "1").Maybe()
			api.On(testCase.APICall, "message", "b", "1", "a", "a").Maybe()

			entry := logger.WithFields(logrus.Fields{
				"a": "a",
				"b": 1,
			})

			if testCase.Level == logrus.PanicLevel {
				done := make(chan bool)
				go func() {
					defer func() {
						r := recover()
						assert.NotNil(t, r, "expected panic")
						close(done)
					}()

					entry.Panic("message")
				}()
				<-done
			} else {
				entry.Log(testCase.Level, "message")
			}

			// Assert the required API call was executed at most once.
			api.AssertNumberOfCalls(t, testCase.APICall, 1)
		})
	}
}
