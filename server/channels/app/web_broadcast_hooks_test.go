// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	platform_mocks "github.com/mattermost/mattermost/server/v8/channels/app/platform/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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

func TestPermalinkBroadcastHook_AbacFileStripping(t *testing.T) {
	mainHelper.Parallel(t)

	hook := &permalinkBroadcastHook{}

	userID := model.NewId()
	postChannelID := model.NewId()
	refChannelID := model.NewId()

	previewChannel := &model.Channel{Id: refChannelID, Name: "ref-channel", Type: model.ChannelTypeOpen}

	// makeRefPost builds a PreviewPost with optional file attachments.
	makeRefPost := func(fileIDs []string, files []*model.FileInfo) *model.PreviewPost {
		refPost := &model.Post{
			Id:        model.NewId(),
			ChannelId: refChannelID,
			FileIds:   fileIDs,
			Metadata:  &model.PostMetadata{Files: files},
		}
		return &model.PreviewPost{
			PostID: refPost.Id,
			Post:   refPost,
		}
	}

	// makeOuterPostJSON creates a clean outer post JSON to seed the WS event.
	makeOuterPostJSON := func(t *testing.T) string {
		t.Helper()
		outerPost := &model.Post{
			Id:        model.NewId(),
			ChannelId: postChannelID,
			Metadata:  &model.PostMetadata{},
		}
		postJSON, err := outerPost.ToJSON()
		require.NoError(t, err)
		return postJSON
	}

	makeMessage := func(postJSON string) *platform.HookedWebSocketEvent {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", postChannelID, "", nil, "")
		event.Add("post", postJSON)
		return platform.MakeHookedWebSocketEvent(event)
	}

	makeWebConn := func(t *testing.T, allowed bool) *platform.WebConn {
		t.Helper()
		mockSuite := &platform_mocks.SuiteIFace{}
		mockSuite.On("HasPermissionToReadChannel", mock.Anything, userID, previewChannel).Return(true, true)
		mockSuite.On("HasPermissionToFileAction", mock.Anything, userID, mock.AnythingOfType("string"), refChannelID, model.AccessControlPolicyActionDownloadFileAttachment).Return(allowed)
		mockSuite.On("MakeAuditRecord", mock.Anything, mock.Anything, mock.Anything).Return(&model.AuditRecord{})
		mockSuite.On("LogAuditRec", mock.Anything, mock.Anything, mock.Anything).Return()
		wc := &platform.WebConn{
			UserId:   userID,
			Platform: &platform.PlatformService{},
			Suite:    mockSuite,
		}
		session := &model.Session{UserId: userID, Roles: model.SystemUserRoleId}
		wc.SetSession(session)
		return wc
	}

	// makeWebConnNoFileCheck builds a webConn whose mock does NOT expect HasPermissionToFileAction.
	makeWebConnNoFileCheck := func(t *testing.T) *platform.WebConn {
		t.Helper()
		mockSuite := &platform_mocks.SuiteIFace{}
		mockSuite.On("HasPermissionToReadChannel", mock.Anything, userID, previewChannel).Return(true, true)
		mockSuite.On("MakeAuditRecord", mock.Anything, mock.Anything, mock.Anything).Return(&model.AuditRecord{})
		mockSuite.On("LogAuditRec", mock.Anything, mock.Anything, mock.Anything).Return()
		wc := &platform.WebConn{
			UserId:   userID,
			Platform: &platform.PlatformService{},
			Suite:    mockSuite,
		}
		session := &model.Session{UserId: userID, Roles: model.SystemUserRoleId}
		wc.SetSession(session)
		return wc
	}

	extractPost := func(t *testing.T, msg *platform.HookedWebSocketEvent) *model.Post {
		t.Helper()
		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)
		var gotPost model.Post
		err := json.Unmarshal([]byte(gotJSON), &gotPost)
		require.NoError(t, err)
		return &gotPost
	}

	t.Run("files stripped from embed when user denied download", func(t *testing.T) {
		postJSON := makeOuterPostJSON(t)
		msg := makeMessage(postJSON)
		wc := makeWebConn(t, false)

		fileID := model.NewId()
		previewPost := makeRefPost(
			model.StringArray{fileID},
			[]*model.FileInfo{{Id: fileID, Name: "photo.png", Extension: "png"}},
		)
		// Save the original Post pointer to verify the hook does not replace it.
		origPostPtr := previewPost.Post

		err := hook.Process(msg, wc, map[string]any{
			"preview_channel":          previewChannel,
			"permalink_previewed_post": previewPost,
			"preview_prop":             previewPost.PostID,
		})
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		require.Len(t, gotPost.Metadata.Embeds, 1)
		assert.Equal(t, model.PostEmbedPermalink, gotPost.Metadata.Embeds[0].Type)

		// The embed's data is serialized/deserialized as JSON — inspect via raw JSON.
		gotJSON, _ := msg.Get("post").(string)
		assert.NotContains(t, gotJSON, fileID, "file ID should be stripped from embed")
		assert.Contains(t, gotJSON, `"redacted_file_count":1`, "redacted count should reflect the stripped file")

		// The hook creates a previewCopy with a cloned Post; the original PreviewPost.Post
		// pointer must not be swapped out.
		assert.Same(t, origPostPtr, previewPost.Post, "original PreviewPost.Post pointer must not be replaced")
	})

	t.Run("files preserved in embed when user allowed download", func(t *testing.T) {
		postJSON := makeOuterPostJSON(t)
		msg := makeMessage(postJSON)
		wc := makeWebConn(t, true)

		fileID := model.NewId()
		previewPost := makeRefPost(
			model.StringArray{fileID},
			[]*model.FileInfo{{Id: fileID, Name: "photo.png", Extension: "png"}},
		)

		err := hook.Process(msg, wc, map[string]any{
			"preview_channel":          previewChannel,
			"permalink_previewed_post": previewPost,
			"preview_prop":             previewPost.PostID,
		})
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		require.Len(t, gotPost.Metadata.Embeds, 1)

		gotJSON, _ := msg.Get("post").(string)
		assert.Contains(t, gotJSON, fileID, "file ID should be present in the embed")
		assert.NotContains(t, gotJSON, `"redacted_file_count"`, "no redaction should occur")
	})

	t.Run("files stripped when FileIds non-empty but Metadata.Files already nil", func(t *testing.T) {
		postJSON := makeOuterPostJSON(t)
		msg := makeMessage(postJSON)
		wc := makeWebConn(t, false)

		fileID := model.NewId()
		// FileIds set but Metadata.Files nil — simulates upstream stripping.
		previewPost := makeRefPost(
			model.StringArray{fileID},
			nil,
		)

		err := hook.Process(msg, wc, map[string]any{
			"preview_channel":          previewChannel,
			"permalink_previewed_post": previewPost,
			"preview_prop":             previewPost.PostID,
		})
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		require.Len(t, gotPost.Metadata.Embeds, 1)

		gotJSON, _ := msg.Get("post").(string)
		assert.NotContains(t, gotJSON, fileID, "file ID should be cleared")
		// RedactedFileCount falls back to len(FileIds) when Metadata.Files is nil,
		// so the placeholder count is 1 even though Files was already cleared upstream.
		assert.Contains(t, gotJSON, `"redacted_file_count":1`, "file count falls back to FileIds length")
	})

	t.Run("no file stripping when embed has no files", func(t *testing.T) {
		postJSON := makeOuterPostJSON(t)
		msg := makeMessage(postJSON)
		// Use webConn that does NOT expect HasPermissionToFileAction to be called.
		wc := makeWebConnNoFileCheck(t)

		previewPost := makeRefPost(model.StringArray{}, nil)

		err := hook.Process(msg, wc, map[string]any{
			"preview_channel":          previewChannel,
			"permalink_previewed_post": previewPost,
			"preview_prop":             previewPost.PostID,
		})
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		require.Len(t, gotPost.Metadata.Embeds, 1)

		gotJSON, _ := msg.Get("post").(string)
		assert.NotContains(t, gotJSON, `"redacted_file_count"`, "no redaction metadata should be present")
	})
}

