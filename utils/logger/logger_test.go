// this is a new logger interface for mattermost

package logger

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

// ensures that creating a new instance of Logger properly records the name of the file that created it
func Test_NewLogger(t *testing.T) {
	t.Run("Logger name test", func(t *testing.T) {
		var log = NewLogger()
		var found = log.filename
		var expected = "/platform/utils/logger/logger_test.go"
		if !strings.HasSuffix(found, expected) {
			t.Errorf("Found logger suffix = %v, want %v", found, expected)
		}
	})
}

// ensures that values can be recorded on a Context object, and that the data in question is serialized as a part of the log message
func Test_serializeContext(t *testing.T) {
	t.Run("Context values test", func(t *testing.T) {
		ctx := context.Background()
		var log = NewLogger()

		expectedUserID := "some-fake-user-id"
		ctx = log.WithUserID(ctx, expectedUserID)

		expectedRequestID := "some-fake-request-id"
		ctx = log.WithRequestID(ctx, expectedRequestID)

		serialized := serializeContext(ctx)

		userID, ok := serialized["user-id"]
		if !ok {
			t.Error("UserID was not serialized")
		}
		if userID != expectedUserID {
			t.Errorf("UserID = %v, want %v", userID, expectedUserID)
		}

		requestID, ok := serialized["request-id"]
		if !ok {
			t.Error("RequestID was not serialized")
		}
		if requestID != expectedRequestID {
			t.Errorf("RequestID = %v, want %v", requestID, expectedRequestID)
		}
	})
}

// ensures that an entire log message with an empty context can be properly serialized into a JSON object
func Test_serializeLogMessage_EmptyContext(t *testing.T) {
	emptyContext := context.Background()
	var log = NewLogger()

	var logMessage = "This is a log message"
	var serialized = serializeLogMessage(emptyContext, log, logMessage)

	type LogMessage struct {
		Context map[string]string
		Logger  string
		Message string
	}
	var deserialized LogMessage
	json.Unmarshal([]byte(serialized), &deserialized)

	if len(deserialized.Context) != 0 {
		t.Error("Context is non-empty")
	}
	var expectedLoggerSuffix = "/platform/utils/logger/logger_test.go"
	if !strings.HasSuffix(deserialized.Logger, expectedLoggerSuffix) {
		t.Errorf("Invalid logger %v. Expected logger to have suffix %v", deserialized.Logger, expectedLoggerSuffix)
	}
	if deserialized.Message != logMessage {
		t.Errorf("Invalid log message %v. Expected %v", deserialized.Message, logMessage)
	}
}

// ensures that an entire log message with a populated context can be properly serialized into a JSON object
func Test_serializeLogMessage_PopulatedContext(t *testing.T) {
	populatedContext := context.Background()
	var log = NewLogger()

	populatedContext = log.WithRequestID(populatedContext, "foo")
	populatedContext = log.WithUserID(populatedContext, "bar")

	var logMessage = "This is a log message"
	var serialized = serializeLogMessage(populatedContext, log, logMessage)

	type LogMessage struct {
		Context map[string]string
		Logger  string
		Message string
	}
	var deserialized LogMessage
	json.Unmarshal([]byte(serialized), &deserialized)

	if len(deserialized.Context) != 2 {
		t.Error("Context is non-empty")
	}
	if deserialized.Context["request-id"] != "foo" {
		t.Errorf("Invalid request-id %v. Expected %v", deserialized.Context["request-id"], "foo")
	}
	if deserialized.Context["user-id"] != "bar" {
		t.Errorf("Invalid user-id %v. Expected %v", deserialized.Context["user-id"], "bar")
	}
	var expectedLoggerSuffix = "/platform/utils/logger/logger_test.go"
	if !strings.HasSuffix(deserialized.Logger, expectedLoggerSuffix) {
		t.Errorf("Invalid logger %v. Expected logger to have suffix %v", deserialized.Logger, expectedLoggerSuffix)
	}
	if deserialized.Message != logMessage {
		t.Errorf("Invalid log message %v. Expected %v", deserialized.Message, logMessage)
	}
}

