// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func createMembershipSystemPost(t *testing.T, th *TestHelper, channel *model.Channel) *model.Post {
	t.Helper()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "user joined the channel",
		Type:      model.PostTypeJoinChannel,
		Props: model.StringInterface{
			"username": th.BasicUser.Username,
		},
	}

	created, _, appErr := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	require.NotNil(t, created)

	return created
}

func setChannelDisableJoinLeaveMessages(t *testing.T, th *TestHelper, channel *model.Channel, disabled bool) *model.Channel {
	t.Helper()

	patch := &model.ChannelPatch{
		DisableJoinLeaveMessages: &disabled,
	}

	updated, appErr := th.App.PatchChannel(th.Context, channel, patch, th.BasicUser.Id)
	require.Nil(t, appErr)

	return updated
}

func TestDisableJoinLeaveMessagesReadSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	membershipPost := createMembershipSystemPost(t, th, channel)
	normalPost := th.CreatePost(t, channel)

	t.Run("excludes membership posts from channel list when enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   60,
			UserId:    th.BasicUser.Id,
		})
		require.Nil(t, appErr)

		_, foundMembership := postList.Posts[membershipPost.Id]
		require.False(t, foundMembership)
		require.Contains(t, postList.Posts, normalPost.Id)
	})

	t.Run("two-way door restores visibility when disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   60,
			UserId:    th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		require.Contains(t, postList.Posts, membershipPost.Id)
	})

	t.Run("get single post returns not found when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		_, appErr := th.App.GetSinglePost(th.Context, membershipPost.Id, false)
		require.NotNil(t, appErr)
		require.Equal(t, "app.post.get.app_error", appErr.Id)
	})

	t.Run("membership posts remain in database when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		stored, err := th.App.Srv().Store().Post().GetSingle(th.Context, membershipPost.Id, false)
		require.NoError(t, err)
		require.Equal(t, model.PostTypeJoinChannel, stored.Type)
	})
}

func TestGetPostsSinceSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	membershipPost := createMembershipSystemPost(t, th, channel)
	normalPost := th.CreatePost(t, channel)

	setChannelDisableJoinLeaveMessages(t, th, channel, true)

	// Use Time: 0 to avoid the localcachelayer short-circuit, which compares
	// the cached last-post-time against options.Time and would return empty if
	// the cache pre-dates posts created during the test.
	postList, appErr := th.App.GetPostsSince(th.Context, model.GetPostsSinceOptions{
		ChannelId: channel.Id,
		Time:      0,
		UserId:    th.BasicUser.Id,
	})
	require.Nil(t, appErr)
	require.NotContains(t, postList.Posts, membershipPost.Id)
	require.Contains(t, postList.Posts, normalPost.Id)
}

func TestFlaggedPostsSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	membershipPost := createMembershipSystemPost(t, th, channel)

	preference := model.Preference{
		UserId:   th.BasicUser.Id,
		Category: model.PreferenceCategoryFlaggedPost,
		Name:     membershipPost.Id,
		Value:    "true",
	}
	err := th.App.Srv().Store().Preference().Save(model.Preferences{preference})
	require.NoError(t, err)

	t.Run("excluded from flagged posts when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		flagged, appErr := th.App.GetFlaggedPosts(th.Context, th.BasicUser.Id, 0, 10)
		require.Nil(t, appErr)
		require.NotContains(t, flagged.Order, membershipPost.Id)
	})

	t.Run("visible in flagged posts when re-enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		flagged, appErr := th.App.GetFlaggedPosts(th.Context, th.BasicUser.Id, 0, 10)
		require.Nil(t, appErr)
		require.Contains(t, flagged.Order, membershipPost.Id)
	})
}

func TestMembershipSystemPostNotificationSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	normalPost := th.CreatePost(t, channel)
	membershipPost := createMembershipSystemPost(t, th, channel)

	t.Run("suppresses membership post notifications when disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		ch, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)

		require.True(t, th.App.shouldSuppressMembershipSystemPost(th.Context, ch, membershipPost))
		require.False(t, th.App.shouldSuppressMembershipSystemPost(th.Context, ch, normalPost))
	})

	t.Run("does not suppress when enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		ch, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)

		require.False(t, th.App.shouldSuppressMembershipSystemPost(th.Context, ch, membershipPost))
	})
}

