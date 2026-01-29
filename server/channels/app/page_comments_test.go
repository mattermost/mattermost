// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetPageComments(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("get comments for page with no comments", func(t *testing.T) {
		comments, appErr := th.App.GetPageComments(rctx, page.Id, 0, 200)
		require.Nil(t, appErr)
		require.Empty(t, comments)
	})

	t.Run("get comments for page with comments", func(t *testing.T) {
		// Create comments using session context
		comment1, appErr := th.App.CreatePageComment(rctx, page.Id, "First comment", nil, "", nil, nil)
		require.Nil(t, appErr)
		require.NotNil(t, comment1)

		comment2, appErr := th.App.CreatePageComment(rctx, page.Id, "Second comment", nil, "", nil, nil)
		require.Nil(t, appErr)
		require.NotNil(t, comment2)

		comments, appErr := th.App.GetPageComments(rctx, page.Id, 0, 200)
		require.Nil(t, appErr)
		require.Len(t, comments, 2)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		comments, appErr := th.App.GetPageComments(rctx, model.NewId(), 0, 200)
		require.NotNil(t, appErr)
		require.Nil(t, comments)
	})
}

func TestResolvePageComment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	comment, appErr := th.App.CreatePageComment(rctx, page.Id, "Comment to resolve", nil, "", nil, nil)
	require.Nil(t, appErr)

	t.Run("resolve comment successfully", func(t *testing.T) {
		resolvedComment, appErr := th.App.ResolvePageComment(th.Context, comment, th.BasicUser.Id, nil, nil)
		require.Nil(t, appErr)
		require.NotNil(t, resolvedComment)
		require.Equal(t, th.BasicUser.Id, resolvedComment.GetProp("resolved_by"))
		require.NotNil(t, resolvedComment.GetProp("resolved_at"))
	})
}

func TestUnresolvePageComment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	comment, appErr := th.App.CreatePageComment(rctx, page.Id, "Comment to unresolve", nil, "", nil, nil)
	require.Nil(t, appErr)

	// First resolve it
	_, appErr = th.App.ResolvePageComment(th.Context, comment, th.BasicUser.Id, nil, nil)
	require.Nil(t, appErr)

	t.Run("unresolve comment successfully", func(t *testing.T) {
		unresolvedComment, appErr := th.App.UnresolvePageComment(th.Context, comment, nil, nil)
		require.Nil(t, appErr)
		require.NotNil(t, unresolvedComment)
		require.Nil(t, unresolvedComment.GetProp("resolved_by"))
		require.Nil(t, unresolvedComment.GetProp("resolved_at"))
	})
}

func TestCanResolvePageComment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	// Create page owned by BasicUser
	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	// Create comment by BasicUser2 so we can test different scenarios
	rctxUser2 := th.CreateSessionContextForUser(th.BasicUser2)
	comment, appErr := th.App.CreatePageComment(rctxUser2, page.Id, "Test comment", nil, "", nil, nil)
	require.Nil(t, appErr)
	require.Equal(t, th.BasicUser2.Id, comment.UserId)

	t.Run("comment author can resolve", func(t *testing.T) {
		session := &model.Session{
			UserId: th.BasicUser2.Id,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id, page)
		require.True(t, canResolve, "comment author should be able to resolve their own comment")
	})

	t.Run("page author can resolve", func(t *testing.T) {
		session := &model.Session{
			UserId: th.BasicUser.Id,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id, page)
		require.True(t, canResolve, "page author should be able to resolve comments on their page")
	})

	t.Run("channel admin can resolve", func(t *testing.T) {
		// Create a new user and make them channel admin
		adminUser := th.CreateUser(t)
		th.LinkUserToTeam(t, adminUser, th.BasicTeam)
		th.AddUserToChannel(t, adminUser, th.BasicChannel)
		_, appErr := th.App.UpdateChannelMemberSchemeRoles(th.Context, th.BasicChannel.Id, adminUser.Id, false, true, true)
		require.Nil(t, appErr)

		session := &model.Session{
			UserId: adminUser.Id,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id, page)
		require.True(t, canResolve, "channel admin should be able to resolve any comment")
	})

	t.Run("regular user cannot resolve others comment", func(t *testing.T) {
		// Create a new regular user (not comment author, not page author, not admin)
		regularUser := th.CreateUser(t)
		th.LinkUserToTeam(t, regularUser, th.BasicTeam)
		th.AddUserToChannel(t, regularUser, th.BasicChannel)

		session := &model.Session{
			UserId: regularUser.Id,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id, page)
		require.False(t, canResolve, "regular user should NOT be able to resolve others' comments")
	})

	t.Run("user not in channel cannot resolve", func(t *testing.T) {
		outsideUser := th.CreateUser(t)
		session := &model.Session{
			UserId: outsideUser.Id,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id, page)
		require.False(t, canResolve, "user not in channel should NOT be able to resolve comments")
	})
}

func TestTransformPageCommentReply(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	parentComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Parent", nil, "", nil, nil)
	require.Nil(t, appErr)

	t.Run("transform reply post", func(t *testing.T) {
		replyPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Reply message",
			RootId:    parentComment.Id,
		}

		transformed := th.App.TransformPageCommentReply(th.Context, replyPost, parentComment)
		require.True(t, transformed)
		require.Equal(t, page.Id, replyPost.RootId)
	})
}
