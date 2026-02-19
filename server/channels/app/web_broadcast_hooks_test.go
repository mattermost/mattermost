// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAddMentionsHook_Process(t *testing.T) {
	mainHelper.Parallel(t)
	hook := &addMentionsBroadcastHook{}

	userID := model.NewId()
	otherUserID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	t.Run("should add a mentions entry for the current user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["mentions"])

		err := hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{userID},
		})
		require.NoError(t, err)

		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["mentions"])
		assert.Nil(t, msg.Event().GetData()["followers"])
	})

	t.Run("should not add a mentions entry for another user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["mentions"])

		err := hook.Process(msg, webConn, map[string]any{
			"mentions": model.StringArray{otherUserID},
		})
		require.NoError(t, err)

		assert.Nil(t, msg.Event().GetData()["mentions"])
	})
}

func TestAddFollowersHook_Process(t *testing.T) {
	mainHelper.Parallel(t)
	hook := &addFollowersBroadcastHook{}

	userID := model.NewId()
	otherUserID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	t.Run("should add a followers entry for the current user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["followers"])

		err := hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{userID},
		})
		require.NoError(t, err)

		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["followers"])
	})

	t.Run("should not add a followers entry for another user", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		require.Nil(t, msg.Event().GetData()["followers"])

		err := hook.Process(msg, webConn, map[string]any{
			"followers": model.StringArray{otherUserID},
		})
		require.NoError(t, err)

		assert.Nil(t, msg.Event().GetData()["followers"])
	})
}

func TestPostedAckHook_Process(t *testing.T) {
	mainHelper.Parallel(t)
	hook := &postedAckBroadcastHook{}
	userID := model.NewId()
	webConn := &platform.WebConn{
		UserId:    userID,
		Platform:  &platform.PlatformService{},
		PostedAck: true,
	}
	webConn.Active.Store(true)
	webConn.SetSession(&model.Session{})

	t.Run("should ack if user is in the list of users to notify", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		err := hook.Process(msg, webConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeOpen,
			"users":          []string{userID},
		})
		require.NoError(t, err)

		assert.True(t, msg.Event().GetData()["should_ack"].(bool))
	})

	t.Run("should not ack if user is not in the list of users to notify", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		err := hook.Process(msg, webConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeOpen,
			"users":          []string{},
		})
		require.NoError(t, err)

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})

	t.Run("should not ack if you are the user who posted", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		err := hook.Process(msg, webConn, map[string]any{
			"posted_user_id": userID,
			"channel_type":   model.ChannelTypeOpen,
			"users":          []string{userID},
		})
		require.NoError(t, err)

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})

	t.Run("should ack if the channel is a DM", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		err := hook.Process(msg, webConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeDirect,
			"users":          []string{},
		})
		require.NoError(t, err)

		assert.True(t, msg.Event().GetData()["should_ack"].(bool))
	})

	t.Run("should not ack if posted ack is false", func(t *testing.T) {
		noAckWebConn := &platform.WebConn{
			UserId:    userID,
			Platform:  &platform.PlatformService{},
			PostedAck: false,
		}
		noAckWebConn.Active.Store(true)
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		err := hook.Process(msg, noAckWebConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeDirect,
			"users":          []string{},
		})
		require.NoError(t, err)

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})

	t.Run("should not ack if connection is not active", func(t *testing.T) {
		inactiveWebConn := &platform.WebConn{
			UserId:    userID,
			Platform:  &platform.PlatformService{},
			PostedAck: false,
		}
		inactiveWebConn.Active.Store(true)
		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

		err := hook.Process(msg, inactiveWebConn, map[string]any{
			"posted_user_id": model.NewId(),
			"channel_type":   model.ChannelTypeDirect,
			"users":          []string{},
		})
		require.NoError(t, err)

		assert.Nil(t, msg.Event().GetData()["should_ack"])
	})
}