func TestFilterSuppressedMembershipPostsFromSlice(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	membershipPost := createMembershipSystemPost(t, th, channel)
	normalPost := th.CreatePost(t, channel)

	t.Run("regular posts are returned intact when suppression is disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		filtered, appErr := th.App.filterSuppressedMembershipPostsFromSlice(th.Context, []*model.Post{normalPost})
		require.Nil(t, appErr)
		require.Len(t, filtered, 1, "regular posts must not be dropped")
		require.Equal(t, normalPost.Id, filtered[0].Id)
	})

	t.Run("regular posts are returned intact when suppression is enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		filtered, appErr := th.App.filterSuppressedMembershipPostsFromSlice(th.Context, []*model.Post{normalPost})
		require.Nil(t, appErr)
		require.Len(t, filtered, 1, "regular posts must not be dropped even when suppression is on")
		require.Equal(t, normalPost.Id, filtered[0].Id)
	})

	t.Run("membership posts are removed when suppression is enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		filtered, appErr := th.App.filterSuppressedMembershipPostsFromSlice(th.Context, []*model.Post{membershipPost, normalPost})
		require.Nil(t, appErr)
		require.Len(t, filtered, 1)
		require.Equal(t, normalPost.Id, filtered[0].Id)
	})

	t.Run("membership posts are kept when suppression is disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		filtered, appErr := th.App.filterSuppressedMembershipPostsFromSlice(th.Context, []*model.Post{membershipPost, normalPost})
		require.Nil(t, appErr)
		require.Len(t, filtered, 2)
	})
}

func TestGetPostsByIdsSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	membershipPost := createMembershipSystemPost(t, th, channel)
	normalPost := th.CreatePost(t, channel)

	t.Run("returns regular posts when suppression is enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		posts, _, appErr := th.App.GetPostsByIds([]string{normalPost.Id})
		require.Nil(t, appErr)
		require.Len(t, posts, 1, "regular posts must survive GetPostsByIds when suppression is on")
		require.Equal(t, normalPost.Id, posts[0].Id)
	})

	t.Run("returns regular posts when suppression is disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		posts, _, appErr := th.App.GetPostsByIds([]string{normalPost.Id})
		require.Nil(t, appErr)
		require.Len(t, posts, 1)
		require.Equal(t, normalPost.Id, posts[0].Id)
	})

	t.Run("suppresses membership post from GetPostsByIds when enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		posts, _, appErr := th.App.GetPostsByIds([]string{membershipPost.Id})
		require.Nil(t, appErr)
		require.Len(t, posts, 0, "membership post must be suppressed")
	})

	t.Run("returns membership post from GetPostsByIds when suppression is disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		posts, _, appErr := th.App.GetPostsByIds([]string{membershipPost.Id})
		require.Nil(t, appErr)
		require.Len(t, posts, 1)
		require.Equal(t, membershipPost.Id, posts[0].Id)
	})

	t.Run("partial suppression: returns only regular post when both IDs requested with suppression enabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		posts, _, appErr := th.App.GetPostsByIds([]string{membershipPost.Id, normalPost.Id})
		require.Nil(t, appErr)
		require.Len(t, posts, 1, "only the regular post should survive")
		require.Equal(t, normalPost.Id, posts[0].Id)
	})
}

func TestGetPostThreadSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	rootPost := createMembershipSystemPost(t, th, channel)
	replyPost := th.CreatePost(t, channel)

	t.Run("membership root post excluded from thread when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		list, appErr := th.App.GetPostThread(th.Context, rootPost.Id, model.GetPostsOptions{}, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotContains(t, list.Posts, rootPost.Id)
	})

	t.Run("regular post thread visible when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		list, appErr := th.App.GetPostThread(th.Context, replyPost.Id, model.GetPostsOptions{}, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Contains(t, list.Posts, replyPost.Id)
	})

	t.Run("membership post visible in thread when suppression disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		list, appErr := th.App.GetPostThread(th.Context, rootPost.Id, model.GetPostsOptions{}, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Contains(t, list.Posts, rootPost.Id)
	})
}

func TestGetPostsBeforeAfterSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	normalPost1 := th.CreatePost(t, channel)
	membershipPost := createMembershipSystemPost(t, th, channel)
	normalPost2 := th.CreatePost(t, channel)

	t.Run("GetPostsBeforePost excludes membership posts when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		postList, appErr := th.App.GetPostsBeforePost(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			PostId:    normalPost2.Id,
			Page:      0,
			PerPage:   10,
			UserId:    th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		require.NotContains(t, postList.Posts, membershipPost.Id)
		require.Contains(t, postList.Posts, normalPost1.Id)
	})

	t.Run("GetPostsAfterPost excludes membership posts when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		postList, appErr := th.App.GetPostsAfterPost(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			PostId:    normalPost1.Id,
			Page:      0,
			PerPage:   10,
			UserId:    th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		require.NotContains(t, postList.Posts, membershipPost.Id)
		require.Contains(t, postList.Posts, normalPost2.Id)
	})
}

