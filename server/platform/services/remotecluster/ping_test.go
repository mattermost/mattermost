// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost-server/server/public/model"
)

const (
	Recent = 60000
)

func TestPing(t *testing.T) {
	disablePing = false

	t.Run("No error", func(t *testing.T) {
		var countWebReq int32
		merr := merror.New()

		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer wg.Done()
			defer w.WriteHeader(200)
			atomic.AddInt32(&countWebReq, 1)

			var frame model.RemoteClusterFrame
			err := json.NewDecoder(r.Body).Decode(&frame)
			if err != nil {
				merr.Append(err)
				return
			}
			if len(frame.Msg.Payload) == 0 {
				merr.Append(fmt.Errorf("Payload should not be empty; remote_id=%s", frame.RemoteId))
				return
			}

			var ping model.RemoteClusterPing
			err = json.Unmarshal(frame.Msg.Payload, &ping)
			if err != nil {
				merr.Append(err)
				return
			}
			if !checkRecent(ping.SentAt, Recent) {
				merr.Append(fmt.Errorf("timestamp out of range, got %d", ping.SentAt))
				return
			}
			if ping.RecvAt != 0 {
				merr.Append(fmt.Errorf("timestamp should be 0, got %d", ping.RecvAt))
				return
			}
		}))
		defer ts.Close()

		mockServer := newMockServer(makeRemoteClusters(NumRemotes, ts.URL))
		defer mockServer.Shutdown()

		service, err := NewRemoteClusterService(mockServer)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		wg.Wait()

		assert.NoError(t, merr.ErrorOrNil())

		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countWebReq))
		t.Logf("%d web requests counted;  %d expected",
			atomic.LoadInt32(&countWebReq), NumRemotes)
	})

	t.Run("HTTP errors", func(t *testing.T) {
		var countWebReq int32
		merr := merror.New()

		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer wg.Done()
			atomic.AddInt32(&countWebReq, 1)

			var frame model.RemoteClusterFrame
			err := json.NewDecoder(r.Body).Decode(&frame)
			if err != nil {
				merr.Append(err)
			}
			var ping model.RemoteClusterPing
			err = json.Unmarshal(frame.Msg.Payload, &ping)
			if err != nil {
				merr.Append(err)
			}
			if !checkRecent(ping.SentAt, Recent) {
				merr.Append(fmt.Errorf("timestamp out of range, got %d", ping.SentAt))
			}
			if ping.RecvAt != 0 {
				merr.Append(fmt.Errorf("timestamp should be 0, got %d", ping.RecvAt))
			}
			w.WriteHeader(500)
		}))
		defer ts.Close()

		mockServer := newMockServer(makeRemoteClusters(NumRemotes, ts.URL))
		defer mockServer.Shutdown()

		service, err := NewRemoteClusterService(mockServer)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		wg.Wait()

		assert.NoError(t, merr.ErrorOrNil())

		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countWebReq))
		t.Logf("%d web requests counted;  %d expected",
			atomic.LoadInt32(&countWebReq), NumRemotes)
	})
}

func checkRecent(millis int64, within int64) bool {
	now := model.GetMillis()
	return millis > now-within && millis < now+within
}