// ensures that a debug message is passed through to the underlying logger as expected
func TestDebug(t *testing.T) {
	t.Run("Debug test", func(t *testing.T) {
		// inject a "mocked" debug method that captures the first argument that is passed to it
		var capture string
		oldDebug := debug
		defer func() { debug = oldDebug }()
		type WrapperType func() string
		debug = func(format interface{}, args ...interface{}) {
			// the code that we're testing passes a closure to the debug method, so we have to execute it to get the actual message back
			if f, ok := format.(func() string); ok {
				capture = WrapperType(f)()
			} else {
				t.Error("First parameter passed to Debug is not a closure")
			}
		}

		// log something
		emptyContext := context.Background()
		var log = NewLogger()

		var logMessage = "Some log message"
		log.Debug(emptyContext, logMessage)

		// check to see that the message is logged to the underlying log system, in this case our mock method
		type LogMessage struct {
			Context map[string]string
			Logger  string
			Message string
		}
		var deserialized LogMessage
		json.Unmarshal([]byte(capture), &deserialized)

		if len(deserialized.Context) != 0 {
			t.Error("Context is non-empty")
		}
		var expectedLoggerSuffix = "/platform/utils/logger/logger_test.go"
		if !strings.HasSuffix(deserialized.Logger, expectedLoggerSuffix) {
			t.Errorf("Invalid logger %v. Expected logger to have suffix %v", deserialized.Logger, expectedLoggerSuffix)
		}
		if deserialized.Message != logMessage {
			t.Errorf("Invalid log message %v. Expected %v", deserialized.Message, logMessage)
		}
	})
}

// ensures that an info message is passed through to the underlying logger as expected
func TestInfo(t *testing.T) {
	t.Run("Info test", func(t *testing.T) {
		// inject a "mocked" info method that captures the first argument that is passed to it
		var capture string
		oldInfo := info
		defer func() { info = oldInfo }()
		type WrapperType func() string
		info = func(format interface{}, args ...interface{}) {
			// the code that we're testing passes a closure to the info method, so we have to execute it to get the actual message back
			if f, ok := format.(func() string); ok {
				capture = WrapperType(f)()
			} else {
				t.Error("First parameter passed to Info is not a closure")
			}
		}

		// log something
		emptyContext := context.Background()
		var log = NewLogger()

		var logMessage = "Some log message"
		log.Info(emptyContext, logMessage)

		// check to see that the message is logged to the underlying log system, in this case our mock method
		type LogMessage struct {
			Context map[string]string
			Logger  string
			Message string
		}
		var deserialized LogMessage
		json.Unmarshal([]byte(capture), &deserialized)

		if len(deserialized.Context) != 0 {
			t.Error("Context is non-empty")
		}
		var expectedLoggerSuffix = "/platform/utils/logger/logger_test.go"
		if !strings.HasSuffix(deserialized.Logger, expectedLoggerSuffix) {
			t.Errorf("Invalid logger %v. Expected logger to have suffix %v", deserialized.Logger, expectedLoggerSuffix)
		}
		if deserialized.Message != logMessage {
			t.Errorf("Invalid log message %v. Expected %v", deserialized.Message, logMessage)
		}
	})
}

// ensures that an error message is passed through to the underlying logger as expected
func TestError(t *testing.T) {
	t.Run("Error test", func(t *testing.T) {
		// inject a "mocked" error method that captures the first argument that is passed to it
		var capture string
		oldError := err
		defer func() { err = oldError }()
		type WrapperType func() string
		err = func(format interface{}, args ...interface{}) error {
			// the code that we're testing passes a closure to the error method, so we have to execute it to get the actual message back
			if f, ok := format.(func() string); ok {
				capture = WrapperType(f)()
			} else {
				t.Error("First parameter passed to Error is not a closure")
			}

			// the code under test doesn't care about this return value
			return errors.New(capture)
		}

		// log something
		emptyContext := context.Background()
		var log = NewLogger()

		var logMessage = "Some log message"
		log.Error(emptyContext, logMessage)

		// check to see that the message is logged to the underlying log system, in this case our mock method
		type LogMessage struct {
			Context map[string]string
			Logger  string
			Message string
		}
		var deserialized LogMessage
		json.Unmarshal([]byte(capture), &deserialized)

		if len(deserialized.Context) != 0 {
			t.Error("Context is non-empty")
		}
		var expectedLoggerSuffix = "/platform/utils/logger/logger_test.go"
		if !strings.HasSuffix(deserialized.Logger, expectedLoggerSuffix) {
			t.Errorf("Invalid logger %v. Expected logger to have suffix %v", deserialized.Logger, expectedLoggerSuffix)
		}
		if deserialized.Message != logMessage {
			t.Errorf("Invalid log message %v. Expected %v", deserialized.Message, logMessage)
		}
	})
}