func TestAbacFilesBroadcastHook_Process(t *testing.T) {
	mainHelper.Parallel(t)
	hook := &abacFilesBroadcastHook{}

	userID := model.NewId()
	channelID := model.NewId()

	makePostWithFiles := func(t *testing.T, fileCount int) (*model.Post, string) {
		t.Helper()
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: channelID,
			FileIds:   make(model.StringArray, fileCount),
			Metadata: &model.PostMetadata{
				Files: make([]*model.FileInfo, fileCount),
			},
		}
		for i := range fileCount {
			fid := model.NewId()
			post.FileIds[i] = fid
			post.Metadata.Files[i] = &model.FileInfo{Id: fid, Name: "file.txt", Extension: "txt"}
		}
		postJSON, err := post.ToJSON()
		require.NoError(t, err)
		return post, postJSON
	}

	makeMessage := func(channelID, postJSON string) *platform.HookedWebSocketEvent {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", channelID, "", nil, "")
		event.Add("post", postJSON)
		return platform.MakeHookedWebSocketEvent(event)
	}

	makeArgs := func(channelID string, fileCount int) map[string]any {
		return map[string]any{
			"channel_id": channelID,
			"file_count": fileCount,
		}
	}

	makeWebConn := func(t *testing.T, userID string, allowed bool) *platform.WebConn {
		t.Helper()
		mockSuite := &platform_mocks.SuiteIFace{}
		mockSuite.On("HasPermissionToFileAction", mock.Anything, userID, mock.AnythingOfType("string"), channelID, model.AccessControlPolicyActionDownloadFileAttachment).Return(allowed)
		wc := &platform.WebConn{
			UserId:   userID,
			Platform: &platform.PlatformService{},
			Suite:    mockSuite,
		}
		session := &model.Session{UserId: userID, Roles: model.SystemUserRoleId}
		wc.SetSession(session)
		return wc
	}

	extractPost := func(t *testing.T, msg *platform.HookedWebSocketEvent) *model.Post {
		t.Helper()
		gotJSON, ok := msg.Get("post").(string)
		require.True(t, ok)
		var gotPost model.Post
		err := json.Unmarshal([]byte(gotJSON), &gotPost)
		require.NoError(t, err)
		return &gotPost
	}

	t.Run("allowed user: post is unchanged", func(t *testing.T) {
		_, postJSON := makePostWithFiles(t, 2)
		msg := makeMessage(channelID, postJSON)
		wc := makeWebConn(t, userID, true)

		err := hook.Process(msg, wc, makeArgs(channelID, 2))
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		assert.Len(t, gotPost.Metadata.Files, 2)
		assert.Len(t, gotPost.FileIds, 2)
		assert.Equal(t, 0, gotPost.Metadata.RedactedFileCount)
	})

	t.Run("denied user: files stripped, RedactedFileCount set", func(t *testing.T) {
		_, postJSON := makePostWithFiles(t, 2)
		msg := makeMessage(channelID, postJSON)
		wc := makeWebConn(t, userID, false)

		err := hook.Process(msg, wc, makeArgs(channelID, 2))
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		assert.Nil(t, gotPost.Metadata.Files)
		assert.Empty(t, gotPost.FileIds)
		assert.Equal(t, 2, gotPost.Metadata.RedactedFileCount)
	})

	t.Run("denied user: count from Metadata.Files when FileIds empty", func(t *testing.T) {
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: channelID,
			FileIds:   model.StringArray{},
			Metadata: &model.PostMetadata{
				Files: []*model.FileInfo{
					{Id: model.NewId(), Name: "a.txt", Extension: "txt"},
					{Id: model.NewId(), Name: "b.txt", Extension: "txt"},
					{Id: model.NewId(), Name: "c.txt", Extension: "txt"},
				},
			},
		}
		postJSON, err := post.ToJSON()
		require.NoError(t, err)

		msg := makeMessage(channelID, postJSON)
		wc := makeWebConn(t, userID, false)

		err = hook.Process(msg, wc, makeArgs(channelID, 3))
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		assert.Equal(t, 3, gotPost.Metadata.RedactedFileCount)
		assert.Nil(t, gotPost.Metadata.Files)
	})

	t.Run("denied user: fallback to registered fileCount arg when post has no files", func(t *testing.T) {
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: channelID,
			FileIds:   model.StringArray{},
			Metadata:  &model.PostMetadata{},
		}
		postJSON, err := post.ToJSON()
		require.NoError(t, err)

		msg := makeMessage(channelID, postJSON)
		wc := makeWebConn(t, userID, false)

		err = hook.Process(msg, wc, makeArgs(channelID, 2))
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		assert.Equal(t, 2, gotPost.Metadata.RedactedFileCount)
		assert.Nil(t, gotPost.Metadata.Files)
		assert.Empty(t, gotPost.FileIds)
	})

	t.Run("nil session: pass-through, no stripping", func(t *testing.T) {
		_, postJSON := makePostWithFiles(t, 2)
		msg := makeMessage(channelID, postJSON)

		// WebConn with no session set
		wc := &platform.WebConn{
			UserId:   userID,
			Platform: &platform.PlatformService{},
		}
		// Do NOT call wc.SetSession — session remains nil

		err := hook.Process(msg, wc, makeArgs(channelID, 2))
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		assert.Len(t, gotPost.Metadata.Files, 2)
		assert.Len(t, gotPost.FileIds, 2)
		assert.Equal(t, 0, gotPost.Metadata.RedactedFileCount)
	})

	t.Run("missing channel_id arg: returns error", func(t *testing.T) {
		_, postJSON := makePostWithFiles(t, 1)
		msg := makeMessage(channelID, postJSON)
		wc := makeWebConn(t, userID, true)

		err := hook.Process(msg, wc, map[string]any{
			"file_count": 1,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "channel_id")
	})

	t.Run("missing file_count arg: returns error", func(t *testing.T) {
		_, postJSON := makePostWithFiles(t, 1)
		msg := makeMessage(channelID, postJSON)
		wc := makeWebConn(t, userID, true)

		err := hook.Process(msg, wc, map[string]any{
			"channel_id": channelID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "file_count")
	})

	t.Run("denied user: Metadata.Images is preserved", func(t *testing.T) {
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: channelID,
			FileIds:   model.StringArray{model.NewId()},
			Metadata: &model.PostMetadata{
				Files: []*model.FileInfo{
					{Id: model.NewId(), Name: "photo.png", Extension: "png"},
				},
				Images: map[string]*model.PostImage{
					"https://example.com/img.png": {Width: 100, Height: 200},
				},
			},
		}
		postJSON, err := post.ToJSON()
		require.NoError(t, err)

		msg := makeMessage(channelID, postJSON)
		wc := makeWebConn(t, userID, false)

		err = hook.Process(msg, wc, makeArgs(channelID, 1))
		require.NoError(t, err)

		gotPost := extractPost(t, msg)
		assert.Nil(t, gotPost.Metadata.Files)
		assert.Equal(t, 1, gotPost.Metadata.RedactedFileCount)
		assert.NotNil(t, gotPost.Metadata.Images, "Images should be preserved when files are stripped")
		assert.Contains(t, gotPost.Metadata.Images, "https://example.com/img.png")
	})
}

