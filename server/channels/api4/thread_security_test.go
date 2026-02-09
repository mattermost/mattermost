// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// THREAD FOLLOWER SECURITY
// ----------------------------------------------------------------------------

func TestThreadFollowerPermissions(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Create a root post and a reply to establish a thread
	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "root post for thread security test",
	}
	rpost, _, err := th.Client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	// Create a reply so the thread actually exists
	reply := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "reply to create thread",
		RootId:    rpost.Id,
	}
	_, _, err = th.Client.CreatePost(context.Background(), reply)
	require.NoError(t, err)

	t.Run("Channel member can list thread followers", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+rpost.Id+"/thread/followers", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Channel member can add themselves as follower", func(t *testing.T) {
		userIds := []string{th.BasicUser.Id}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/"+rpost.Id+"/thread/followers", userIds)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Channel member can add another user as follower", func(t *testing.T) {
		// This is an IDOR concern: user can force-follow another user
		userIds := []string{th.BasicUser2.Id}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/"+rpost.Id+"/thread/followers", userIds)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Channel member can remove another users follow", func(t *testing.T) {
		// This is an IDOR concern: user can unfollow someone else
		resp, err := th.Client.DoAPIDelete(context.Background(), "/posts/"+rpost.Id+"/thread/followers/"+th.BasicUser2.Id)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Adding non-existent user as follower", func(t *testing.T) {
		userIds := []string{model.NewId()}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/"+rpost.Id+"/thread/followers", userIds)
		// Document current behavior
		if err != nil {
			// Error response is acceptable
			assert.True(t, resp.StatusCode >= 400)
		} else {
			closeIfOpen(resp, err)
		}
	})

	t.Run("Empty user_ids array returns 400", func(t *testing.T) {
		userIds := []string{}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/"+rpost.Id+"/thread/followers", userIds)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

func TestThreadFollowerOnChildPost(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Create root post and a reply
	rootPost := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "root post",
	}
	rpost, _, err := th.Client.CreatePost(context.Background(), rootPost)
	require.NoError(t, err)

	replyPost := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "reply post",
		RootId:    rpost.Id,
	}
	reply, _, err := th.Client.CreatePost(context.Background(), replyPost)
	require.NoError(t, err)

	t.Run("GET followers on child post returns error", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+reply.Id+"/thread/followers", "")
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("POST followers on child post returns error", func(t *testing.T) {
		userIds := []string{th.BasicUser.Id}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/"+reply.Id+"/thread/followers", userIds)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("DELETE follower on child post returns error", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/posts/"+reply.Id+"/thread/followers/"+th.BasicUser.Id)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

func TestThreadFollowerPrivateChannel(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Create a private channel that only user1 is in
	privateChannel := th.CreatePrivateChannel(t)

	// Create a root post in the private channel
	post := &model.Post{
		ChannelId: privateChannel.Id,
		Message:   "private channel thread",
	}
	rpost, _, err := th.SystemAdminClient.CreatePost(context.Background(), post)
	require.NoError(t, err)

	t.Run("Non-member cannot list followers in private channel thread", func(t *testing.T) {
		th.LoginBasic2(t)
		resp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+rpost.Id+"/thread/followers", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Non-member cannot add followers to private channel thread", func(t *testing.T) {
		th.LoginBasic2(t)
		userIds := []string{th.BasicUser2.Id}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/"+rpost.Id+"/thread/followers", userIds)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Non-member cannot remove followers from private channel thread", func(t *testing.T) {
		th.LoginBasic2(t)
		resp, err := th.Client.DoAPIDelete(context.Background(), "/posts/"+rpost.Id+"/thread/followers/"+th.BasicUser.Id)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestThreadFollowerNonExistentPost(t *testing.T) {
	th := Setup(t).InitBasic(t)

	fakePostId := model.NewId()

	t.Run("GET followers on non-existent post", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+fakePostId+"/thread/followers", "")
		// Should get 403 or 404, not 500
		require.Error(t, err)
		assert.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound,
			"Expected 403 or 404, got %d", resp.StatusCode)
	})

	t.Run("POST followers on non-existent post", func(t *testing.T) {
		userIds := []string{th.BasicUser.Id}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/"+fakePostId+"/thread/followers", userIds)
		require.Error(t, err)
		assert.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound,
			"Expected 403 or 404, got %d", resp.StatusCode)
	})
}

func TestThreadPatchSecurity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.CustomThreadNames = true
	})

	// Create a root post
	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "root post for patch test",
	}
	rpost, _, err := th.Client.CreatePost(context.Background(), post)
	require.NoError(t, err)

	t.Run("Patch thread returns 501 when feature disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CustomThreadNames = false
		})

		patch := model.ThreadPatch{}
		resp, err := th.Client.DoAPIPatchJSON(context.Background(), "/posts/"+rpost.Id+"/thread", patch)
		checkStatusCode(t, resp, err, http.StatusNotImplemented)

		// Re-enable for remaining tests
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CustomThreadNames = true
		})
	})

	t.Run("Patch on child post returns 400", func(t *testing.T) {
		reply := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "reply",
			RootId:    rpost.Id,
		}
		createdReply, _, err := th.Client.CreatePost(context.Background(), reply)
		require.NoError(t, err)

		patch := model.ThreadPatch{}
		resp, err := th.Client.DoAPIPatchJSON(context.Background(), "/posts/"+createdReply.Id+"/thread", patch)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Patch thread in private channel by non-member returns 403", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privPost := &model.Post{
			ChannelId: privateChannel.Id,
			Message:   "private thread",
		}
		privRpost, _, err := th.SystemAdminClient.CreatePost(context.Background(), privPost)
		require.NoError(t, err)

		th.LoginBasic2(t)
		patch := model.ThreadPatch{}
		resp, err := th.Client.DoAPIPatchJSON(context.Background(), "/posts/"+privRpost.Id+"/thread", patch)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}
