// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wiggin77/merror"
)

const (
	TestTopics = " share incident "
	TestTopic  = "share"
	NumRemotes = 50
)

func TestSendMsg(t *testing.T) {
	msgId := model.NewId()
	sendProtocol = "http"
	disablePing = true

	t.Run("No error", func(t *testing.T) {
		var countCallbacks int32
		var countWebReq int32
		merr := merror.New()

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&countWebReq, 1)
			msg, err := model.RemoteClusterMsgFromJSON(r.Body)
			if err != nil {
				merr.Append(err)
			}
			if msgId != msg.Id {
				merr.Append(fmt.Errorf("webrequest msgId expected %s, got %s", msgId, msg.Id))
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

		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		msg := makeRemoteClusterMsg(msgId, "Hello!")

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*15)
		defer cancel()

		err = service.SendOutgoingMsg(ctx, msg, func(msg *model.RemoteClusterMsg, remote *model.RemoteCluster, err error) {
			wg.Done()
			atomic.AddInt32(&countCallbacks, 1)

			if err != nil {
				merr.Append(err)
			}
			if msgId != msg.Id {
				merr.Append(fmt.Errorf("result callback msgId expected %s, got %s", msgId, msg.Id))
			}

			var m map[string]string
			err2 := json.Unmarshal(msg.Payload, &m)
			if err2 != nil {
				merr.Append(fmt.Errorf("unmarshal payload error: %w", err2))
				return
			}

			note, ok := m["note"]
			if !ok || note != "Hello!" {
				merr.Append(fmt.Errorf("compare payload failed: expected ok=true, got ok=%t;  expected 'Hello!', got %s", ok, note))
			}
		})
		assert.NoError(t, err)

		wg.Wait()

		assert.Nil(t, merr.ErrorOrNil())

		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countCallbacks))
		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countWebReq))
		t.Log(fmt.Sprintf("%d callbacks counted;  %d web requests counted;  %d expected",
			atomic.LoadInt32(&countCallbacks), atomic.LoadInt32(&countWebReq), NumRemotes))
	})

	t.Run("HTTP error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(500)
		}))
		defer ts.Close()

		mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, ts.URL))
		service, err := NewRemoteClusterService(mockServer)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		msg := makeRemoteClusterMsg(msgId, "Bogus")
		var countCallbacks int32
		var countErrors int32
		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		err = service.SendOutgoingMsg(context.Background(), msg, func(msg *model.RemoteClusterMsg, remote *model.RemoteCluster, err error) {
			wg.Done()
			atomic.AddInt32(&countCallbacks, 1)
			if err != nil {
				atomic.AddInt32(&countErrors, 1)
			}
		})
		assert.NoError(t, err)

		wg.Wait()

		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countCallbacks))
		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countErrors))
	})

	t.Run("HTTP error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(500)
		}))
		defer ts.Close()

		mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, ts.URL))
		service, err := NewRemoteClusterService(mockServer)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		msg := makeRemoteClusterMsg(msgId, "Bogus")
		var countCallbacks int32
		var countErrors int32
		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		err = service.SendOutgoingMsg(context.Background(), msg, func(msg *model.RemoteClusterMsg, remote *model.RemoteCluster, err error) {
			wg.Done()
			atomic.AddInt32(&countCallbacks, 1)
			if err != nil {
				atomic.AddInt32(&countErrors, 1)
			}
		})
		assert.NoError(t, err)

		wg.Wait()

		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countCallbacks))
		assert.Equal(t, int32(NumRemotes), atomic.LoadInt32(&countErrors))
	})
}

func makeRemoteClusters(num int, siteURL string) []*model.RemoteCluster {
	var remotes []*model.RemoteCluster
	for i := 0; i < num; i++ {
		rc := makeRemoteCluster(fmt.Sprintf("test cluster %d", i), siteURL, TestTopics)
		remotes = append(remotes, rc)
	}
	return remotes
}

func makeRemoteCluster(name string, siteURL string, topics string) *model.RemoteCluster {
	return &model.RemoteCluster{
		RemoteId:    model.NewId(),
		ClusterName: name,
		SiteURL:     siteURL,
		Token:       model.NewId(),
		Topics:      topics,
		CreateAt:    model.GetMillis(),
		LastPingAt:  model.GetMillis(),
	}
}

func makeRemoteClusterMsg(id string, note string) *model.RemoteClusterMsg {
	jsonString := fmt.Sprintf(`{"note":"%s"}`, note)
	raw := json.RawMessage(jsonString)

	return &model.RemoteClusterMsg{
		Id:       id,
		Token:    model.NewId(),
		Topic:    TestTopic,
		CreateAt: model.GetMillis(),
		Payload:  raw}
}
