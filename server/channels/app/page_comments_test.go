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

	page, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Test Page", "", "", th.BasicUser.Id, "", "")
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

	page, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Test Page", "", "", th.BasicUser.Id, "", "")
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

	page, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Test Page", "", "", th.BasicUser.Id, "", "")
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

	// BasicUser is the wiki creator and therefore SchemeAdmin in the wiki backing channel.
	// Create the page with BasicUser2 as author so BasicUser is neither page author nor
	// comment author, allowing us to test the wiki-admin (SchemeAdmin) resolve path separately.
	rctxUser2 := th.CreateSessionContextForUser(th.BasicUser2)
	page, appErr := th.App.CreatePage(rctxUser2, th.BasicWiki.ChannelId, "Test Page", "", "", th.BasicUser2.Id, "", "")
	require.Nil(t, appErr)

	// Create comment by BasicUser2
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
			UserId: th.BasicUser2.Id,
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id, page)
		require.True(t, canResolve, "page author should be able to resolve comments on their page")
	})

	t.Run("wiki admin can resolve", func(t *testing.T) {
		// BasicUser created the wiki. IsWikiOwner checks view_team via SessionHasPermissionToTeam,
		// which needs the session to carry team-member data — a bare UserId-only session fails that
		// lookup. Load the real team membership so the permission check resolves correctly.
		tm, appErr := th.App.GetTeamMember(th.Context, th.BasicTeam.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		session := &model.Session{
			UserId:      th.BasicUser.Id,
			TeamMembers: []*model.TeamMember{tm},
		}
		canResolve := th.App.CanResolvePageComment(th.Context, session, comment, page.Id, page)
		require.True(t, canResolve, "wiki admin should be able to resolve any comment")
	})

	t.Run("regular user cannot resolve others comment", func(t *testing.T) {
		// A user not in the wiki backing channel cannot resolve others' comments.
		regularUser := th.CreateUser(t)
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

	page, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Test Page", "", "", th.BasicUser.Id, "", "")
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
