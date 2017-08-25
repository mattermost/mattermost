// this is a new logger interface for mattermost

package logger

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

type LogMessage struct {
	Context map[string]string
	File    string
	Message string
}

// ensures that the relative path of the file that called into the logger is returned
func TestGetCallerFilename(t *testing.T) {
	filename := getCallerFilename()
	assert.Equal(t, "/platform/utils/logger/logger_test.go", filename)
}

// ensures that values can be recorded on a Context object, and that the data in question is serialized as a part of the log message
func TestSerializeContext(t *testing.T) {
	ctx := context.Background()

	expectedUserId := "some-fake-user-id"
	ctx = WithUserId(ctx, expectedUserId)

	expectedRequestId := "some-fake-request-id"
	ctx = WithRequestId(ctx, expectedRequestId)

	serialized := serializeContext(ctx)

	assert.Equal(t, map[string]string{
		"user_id":    expectedUserId,
		"request_id": expectedRequestId,
	}, serialized)
}

// ensures that an entire log message with an empty context can be properly serialized into a JSON object
func TestSerializeLogMessageEmptyContext(t *testing.T) {
	emptyContext := context.Background()

	var logMessage = "This is a log message"
	var serialized = serializeLogMessage(emptyContext, logMessage)

	var deserialized LogMessage
	json.Unmarshal([]byte(serialized), &deserialized)

	assert.Empty(t, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, logMessage, deserialized.Message)
}

// ensures that an entire log message with a populated context can be properly serialized into a JSON object
func TestSerializeLogMessagePopulatedContext(t *testing.T) {
	populatedContext := context.Background()

	populatedContext = WithRequestId(populatedContext, "foo")
	populatedContext = WithUserId(populatedContext, "bar")

	var logMessage = "This is a log message"
	var serialized = serializeLogMessage(populatedContext, logMessage)

	var deserialized LogMessage
	json.Unmarshal([]byte(serialized), &deserialized)

	assert.Equal(t, map[string]string{
		"request_id": "foo",
		"user_id":    "bar",
	}, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, logMessage, deserialized.Message)
}

// ensures that a debug message is passed through to the underlying logger as expected
func TestDebugc(t *testing.T) {
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
	var logMessage = "Some log message"
	Debugc(emptyContext, logMessage)

	// check to see that the message is logged to the underlying log system, in this case our mock method
	var deserialized LogMessage
	json.Unmarshal([]byte(capture), &deserialized)

	assert.Empty(t, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, logMessage, deserialized.Message)
}

// ensures that a debug message is passed through to the underlying logger as expected
func TestDebugf(t *testing.T) {
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
	formatString := "Some %v message"
	param := "log"
	Debugf(formatString, param)

	// check to see that the message is logged to the underlying log system, in this case our mock method
	var deserialized LogMessage
	json.Unmarshal([]byte(capture), &deserialized)

	assert.Empty(t, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, fmt.Sprintf(formatString, param), deserialized.Message)
}

// ensures that an info message is passed through to the underlying logger as expected
func TestInfoc(t *testing.T) {
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
	var logMessage = "Some log message"
	Infoc(emptyContext, logMessage)

	// check to see that the message is logged to the underlying log system, in this case our mock method
	var deserialized LogMessage
	json.Unmarshal([]byte(capture), &deserialized)

	assert.Empty(t, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, logMessage, deserialized.Message)
}

// ensures that an info message is passed through to the underlying logger as expected
func TestInfof(t *testing.T) {
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
	format := "Some %v message"
	param := "log"
	Infof(format, param)

	// check to see that the message is logged to the underlying log system, in this case our mock method
	var deserialized LogMessage
	json.Unmarshal([]byte(capture), &deserialized)

	assert.Empty(t, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, fmt.Sprintf(format, param), deserialized.Message)
}

// ensures that an error message is passed through to the underlying logger as expected
func TestErrorc(t *testing.T) {
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
	var logMessage = "Some log message"
	Errorc(emptyContext, logMessage)

	// check to see that the message is logged to the underlying log system, in this case our mock method
	var deserialized LogMessage
	json.Unmarshal([]byte(capture), &deserialized)

	assert.Empty(t, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, logMessage, deserialized.Message)
}

// ensures that an error message is passed through to the underlying logger as expected
func TestErrorf(t *testing.T) {
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
	format := "Some %v message"
	param := "log"
	Errorf(format, param)

	// check to see that the message is logged to the underlying log system, in this case our mock method
	var deserialized LogMessage
	json.Unmarshal([]byte(capture), &deserialized)

	assert.Empty(t, deserialized.Context)
	assert.Equal(t, "/platform/utils/logger/logger_test.go", deserialized.File)
	assert.Equal(t, fmt.Sprintf(format, param), deserialized.Message)
}
