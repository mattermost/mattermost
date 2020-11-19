// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	TestTopics = " share incident "
	TestTopic  = "share"
)

func TestSendMsg(t *testing.T) {
	msgId := model.NewId()
	sendProtocol = "http"

	t.Run("No error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			msg, err := model.RemoteClusterMsgFromJSON(r.Body)
			assert.NoError(t, err)
			assert.Equal(t, msgId, msg.Id)

			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		host, port, err := parseURL(ts.URL)
		require.NoError(t, err)

		wg := sync.WaitGroup{}

		msg := makeRemoteClusterMsg(msgId, "hello!", rc.Id)
		task := sendTask{msg: msg, f: func(msg *model.RemoteClusterMsg, remote *model.RemoteCluster, err error) {
			defer wg.Done()
			assert.NoError(t, err)
			assert.Equal(t, msgId, msg.Id)

			var m map[string]string
			err2 := json.Unmarshal(msg.Payload, &m)
			assert.NoError(t, err2)

			note, ok := m["note"]
			assert.True(t, ok)
			assert.Equal(t, "Hello!", note)
		}}

		service, err := NewRemoteClusterService(&mockServer{remotes: makeRemoteClusters(host, port)})
		assert.NoError(t, err)

		wg.Add(1)

		err = service.sendMsgToRemote(rc, task)
		assert.NoError(t, err)

		wg.Wait()
	})

}

func makeRemoteClusters(host string, port int32) []*model.RemoteCluster {
	return []*model.RemoteCluster{
		makeRemoteCluster("test cluster 1", host, port, TestTopics),
		makeRemoteCluster("test cluster 2", host, port, " bogus nope "),
		makeRemoteCluster("test cluster 3", host, port, TestTopics),
	}
}

func makeRemoteCluster(name string, host string, port int32, topics string) *model.RemoteCluster {
	return &model.RemoteCluster{
		Id:          model.NewId(),
		ClusterName: name,
		Hostname:    host,
		Port:        port,
		Token:       model.NewId(),
		Topics:      topics,
		CreateAt:    model.GetMillis(),
		LastPingAt:  model.GetMillis(),
	}
}

func makeRemoteClusterMsg(id string, note string, remoteId string) *model.RemoteClusterMsg {
	jsonString := fmt.Sprintf(`{"note":"%s"}`, note)
	raw := json.RawMessage(jsonString)

	return &model.RemoteClusterMsg{
		Id:       id,
		RemoteId: remoteId,
		Token:    model.NewId(),
		Topic:    TestTopic,
		CreateAt: model.GetMillis(),
		Payload:  raw}
}

func parseURL(urlOrig string) (host string, port int32, err error) {
	u, err := url.Parse(urlOrig)
	if err != nil {
		return "", 0, err
	}

	host = u.Hostname()
	iport, err := strconv.Atoi(u.Port())
	if err != nil {
		return "", 0, err
	}
	port = int32(iport)

	return
}
