// this is a new logger interface for mattermost

package utils

import (
	"context"
	"errors"
	"testing"
)

func Test_serializeContext(t *testing.T) {
	t.Run("Context values test", func(t *testing.T) {
		ctx := context.Background()

		expectedUserID := "some-fake-user-id"
		ctx = WithUserID(ctx, expectedUserID)

		expectedRequestID := "some-fake-request-id"
		ctx = WithRequestID(ctx, expectedRequestID)

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

func Test_serializeLogMessage(t *testing.T) {
	emptyContext := context.Background()

	populatedContext := context.Background()
	populatedContext = WithRequestID(populatedContext, "foo")
	populatedContext = WithUserID(populatedContext, "bar")

	type args struct {
		ctx     context.Context
		message string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{"Empty context test", args{emptyContext, "This is a log message"}, "{\"context\":{},\"message\":\"This is a log message\"}"},
		{"Populated context test", args{populatedContext, "This is a log message"}, "{\"context\":{\"request-id\":\"foo\",\"user-id\":\"bar\"},\"message\":\"This is a log message\"}"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := serializeLogMessage(tt.args.ctx, tt.args.message); got != tt.want {
				t.Errorf("serializeLogMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}

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
		Debug(emptyContext, "Some log message")

		// check to see that the message is logged to the underlying log system, in this case our mock method
		want := "{\"context\":{},\"message\":\"Some log message\"}"
		if capture != want {
			t.Errorf("Captured message = %v, want %v", capture, want)
		}
	})
}

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
		Info(emptyContext, "Some log message")

		// check to see that the message is logged to the underlying log system, in this case our mock method
		want := "{\"context\":{},\"message\":\"Some log message\"}"
		if capture != want {
			t.Errorf("Captured message = %v, want %v", capture, want)
		}
	})
}

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
		Error(emptyContext, "Some log message")

		// check to see that the message is logged to the underlying log system, in this case our mock method
		want := "{\"context\":{},\"message\":\"Some log message\"}"
		if capture != want {
			t.Errorf("Captured message = %v, want %v", capture, want)
		}
	})
}
