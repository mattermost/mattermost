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
		comments, appErr := th.App.GetPageComments(rctx, page.Id)
		require.Nil(t, appErr)
		require.Empty(t, comments)
	})

	t.Run("get comments for page with comments", func(t *testing.T) {
		// Create comments using session context
		comment1, appErr := th.App.CreatePageComment(rctx, page.Id, "First comment", nil)
		require.Nil(t, appErr)
		require.NotNil(t, comment1)

		comment2, appErr := th.App.CreatePageComment(rctx, page.Id, "Second comment", nil)
		require.Nil(t, appErr)
		require.NotNil(t, comment2)

		comments, appErr := th.App.GetPageComments(rctx, page.Id)
		require.Nil(t, appErr)
		require.Len(t, comments, 2)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		comments, appErr := th.App.GetPageComments(rctx, model.NewId())
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

	comment, appErr := th.App.CreatePageComment(rctx, page.Id, "Comment to resolve", nil)
	require.Nil(t, appErr)

	t.Run("resolve comment successfully", func(t *testing.T) {
		resolvedComment, appErr := th.App.ResolvePageComment(th.Context, comment.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, resolvedComment)
		require.Equal(t, th.BasicUser.Id, resolvedComment.GetProp("resolved_by"))
		require.NotNil(t, resolvedComment.GetProp("resolved_at"))
	})

	t.Run("fail for non-existent comment", func(t *testing.T) {
		resolvedComment, appErr := th.App.ResolvePageComment(th.Context, model.NewId(), th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Nil(t, resolvedComment)
	})
}

func TestUnresolvePageComment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	comment, appErr := th.App.CreatePageComment(rctx, page.Id, "Comment to unresolve", nil)
	require.Nil(t, appErr)

	// First resolve it
	_, appErr = th.App.ResolvePageComment(th.Context, comment.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("unresolve comment successfully", func(t *testing.T) {
		unresolvedComment, appErr := th.App.UnresolvePageComment(th.Context, comment.Id)
		require.Nil(t, appErr)
		require.NotNil(t, unresolvedComment)
		require.Nil(t, unresolvedComment.GetProp("resolved_by"))
		require.Nil(t, unresolvedComment.GetProp("resolved_at"))
	})

	t.Run("fail for non-existent comment", func(t *testing.T) {
		unresolvedComment, appErr := th.App.UnresolvePageComment(th.Context, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, unresolvedComment)
	})
}

func TestCanResolvePageComment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	comment, appErr := th.App.CreatePageComment(rctx, page.Id, "Test comment", nil)
	require.Nil(t, appErr)

	t.Run("comment author can resolve", func(t *testing.T) {
		session := &model.Session{
			UserId: th.BasicUser.Id,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id)
		require.True(t, canResolve)
	})

	t.Run("page author can resolve", func(t *testing.T) {
		session := &model.Session{
			UserId: page.UserId,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id)
		require.True(t, canResolve)
	})
}

func TestTransformPageCommentReply(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	parentComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Parent", nil)
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