func TestAddMentionsAndAddFollowersHooks(t *testing.T) {
	mainHelper.Parallel(t)
	addMentionsHook := &addMentionsBroadcastHook{}
	addFollowersHook := &addFollowersBroadcastHook{}

	userID := model.NewId()

	webConn := &platform.WebConn{
		UserId: userID,
	}

	msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))

	originalData := msg.Event().GetData()

	require.Nil(t, originalData["mentions"])
	require.Nil(t, originalData["followers"])

	err := addMentionsHook.Process(msg, webConn, map[string]any{
		"mentions": model.StringArray{userID},
	})
	require.NoError(t, err)

	err = addFollowersHook.Process(msg, webConn, map[string]any{
		"followers": model.StringArray{userID},
	})
	require.NoError(t, err)

	t.Run("should be able to add both mentions and followers to a single event", func(t *testing.T) {
		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["followers"])
		assert.Equal(t, `["`+userID+`"]`, msg.Event().GetData()["mentions"])
	})
}

func TestPermalinkBroadcastHook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	session, err := th.Server.Platform().CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.NoError(t, err)

	wc := &platform.WebConn{
		Platform: th.Server.Platform(),
		Suite:    th.App,
		UserId:   session.UserId,
	}
	hook := &permalinkBroadcastHook{}

	refPost := th.CreatePost(t, th.BasicChannel)
	previewPost := model.NewPreviewPost(refPost, th.BasicTeam, th.BasicChannel)

	// Create a clean post (no metadata)
	cleanPost := th.BasicPost.Clone()
	cleanPost.Metadata = &model.PostMetadata{}
	cleanJSON, err := cleanPost.ToJSON()
	require.NoError(t, err)

	wsEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, "", th.BasicPost.ChannelId, "", nil, "")
	wsEvent.Add("post", cleanJSON)

	t.Run("should add permalink metadata when user has permission", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(wsEvent)

		err = hook.Process(msg, wc, map[string]any{
			"preview_channel":          th.BasicChannel,
			"permalink_previewed_post": previewPost,
			"preview_prop":             refPost.Id,
		})
		require.NoError(t, err)

		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)

		var gotPost model.Post
		err = json.Unmarshal([]byte(gotJSON), &gotPost)
		require.NoError(t, err)

		// Verify permalink metadata was added
		assert.Equal(t, refPost.Id, gotPost.GetPreviewedPostProp())
		assert.Len(t, gotPost.Metadata.Embeds, 1)
		assert.Equal(t, model.PostEmbedPermalink, gotPost.Metadata.Embeds[0].Type)
	})

	t.Run("should not add permalink metadata when user lacks permission", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(wsEvent)

		// User does not exist, and thus won't have permission to the channel
		noPermWc := &platform.WebConn{
			Platform: th.Server.Platform(),
			Suite:    th.App,
			UserId:   "otheruser",
		}

		err = hook.Process(msg, noPermWc, map[string]any{
			"preview_channel":          th.BasicChannel,
			"permalink_previewed_post": previewPost,
			"preview_prop":             refPost.Id,
		})
		require.NoError(t, err)

		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)

		// Post should remain clean (no metadata added)
		assert.Equal(t, cleanJSON, gotJSON)
	})
}