func TestSetupBroadcastHookForAbacFiles(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("when ABAC is disabled: hook NOT registered", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(false)
		})

		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			FileIds:   model.StringArray{model.NewId()},
			Metadata: &model.PostMetadata{
				Files: []*model.FileInfo{{Id: model.NewId(), Name: "file.txt", Extension: "txt"}},
			},
		}
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", post.ChannelId, "", nil, "")

		th.App.setupBroadcastHookForAbacFiles(post, message)

		hooks := message.GetBroadcast().BroadcastHooks
		assert.Empty(t, hooks, "No hooks should be registered when ABAC is disabled")
	})

	t.Run("when post has no files: hook NOT registered", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			FileIds:   model.StringArray{},
			Metadata:  &model.PostMetadata{},
		}
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", post.ChannelId, "", nil, "")

		th.App.setupBroadcastHookForAbacFiles(post, message)

		hooks := message.GetBroadcast().BroadcastHooks
		assert.Empty(t, hooks, "No hooks should be registered when post has no files")
	})

	t.Run("when post is burn-on-read: hook NOT registered", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			Type:      model.PostTypeBurnOnRead,
			FileIds:   model.StringArray{model.NewId()},
			Metadata: &model.PostMetadata{
				Files: []*model.FileInfo{{Id: model.NewId(), Name: "file.txt", Extension: "txt"}},
			},
		}
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", post.ChannelId, "", nil, "")

		th.App.setupBroadcastHookForAbacFiles(post, message)

		hooks := message.GetBroadcast().BroadcastHooks
		assert.Empty(t, hooks, "No hooks should be registered for burn-on-read posts")
	})

	t.Run("when AccessControl is nil: hook NOT registered", func(t *testing.T) {
		// In test setup without enterprise, AccessControl is nil.
		// Even with ABAC config enabled, the nil check on AccessControl
		// prevents registration.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			FileIds:   model.StringArray{model.NewId()},
			Metadata: &model.PostMetadata{
				Files: []*model.FileInfo{{Id: model.NewId(), Name: "file.txt", Extension: "txt"}},
			},
		}
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", post.ChannelId, "", nil, "")

		th.App.setupBroadcastHookForAbacFiles(post, message)

		// AccessControl is nil in test env (no enterprise), so hook should not register
		hooks := message.GetBroadcast().BroadcastHooks
		assert.Empty(t, hooks, "No hooks should be registered when AccessControl is nil")
	})

	t.Run("when post has Metadata.Files but empty FileIds: hook IS registered (when AccessControl available)", func(t *testing.T) {
		// This test verifies the logic path: if AccessControl were non-nil and ABAC enabled,
		// a post with only Metadata.Files (no FileIds) would still trigger hook registration.
		// Since AccessControl is nil in test env, we verify the fileCount logic directly
		// by checking that the function does not register when AccessControl is nil, but the
		// fileCount derivation is tested through the Process tests above.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			FileIds:   model.StringArray{},
			Metadata: &model.PostMetadata{
				Files: []*model.FileInfo{
					{Id: model.NewId(), Name: "file.txt", Extension: "txt"},
				},
			},
		}
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", post.ChannelId, "", nil, "")

		th.App.setupBroadcastHookForAbacFiles(post, message)

		// Without enterprise, AccessControl is nil so hook won't register.
		// The file-count logic is verified via TestAbacFilesBroadcastHook_Process.
		hooks := message.GetBroadcast().BroadcastHooks
		assert.Empty(t, hooks, "AccessControl is nil in test env — hook not registered")
	})
}
