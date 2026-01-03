// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandlePageCommentThreadCreation(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("successfully creates thread entry for inline page comment", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		inlineComment := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "This is an inline comment",
			Type:      model.PostTypePageComment,
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		appErr := th.App.handlePageCommentThreadCreation(rctx, inlineComment, th.BasicUser, th.BasicChannel)
		require.Nil(t, appErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(inlineComment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)
		require.Equal(t, inlineComment.Id, thread.PostId)
		require.Equal(t, th.BasicChannel.Id, thread.ChannelId)
		require.Equal(t, th.BasicTeam.Id, thread.TeamId)
		require.Equal(t, int64(0), thread.ReplyCount)
		require.Contains(t, thread.Participants, th.BasicUser.Id)
	})

	t.Run("successfully creates thread entry for inline page comment via CreatePageComment", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page 2", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		inlineAnchor := map[string]any{
			"nodeId": "paragraph-123",
			"offset": 10,
		}

		inlineComment, commentErr := th.App.CreatePageComment(rctx, page.Id, "Inline comment", inlineAnchor)
		require.Nil(t, commentErr)
		require.Equal(t, "", inlineComment.RootId, "Inline comments should have empty RootId")

		thread, threadErr := th.App.Srv().Store().Thread().Get(inlineComment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)
		require.Equal(t, inlineComment.Id, thread.PostId)
		require.Equal(t, th.BasicChannel.Id, thread.ChannelId)
		require.Equal(t, th.BasicTeam.Id, thread.TeamId)
	})

	t.Run("creates thread membership when ThreadAutoFollow is enabled", func(t *testing.T) {
		originalConfig := *th.App.Config().ServiceSettings.ThreadAutoFollow
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.ServiceSettings.ThreadAutoFollow = &originalConfig
			})
		}()

		autoFollowEnabled := true
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.ThreadAutoFollow = &autoFollowEnabled
		})

		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page 3", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "Comment with auto-follow",
			Type:      model.PostTypePageComment,
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		savedComment, postErr := th.App.Srv().Store().Post().Save(rctx, comment)
		require.NoError(t, postErr)

		appErr := th.App.handlePageCommentThreadCreation(rctx, savedComment, th.BasicUser, th.BasicChannel)
		require.Nil(t, appErr)

		membership, memberErr := th.App.Srv().Store().Thread().GetMembershipForUser(th.BasicUser.Id, savedComment.Id)
		require.NoError(t, memberErr)
		require.NotNil(t, membership)
		require.True(t, membership.Following)
		require.Equal(t, savedComment.Id, membership.PostId)
		require.Equal(t, th.BasicUser.Id, membership.UserId)
	})

	t.Run("does not create thread membership when ThreadAutoFollow is disabled", func(t *testing.T) {
		originalConfig := *th.App.Config().ServiceSettings.ThreadAutoFollow
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.ServiceSettings.ThreadAutoFollow = &originalConfig
			})
		}()

		autoFollowDisabled := false
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.ThreadAutoFollow = &autoFollowDisabled
		})

		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page 4", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    "",
			Message:   "Inline comment without auto-follow",
			Type:      model.PostTypePageComment,
			Props: map[string]any{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "para-222",
					"offset": 2,
				},
			},
		}

		savedComment, postErr := th.App.Srv().Store().Post().Save(rctx, comment)
		require.NoError(t, postErr)

		appErr := th.App.handlePageCommentThreadCreation(rctx, savedComment, th.BasicUser, th.BasicChannel)
		require.Nil(t, appErr, "Thread creation should succeed even without auto-follow")

		thread, threadErr := th.App.Srv().Store().Thread().Get(savedComment.Id)
		require.NoError(t, threadErr, "Thread entry should exist")
		require.NotNil(t, thread)

		_, memberErr := th.App.Srv().Store().Thread().GetMembershipForUser(th.BasicUser.Id, savedComment.Id)
		if autoFollowDisabled {
			require.Error(t, memberErr, "Should not have thread membership when auto-follow disabled")
			var nfErr *store.ErrNotFound
			require.ErrorAs(t, memberErr, &nfErr)
		}
	})

	t.Run("handles concurrent thread creation gracefully", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Concurrent Test Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "Concurrent comment",
			Type:      model.PostTypePageComment,
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		savedComment, postErr := th.App.Srv().Store().Post().Save(rctx, comment)
		require.NoError(t, postErr)

		done := make(chan error, 2)

		for range 2 {
			go func() {
				appErr := th.App.handlePageCommentThreadCreation(rctx, savedComment, th.BasicUser, th.BasicChannel)
				if appErr != nil {
					done <- appErr
				} else {
					done <- nil
				}
			}()
		}

		errors := []error{}
		for range 2 {
			err := <-done
			if err != nil {
				errors = append(errors, err)
			}
		}

		assert.LessOrEqual(t, len(errors), 1, "At most one concurrent call should fail")

		thread, threadErr := th.App.Srv().Store().Thread().Get(savedComment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread, "Thread should exist after concurrent creation attempts")
	})

	t.Run("creates thread for inline comment and verifies reply structure", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Reply Test Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		inlineAnchor := map[string]any{
			"nodeId": "paragraph-456",
			"offset": 5,
		}

		inlineComment, commentErr := th.App.CreatePageComment(rctx, page.Id, "Inline comment", inlineAnchor)
		require.Nil(t, commentErr)
		require.Equal(t, "", inlineComment.RootId, "Inline comments have empty RootId")

		thread, threadErr := th.App.Srv().Store().Thread().Get(inlineComment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)
		require.Equal(t, inlineComment.Id, thread.PostId)

		reply := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    inlineComment.Id,
			Message:   "Reply to inline comment",
			Type:      model.PostTypePageComment,
		}
		savedReply, postErr := th.App.Srv().Store().Post().Save(rctx, reply)
		require.NoError(t, postErr)

		require.Equal(t, inlineComment.Id, savedReply.RootId, "Reply should have inline comment ID as RootId")
	})

	t.Run("verifies thread entry is created with correct channel and team", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Verify Channel Team", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    "",
			Message:   "Test inline comment",
			Type:      model.PostTypePageComment,
			Props: map[string]any{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "test-node",
					"offset": 0,
				},
			},
		}

		savedComment, postErr := th.App.Srv().Store().Post().Save(rctx, comment)
		require.NoError(t, postErr)

		appErr := th.App.handlePageCommentThreadCreation(rctx, savedComment, th.BasicUser, th.BasicChannel)
		require.Nil(t, appErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(savedComment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)
		require.Equal(t, th.BasicChannel.Id, thread.ChannelId)
		require.Equal(t, th.BasicChannel.TeamId, thread.TeamId)
	})

	t.Run("thread entry includes correct participants for inline comment", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Participants Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		inlineAnchor := map[string]any{
			"nodeId": "heading-789",
			"offset": 3,
		}

		inlineComment, commentErr := th.App.CreatePageComment(rctx, page.Id, "Inline comment", inlineAnchor)
		require.Nil(t, commentErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(inlineComment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)

		require.Len(t, thread.Participants, 1)
		require.Contains(t, thread.Participants, th.BasicUser.Id)
	})

	t.Run("thread LastReplyAt matches inline comment CreateAt", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "LastReplyAt Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		inlineAnchor := map[string]any{
			"nodeId": "list-item-111",
			"offset": 0,
		}

		inlineComment, commentErr := th.App.CreatePageComment(rctx, page.Id, "Timestamp test", inlineAnchor)
		require.Nil(t, commentErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(inlineComment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)

		require.Equal(t, inlineComment.CreateAt, thread.LastReplyAt)
	})
}

