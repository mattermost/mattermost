// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/testlib"
)

func TestSharedChannelSyncForReactionActions(t *testing.T) {
	t.Run("adding a reaction in a shared channel triggers a content sync when sync service is not running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()

		th.App.srv.sharedChannelSyncService = nil
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		user := th.BasicUser

		channel := th.CreateChannel(th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(&model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
		require.Nil(t, err, "Creating a post should not error")

		reaction := &model.Reaction{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "+1",
		}

		_, err = th.App.SaveReactionForPost(reaction)
		require.Nil(t, err, "Adding a reaction should not error")
		th.TearDown() // We need to enforce teardown because reaction instrumentation happens in a goroutine

		sharedChannelClusterMessages := testCluster.SelectMessages(model.CLUSTER_EVENT_SYNC_SHARED_CHANNEL)
		assert.Len(t, sharedChannelClusterMessages, 2, "Cluster message for shared channel content sync should have been triggered")

		for i, event := range []string{model.WEBSOCKET_EVENT_POSTED, model.WEBSOCKET_EVENT_REACTION_ADDED} {
			message := *sharedChannelClusterMessages[i]
			expectedProps := map[string]string{
				"channelId": channel.Id,
				"event":     event,
			}
			assert.Equal(t, expectedProps, message.Props)
		}
	})

	t.Run("adding a reaction in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()

		remoteClusterService := newMockRemoteClusterService(nil)
		th.App.srv.sharedChannelSyncService = remoteClusterService
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		user := th.BasicUser

		channel := th.CreateChannel(th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(&model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
		require.Nil(t, err, "Creating a post should not error")

		reaction := &model.Reaction{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "+1",
		}

		_, err = th.App.SaveReactionForPost(reaction)
		require.Nil(t, err, "Adding a reaction should not error")

		th.TearDown() // We need to enforce teardown because reaction instrumentation happens in a goroutine

		sharedChannelClusterMessages := testCluster.SelectMessages(model.CLUSTER_EVENT_SYNC_SHARED_CHANNEL)
		assert.Empty(t, sharedChannelClusterMessages, "Cluster message for shared channel content sync should have not been triggered")

		assert.Len(t, remoteClusterService.notifications, 2)
		assert.Equal(t, channel.Id, remoteClusterService.notifications[0])
		assert.Equal(t, channel.Id, remoteClusterService.notifications[1])
	})

	t.Run("removing a reaction in a shared channel triggers a content sync when sync service is not running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()

		th.App.srv.sharedChannelSyncService = nil
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		user := th.BasicUser

		channel := th.CreateChannel(th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(&model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
		require.Nil(t, err, "Creating a post should not error")

		reaction := &model.Reaction{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "+1",
		}

		err = th.App.DeleteReactionForPost(reaction)
		require.Nil(t, err, "Adding a reaction should not error")
		th.TearDown() // We need to enforce teardown because reaction instrumentation happens in a goroutine

		sharedChannelClusterMessages := testCluster.SelectMessages(model.CLUSTER_EVENT_SYNC_SHARED_CHANNEL)
		assert.Len(t, sharedChannelClusterMessages, 2, "Cluster message for shared channel content sync should have been triggered")

		for i, event := range []string{model.WEBSOCKET_EVENT_POSTED, model.WEBSOCKET_EVENT_REACTION_REMOVED} {
			message := *sharedChannelClusterMessages[i]
			expectedProps := map[string]string{
				"channelId": channel.Id,
				"event":     event,
			}
			assert.Equal(t, expectedProps, message.Props)
		}
	})

	t.Run("removing a reaction in a shared channel performs a content sync when sync service is running on that node", func(t *testing.T) {
		th := Setup(t).InitBasic()

		remoteClusterService := newMockRemoteClusterService(nil)
		th.App.srv.sharedChannelSyncService = remoteClusterService
		testCluster := &testlib.FakeClusterInterface{}
		th.Server.Cluster = testCluster

		user := th.BasicUser

		channel := th.CreateChannel(th.BasicTeam, WithShared(true))

		post, err := th.App.CreatePost(&model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Hello folks",
		}, channel, false, true)
		require.Nil(t, err, "Creating a post should not error")

		reaction := &model.Reaction{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "+1",
		}

		err = th.App.DeleteReactionForPost(reaction)
		require.Nil(t, err, "Adding a reaction should not error")

		th.TearDown() // We need to enforce teardown because reaction instrumentation happens in a goroutine

		sharedChannelClusterMessages := testCluster.SelectMessages(model.CLUSTER_EVENT_SYNC_SHARED_CHANNEL)
		assert.Empty(t, sharedChannelClusterMessages, "Cluster message for shared channel content sync should have not been triggered")

		assert.Len(t, remoteClusterService.notifications, 2)
		assert.Equal(t, channel.Id, remoteClusterService.notifications[0])
		assert.Equal(t, channel.Id, remoteClusterService.notifications[1])
	})
}