func TestChannelMentionsBroadcastHook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	session, err := th.Server.Platform().CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.NoError(t, err)

	wc := &platform.WebConn{
		Platform: th.Server.Platform(),
		Suite:    th.App,
		UserId:   session.UserId,
	}
	hook := &channelMentionsBroadcastHook{}

	// Create a private channel that BasicUser doesn't have access to
	// Use BasicUser2 to create it so BasicUser is never added
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	// Remove BasicUser if they were added automatically
	_ = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
	// Ensure BasicUser2 is a member
	th.AddUserToChannel(t, th.BasicUser2, privateChannel)

	// Create channel mentions map with both channels
	channelMentions := map[string]any{
		th.BasicChannel.Name: map[string]any{
			"id":           th.BasicChannel.Id,
			"display_name": th.BasicChannel.DisplayName,
		},
		privateChannel.Name: map[string]any{
			"id":           privateChannel.Id,
			"display_name": privateChannel.DisplayName,
		},
	}

	// Create a clean post
	cleanPost := th.BasicPost.Clone()
	cleanPost.Metadata = &model.PostMetadata{}
	cleanJSON, err := cleanPost.ToJSON()
	require.NoError(t, err)

	wsEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, "", th.BasicPost.ChannelId, "", nil, "")
	wsEvent.Add("post", cleanJSON)

	t.Run("should filter channel mentions based on user permissions", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(wsEvent)

		err = hook.Process(msg, wc, map[string]any{
			"channel_mentions": channelMentions,
		})
		require.NoError(t, err)

		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)

		var gotPost model.Post
		err = json.Unmarshal([]byte(gotJSON), &gotPost)
		require.NoError(t, err)

		// Verify only the permitted channel mention was added
		mentions := gotPost.GetProp(model.PostPropsChannelMentions)
		require.NotNil(t, mentions)

		mentionsMap, ok := mentions.(map[string]any)
		require.True(t, ok)

		// Should have access to BasicChannel
		assert.Contains(t, mentionsMap, th.BasicChannel.Name)
		// Should NOT have access to privateChannel
		assert.NotContains(t, mentionsMap, privateChannel.Name)
	})

	t.Run("should not add channel mentions when user has no permission to any", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(wsEvent)

		// Only include the private channel
		privateOnlyMentions := map[string]any{
			privateChannel.Name: map[string]any{
				"id":           privateChannel.Id,
				"display_name": privateChannel.DisplayName,
			},
		}

		err = hook.Process(msg, wc, map[string]any{
			"channel_mentions": privateOnlyMentions,
		})
		require.NoError(t, err)

		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)

		var gotPost model.Post
		err = json.Unmarshal([]byte(gotJSON), &gotPost)
		require.NoError(t, err)

		// Should have no channel mentions
		mentions := gotPost.GetProp(model.PostPropsChannelMentions)
		assert.Nil(t, mentions)
	})

	t.Run("should accumulate with existing post metadata", func(t *testing.T) {
		// Create a post that already has some metadata (e.g., from permalink hook)
		refPost := th.CreatePost(t, th.BasicChannel)
		postWithMetadata := th.BasicPost.Clone()
		postWithMetadata.Metadata = &model.PostMetadata{
			Embeds: []*model.PostEmbed{
				{Type: model.PostEmbedPermalink, Data: model.NewPreviewPost(refPost, th.BasicTeam, th.BasicChannel)},
			},
		}
		postWithMetadataJSON, jsonErr := postWithMetadata.ToJSON()
		require.NoError(t, jsonErr)

		wsEventWithMeta := model.NewWebSocketEvent(model.WebsocketEventPosted, "", th.BasicPost.ChannelId, "", nil, "")
		wsEventWithMeta.Add("post", postWithMetadataJSON)
		msg := platform.MakeHookedWebSocketEvent(wsEventWithMeta)

		err = hook.Process(msg, wc, map[string]any{
			"channel_mentions": map[string]any{
				th.BasicChannel.Name: map[string]any{
					"id":           th.BasicChannel.Id,
					"display_name": th.BasicChannel.DisplayName,
				},
			},
		})
		require.NoError(t, err)

		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)

		var gotPost model.Post
		err = json.Unmarshal([]byte(gotJSON), &gotPost)
		require.NoError(t, err)

		// Should have BOTH the permalink embed AND channel mentions
		assert.Len(t, gotPost.Metadata.Embeds, 1, "Permalink embed should be preserved")
		assert.Equal(t, model.PostEmbedPermalink, gotPost.Metadata.Embeds[0].Type)

		mentions := gotPost.GetProp(model.PostPropsChannelMentions)
		require.NotNil(t, mentions, "Channel mentions should be added")
	})

	t.Run("should handle empty channel mentions", func(t *testing.T) {
		msg := platform.MakeHookedWebSocketEvent(wsEvent)

		err = hook.Process(msg, wc, map[string]any{
			"channel_mentions": map[string]any{},
		})
		require.NoError(t, err)

		// Should return early without error
		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)
		assert.Equal(t, cleanJSON, gotJSON)
	})
}