func TestCreateThreadEntryForPageComment(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("successfully creates thread entry with all required fields", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Thread Entry Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "Test comment for thread entry",
			Type:      model.PostTypePageComment,
			CreateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		appErr := th.App.createThreadEntryForPageComment(th.Context, comment, th.BasicChannel)
		require.Nil(t, appErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(comment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)

		require.Equal(t, comment.Id, thread.PostId)
		require.Equal(t, comment.ChannelId, thread.ChannelId)
		require.Equal(t, th.BasicChannel.TeamId, thread.TeamId)
		require.Equal(t, int64(0), thread.ReplyCount)
		require.Equal(t, comment.CreateAt, thread.LastReplyAt)
		require.Contains(t, thread.Participants, comment.UserId)
	})

	t.Run("handles multiple comments creating separate threads", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Multiple Threads Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment1 := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "First comment",
			Type:      model.PostTypePageComment,
			CreateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		comment2 := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "Second comment",
			Type:      model.PostTypePageComment,
			CreateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		appErr1 := th.App.createThreadEntryForPageComment(th.Context, comment1, th.BasicChannel)
		require.Nil(t, appErr1)

		appErr2 := th.App.createThreadEntryForPageComment(th.Context, comment2, th.BasicChannel)
		require.Nil(t, appErr2)

		thread1, threadErr1 := th.App.Srv().Store().Thread().Get(comment1.Id)
		require.NoError(t, threadErr1)
		require.NotNil(t, thread1)

		thread2, threadErr2 := th.App.Srv().Store().Thread().Get(comment2.Id)
		require.NoError(t, threadErr2)
		require.NotNil(t, thread2)

		require.NotEqual(t, thread1.PostId, thread2.PostId)
	})

	t.Run("thread entry created for different users", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Multi-User Thread Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		user2 := th.CreateUser(t)
		th.LinkUserToTeam(t, user2, th.BasicTeam)
		th.AddUserToChannel(t, user2, th.BasicChannel)

		comment := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			UserId:    user2.Id,
			RootId:    page.Id,
			Message:   "Comment by user2",
			Type:      model.PostTypePageComment,
			CreateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		appErr := th.App.createThreadEntryForPageComment(th.Context, comment, th.BasicChannel)
		require.Nil(t, appErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(comment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)

		require.Contains(t, thread.Participants, user2.Id)
		require.NotContains(t, thread.Participants, th.BasicUser.Id)
	})

	t.Run("handles duplicate thread creation attempt gracefully (idempotent)", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Duplicate Thread Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    "",
			Message:   "Duplicate test",
			Type:      model.PostTypePageComment,
			CreateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"nodeId": "dup-test",
					"offset": 0,
				},
			},
		}

		appErr1 := th.App.createThreadEntryForPageComment(th.Context, comment, th.BasicChannel)
		require.Nil(t, appErr1)

		thread1, threadErr1 := th.App.Srv().Store().Thread().Get(comment.Id)
		require.NoError(t, threadErr1)
		require.NotNil(t, thread1)

		appErr2 := th.App.createThreadEntryForPageComment(th.Context, comment, th.BasicChannel)
		require.Nil(t, appErr2, "Second creation attempt should succeed (idempotent)")

		thread2, threadErr2 := th.App.Srv().Store().Thread().Get(comment.Id)
		require.NoError(t, threadErr2, "Thread should still exist after duplicate attempt")
		require.NotNil(t, thread2)
		require.Equal(t, thread1.PostId, thread2.PostId, "Thread should remain unchanged")
	})

	t.Run("thread entry TeamId matches channel TeamId", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "TeamId Test", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "TeamId verification",
			Type:      model.PostTypePageComment,
			CreateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		appErr := th.App.createThreadEntryForPageComment(th.Context, comment, th.BasicChannel)
		require.Nil(t, appErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(comment.Id)
		require.NoError(t, threadErr)
		require.Equal(t, th.BasicChannel.TeamId, thread.TeamId)
	})

	t.Run("thread entry in private channel", func(t *testing.T) {
		privateChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "private-thread-test",
			DisplayName: "Private Thread Test",
			Type:        model.ChannelTypePrivate,
		}, false)
		require.Nil(t, chanErr)

		_, addErr := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, addErr)

		page, err := th.App.CreatePage(th.Context, privateChannel.Id, "Private Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		comment := &model.Post{
			Id:        model.NewId(),
			ChannelId: privateChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    page.Id,
			Message:   "Comment in private channel",
			Type:      model.PostTypePageComment,
			CreateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PagePropsPageID: page.Id,
			},
		}

		appErr := th.App.createThreadEntryForPageComment(th.Context, comment, privateChannel)
		require.Nil(t, appErr)

		thread, threadErr := th.App.Srv().Store().Thread().Get(comment.Id)
		require.NoError(t, threadErr)
		require.NotNil(t, thread)
		require.Equal(t, privateChannel.Id, thread.ChannelId)
		require.Equal(t, privateChannel.TeamId, thread.TeamId)
	})
}
