// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelUnshareMsg(t *testing.T) {
	// Test that we can properly serialize and deserialize the unshare message
	channelID := model.NewId()
	remoteID := model.NewId()

	unshareMsg := channelUnshareMsg{
		ChannelId: channelID,
		RemoteId:  remoteID,
	}

	jsonData, err := json.Marshal(unshareMsg)
	require.NoError(t, err)
	require.NotEmpty(t, jsonData)

	var unmarshalledMsg channelUnshareMsg
	err = json.Unmarshal(jsonData, &unmarshalledMsg)
	require.NoError(t, err)

	assert.Equal(t, channelID, unmarshalledMsg.ChannelId)
	assert.Equal(t, remoteID, unmarshalledMsg.RemoteId)
}

func TestChannelUnshareMessageTopic(t *testing.T) {
	// Test that the channel unshare topic constant is correctly defined
	channelID := model.NewId()
	remoteID := model.NewId()

	unshareMsg := channelUnshareMsg{
		ChannelId: channelID,
		RemoteId:  remoteID,
	}

	jsonData, err := json.Marshal(unshareMsg)
	require.NoError(t, err)

	assert.Equal(t, "sharedchannel_unshare", TopicChannelUnshare)
	assert.NotEmpty(t, jsonData)
}

func TestSendChannelUnshare(t *testing.T) {
	t.Run("no remote cluster service", func(t *testing.T) {
		// Minimal setup to test when remote cluster service is not available
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockServer.On("GetRemoteClusterService").Return(nil)

		scs := &Service{server: mockServer}

		// Test
		err := scs.SendChannelUnshare("channel-id", "user-id", &model.RemoteCluster{})

		// Verify
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Remote Cluster Service not enabled")
	})
}

func TestOnReceiveChannelUnshare(t *testing.T) {
	t.Run("empty payload", func(t *testing.T) {
		// Test with empty payload - should be a no-op
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)

		scs := &Service{server: mockServer}

		// Empty message
		msg := model.RemoteClusterMsg{Payload: []byte{}}
		remoteCluster := &model.RemoteCluster{}

		err := scs.onReceiveChannelUnshare(msg, remoteCluster, nil)

		// Should not error with empty payload
		assert.NoError(t, err)
	})

	t.Run("invalid payload", func(t *testing.T) {
		// Test with invalid JSON payload
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)

		scs := &Service{server: mockServer}

		// Invalid JSON
		msg := model.RemoteClusterMsg{Payload: []byte(`{"bad json`)}
		remoteCluster := &model.RemoteCluster{}

		err := scs.onReceiveChannelUnshare(msg, remoteCluster, nil)

		// Should error with invalid payload
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid channel unshare message")
	})
}
