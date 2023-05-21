// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

func mockServer() (chan []byte, *httptest.Server) {
	done := make(chan []byte, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := bytes.NewBuffer(nil)
		if _, err := io.Copy(buf, r.Body); err != nil {
			panic(err)
		}

		var v interface{}
		err := json.Unmarshal(buf.Bytes(), &v)
		if err != nil {
			panic(err)
		}

		b, err := json.MarshalIndent(v, "", "  ")
		if err != nil {
			panic(err)
		}

		// filter the identify message
		if strings.Contains(string(b), `"type": "identify"`) {
			return
		}

		done <- b
	}))

	return done, server
}

func TestTelemetry(t *testing.T) {
	receiveChan, server := mockServer()

	os.Setenv("RUDDER_KEY", "mock-test-rudder-key")
	os.Setenv("RUDDER_DATAPLANE_URL", server.URL)

	checkMockRudderServer := func(t *testing.T) {
		// check mock rudder server got
		got := string(<-receiveChan)
		require.Contains(t, got, "mockTrackerKey")
		require.Contains(t, got, "mockTrackerValue")
	}

	t.Run("Register tracker and run telemetry job", func(t *testing.T) {
		service := New("mockTelemetryID", mlog.CreateConsoleTestLogger(false, mlog.LvlDebug))
		service.RegisterTracker("mockTracker", func() (Tracker, error) {
			return map[string]interface{}{
				"mockTrackerKey": "mockTrackerValue",
			}, nil
		})

		service.RunTelemetryJob(time.Now().UnixNano() / int64(time.Millisecond))
		checkMockRudderServer(t)
	})

	t.Run("do telemetry if needed", func(t *testing.T) {
		service := New("mockTelemetryID", mlog.CreateConsoleTestLogger(false, mlog.LvlDebug))
		service.RegisterTracker("mockTracker", func() (Tracker, error) {
			return map[string]interface{}{
				"mockTrackerKey": "mockTrackerValue",
			}, nil
		})

		firstRun := time.Now()
		t.Run("Send once every 10 minutes for the first hour", func(t *testing.T) {
			service.doTelemetryIfNeeded(firstRun.Add(-30 * time.Minute))
			checkMockRudderServer(t)
		})

		t.Run("Send once every hour thereafter for the first 12 hours", func(t *testing.T) {
			// firstRun is 2 hours ago and timestampLastTelemetrySent is hour ago
			// need to do telemetry
			service.timestampLastTelemetrySent = time.Now().Add(-time.Hour)
			service.doTelemetryIfNeeded(firstRun.Add(-2 * time.Hour))
			checkMockRudderServer(t)

			// firstRun is 2 hours ago and timestampLastTelemetrySent is just now
			// no need to do telemetry
			service.doTelemetryIfNeeded(firstRun.Add(-2 * time.Hour))
			require.Equal(t, 0, len(receiveChan))
		})
		t.Run("Send at the 24 hour mark and every 24 hours after", func(t *testing.T) {
			// firstRun is 24 hours ago and timestampLastTelemetrySent is 24 hours ago
			// need to do telemetry
			service.timestampLastTelemetrySent = time.Now().Add(-24 * time.Hour)
			service.doTelemetryIfNeeded(firstRun.Add(-24 * time.Hour))
			checkMockRudderServer(t)

			// firstRun is 24 hours ago and timestampLastTelemetrySent is just now
			// no need to do telemetry
			service.doTelemetryIfNeeded(firstRun.Add(-24 * time.Hour))
			require.Equal(t, 0, len(receiveChan))
		})
	})
}
