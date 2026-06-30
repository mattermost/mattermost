package pluginapi_test

import (
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/pluginapi"
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
			logger.ReportCaller = true

			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api, &plugintest.Driver{})

			pluginapi.ConfigureLogrus(logger, client)

			// Parameter order of map is non-deterministic, so expect either.
			api.On(testCase.APICall, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)

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
			if api.AssertNumberOfCalls(t, testCase.APICall, 1) {
				call := api.Calls[0]
				for i := 1; i < len(call.Arguments)-1; i += 2 {
					argument := call.Arguments[i]
					value := call.Arguments[i+1]

					switch argument {
					case "a":
						assert.Equal(t, "a", value, "unexpected value for a")
					case "b":
						assert.Equal(t, "1", value, "unexpected value for b")
					case "plugin_caller":
						assert.IsType(t, "string", value)
					default:
						assert.Fail(t, "unexpected argument and value", "%v: %v", argument, value)
					}
				}
			}
		})
	}
}

// TestConfigureLogrusConcurrentWithLogging guards against a data race between
// registering the hook and logging through the same logger. Run with -race.
func TestConfigureLogrusConcurrentWithLogging(t *testing.T) {
	api := &plugintest.API{}
	api.On("LogDebug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	logger := logrus.New()

	var wg sync.WaitGroup
	start := make(chan struct{})

	for range 4 {
		wg.Go(func() {
			<-start
			for range 500 {
				logger.WithField("k", "v").Debug("message")
			}
		})
	}

	wg.Go(func() {
		<-start
		for range 50 {
			pluginapi.ConfigureLogrus(logger, client)
		}
	})

	close(start)
	wg.Wait()
}
