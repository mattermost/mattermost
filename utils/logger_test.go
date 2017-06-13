// this is a new logger interface for mattermost

package utils

import (
	"context"
	"testing"
	"time"
)

func TestLevel_String(t *testing.T) {
	tests := []struct {
		name string
		l    Level
		want string
	}{
		{"Debug Test", DEBUG, "DEBUG"},
		{"Info Test", INFO, "INFO"},
		{"Error Test", ERROR, "ERROR"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.l.String(); got != tt.want {
				t.Errorf("Level.String() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLogRecord_String(t *testing.T) {
	nowUtc := time.Now().UTC()
	nowUtcIso8601 := nowUtc.Format(time.RFC3339)

	type fields struct {
		Level   Level
		Created time.Time
		Source  string
		Message string
		Context context.Context
	}
	tests := []struct {
		name   string
		fields fields
		want   string
	}{
		// TODO: this is broken. not sure if a null context even makes sense. Docs say never to pass nil in place of a Context object
		{"Nil context test", fields{INFO, nowUtc, "Some test source", "This is a test message", nil}, "{\"level\":\"INFO\",\"timestamp\":\"" + nowUtcIso8601 + "\",\"source\":\"Some test source\",\"message\":\"This is a test message\"}"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := LogRecord{
				Level:   tt.fields.Level,
				Created: tt.fields.Created,
				Source:  tt.fields.Source,
				Message: tt.fields.Message,
				Context: tt.fields.Context,
			}
			if got := r.String(); got != tt.want {
				t.Errorf("LogRecord.String() = %v, want %v", got, tt.want)
			}
		})
	}
}