// TestPaginationCursorExcludesMembershipPosts covers the "Load more messages"
// bug where NextPostId/PrevPostId, computed via AddCursorIdsForPostList after
// the fetch, pointed at a membership post the read paths had already excluded
// from the response - most visibly when the excluded post was the newest or
// oldest post in the channel and burn-on-read's visibility-aware cursor lookup
// (which takes over from the plain lookups) had no membership-post exclusion
// of its own.
func TestPaginationCursorExcludesMembershipPosts(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("newest post in channel is a membership post", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		normal1 := th.CreatePost(t, channel)
		normal2 := th.CreatePost(t, channel)
		membershipPost := createMembershipSystemPost(t, th, channel)
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   60,
			UserId:    th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		require.NotContains(t, postList.Posts, membershipPost.Id)
		require.Contains(t, postList.Posts, normal1.Id)
		require.Contains(t, postList.Posts, normal2.Id)

		th.App.AddCursorIdsForPostList(postList, th.BasicUser.Id, "", "", 0, 0, 60, false)
		require.Empty(t, postList.NextPostId, "NextPostId must not reference the suppressed membership post")
	})

	t.Run("newest post in channel is a membership post, burn-on-read enabled", func(t *testing.T) {
		enableBoRFeature(th)
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableBurnOnRead = new(false) })

		channel := th.CreateChannel(t, th.BasicTeam)
		normal1 := th.CreatePost(t, channel)
		normal2 := th.CreatePost(t, channel)
		membershipPost := createMembershipSystemPost(t, th, channel)
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		postList, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   60,
			UserId:    th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		require.NotContains(t, postList.Posts, membershipPost.Id)
		require.Contains(t, postList.Posts, normal1.Id)
		require.Contains(t, postList.Posts, normal2.Id)

		th.App.AddCursorIdsForPostList(postList, th.BasicUser.Id, "", "", 0, 0, 60, false)
		require.Empty(t, postList.NextPostId, "NextPostId must not reference the suppressed membership post even with burn-on-read enabled")
	})

	t.Run("run of membership posts between two blocks of real content is paged past in one round trip", func(t *testing.T) {
		enableBoRFeature(th)
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableBurnOnRead = new(false) })

		channel := th.CreateChannel(t, th.BasicTeam)
		older := th.CreatePost(t, channel)
		for range 5 {
			createMembershipSystemPost(t, th, channel)
		}
		newer := th.CreatePost(t, channel)
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		// perPage (3) is smaller than the run of membership posts (5), so a
		// naive offset-then-filter approach would return an empty page here.
		postList, appErr := th.App.GetPostsAfterPost(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			PostId:    older.Id,
			Page:      0,
			PerPage:   3,
			UserId:    th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		require.Contains(t, postList.Posts, newer.Id)

		th.App.AddCursorIdsForPostList(postList, th.BasicUser.Id, older.Id, "", 0, 0, 3, false)
		require.Empty(t, postList.NextPostId, "no more posts exist after newer")
	})
}

func TestGetPermalinkPostSuppression(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel
	membershipPost := createMembershipSystemPost(t, th, channel)
	normalPost := th.CreatePost(t, channel)

	t.Run("membership post permalink returns not found when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		_, appErr := th.App.GetPermalinkPost(th.Context, membershipPost.Id, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "api.post_get_post_by_id.get.app_error", appErr.Id)
	})

	t.Run("regular post permalink visible when suppressed", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, true)

		perma, appErr := th.App.GetPermalinkPost(th.Context, normalPost.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, perma)
	})

	t.Run("membership post permalink visible when suppression disabled", func(t *testing.T) {
		setChannelDisableJoinLeaveMessages(t, th, channel, false)

		perma, appErr := th.App.GetPermalinkPost(th.Context, membershipPost.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, perma)
	})
}

func TestRemovePostIDFromOrder(t *testing.T) {
	t.Parallel()

	require.Equal(t, []string{"b", "c"}, removePostIDFromOrder([]string{"a", "b", "c"}, "a"))
	require.Equal(t, []string{"a", "c"}, removePostIDFromOrder([]string{"a", "b", "c"}, "b"))
	require.Equal(t, []string{"a", "b"}, removePostIDFromOrder([]string{"a", "b", "c"}, "c"))
	require.Equal(t, []string{"a", "b", "c"}, removePostIDFromOrder([]string{"a", "b", "c"}, "x"))
	require.Empty(t, removePostIDFromOrder([]string{}, "a"))
	require.Empty(t, removePostIDFromOrder(nil, "a"))
}

func TestShouldChannelExcludeMembershipSystemPostsModel(t *testing.T) {
	t.Parallel()

	disabled := &model.Channel{
		Type:                     model.ChannelTypeOpen,
		DisableJoinLeaveMessages: true,
	}
	require.True(t, model.ShouldChannelExcludeMembershipSystemPosts(disabled))

	enabled := &model.Channel{
		Type:                     model.ChannelTypeOpen,
		DisableJoinLeaveMessages: false,
	}
	require.False(t, model.ShouldChannelExcludeMembershipSystemPosts(enabled))

	sharedDisabled := &model.Channel{
		Type:                     model.ChannelTypeOpen,
		DisableJoinLeaveMessages: true,
		Shared:                   model.NewPointer(true),
	}
	require.True(t, model.ShouldChannelExcludeMembershipSystemPosts(sharedDisabled))

	sharedEnabled := &model.Channel{
		Type:                     model.ChannelTypeOpen,
		DisableJoinLeaveMessages: false,
		Shared:                   model.NewPointer(true),
	}
	require.False(t, model.ShouldChannelExcludeMembershipSystemPosts(sharedEnabled))

	direct := &model.Channel{
		Type:                     model.ChannelTypeDirect,
		DisableJoinLeaveMessages: true,
	}
	require.False(t, model.ShouldChannelExcludeMembershipSystemPosts(direct))
}
