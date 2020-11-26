// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wiggin77/merror"
)

const (
	Recent = 60000
)

func TestPing(t *testing.T) {
	sendProtocol = "http"
	disablePing = false

	t.Run("No error", func(t *testing.T) {
		var countWebReq int32
		merr := merror.New()

		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer wg.Done()
			atomic.AddInt32(&countWebReq, 1)

			ping, err := model.RemoteClusterPingFromJSON(r.Body)
			if err != nil {
				merr.Append(err)
			}
			if !checkRecent(ping.SentAt, Recent) {
				merr.Append(fmt.Errorf("timestamp out of range, got %d", ping.SentAt))
			}
			if ping.RecvAt != 0 {
				merr.Append(fmt.Errorf("timestamp should be 0, got %d", ping.RecvAt))
			}
			w.WriteHeader(200)
		}))
		defer ts.Close()

		mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, ts.URL))
		service, err := NewRemoteClusterService(mockServer)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		wg.Wait()

		assert.Nil(t, merr.ErrorOrNil())

		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countWebReq))
		t.Log(fmt.Sprintf("%d web requests counted;  %d expected",
			atomic.LoadInt32(&countWebReq), NumRemotes))
	})

	t.Run("HTTP errors", func(t *testing.T) {
		var countWebReq int32
		merr := merror.New()

		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer wg.Done()
			atomic.AddInt32(&countWebReq, 1)

			ping, err := model.RemoteClusterPingFromJSON(r.Body)
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

		mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, ts.URL))
		service, err := NewRemoteClusterService(mockServer)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		wg.Wait()

		assert.Nil(t, merr.ErrorOrNil())

		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countWebReq))
		t.Log(fmt.Sprintf("%d web requests counted;  %d expected",
			atomic.LoadInt32(&countWebReq), NumRemotes))
	})
}

func checkRecent(millis int64, within int64) bool {
	now := model.GetMillis()
	return millis > now-within && millis < now+within
}
