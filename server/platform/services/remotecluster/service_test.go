// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestService_AddTopicListener(t *testing.T) {
	var count int32

	l1 := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error {
		atomic.AddInt32(&count, 1)
		return nil
	}
	l2 := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error {
		atomic.AddInt32(&count, 1)
		return nil
	}
	l3 := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error {
		atomic.AddInt32(&count, 1)
		return nil
	}

	mockServer := newMockServer(makeRemoteClusters(NumRemotes, ""))
	defer mockServer.Shutdown()

	service, err := NewRemoteClusterService(mockServer)
	require.NoError(t, err)

	l1id := service.AddTopicListener("test", l1)
	l2id := service.AddTopicListener("test", l2)
	l3id := service.AddTopicListener("different", l3)

	listeners := service.getTopicListeners("test")
	assert.Len(t, listeners, 2)

	rc := &model.RemoteCluster{}
	msg1 := model.RemoteClusterMsg{Topic: "test"}
	msg2 := model.RemoteClusterMsg{Topic: "different"}

	service.ReceiveIncomingMsg(rc, msg1)
	assert.Equal(t, int32(2), atomic.LoadInt32(&count))

	service.ReceiveIncomingMsg(rc, msg2)
	assert.Equal(t, int32(3), atomic.LoadInt32(&count))

	service.RemoveTopicListener(l1id)
	service.ReceiveIncomingMsg(rc, msg1)
	assert.Equal(t, int32(4), atomic.LoadInt32(&count))

	service.RemoveTopicListener(l2id)
	service.ReceiveIncomingMsg(rc, msg1)
	assert.Equal(t, int32(4), atomic.LoadInt32(&count))

	service.ReceiveIncomingMsg(rc, msg2)
	assert.Equal(t, int32(5), atomic.LoadInt32(&count))

	service.RemoveTopicListener(l3id)
	service.ReceiveIncomingMsg(rc, msg1)
	service.ReceiveIncomingMsg(rc, msg2)
	assert.Equal(t, int32(5), atomic.LoadInt32(&count))

	listeners = service.getTopicListeners("test")
	assert.Empty(t, listeners)
}
