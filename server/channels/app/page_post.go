// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// handlePageCommentThreadCreation creates thread entries for page comments
// Page comments are thread roots themselves (RootId = ""), so they need special handling
func (a *App) handlePageCommentThreadCreation(rctx request.CTX, post *model.Post, user *model.User, channel *model.Channel) *model.AppError {
	rctx.Logger().Debug("handlePageCommentThreadCreation called", mlog.String("post_id", post.Id), mlog.String("message", post.Message))

	// Create the Thread table entry directly for this page comment
	// Page comments have RootId = "", so they won't be picked up by updateThreadsFromPosts
	// which only queries for posts with non-empty RootId
	if err := a.createThreadEntryForPageComment(post, channel); err != nil {
		rctx.Logger().Error("Failed to create thread entry for page comment", mlog.Err(err))
		return err
	}

	// Create thread membership for the poster (auto-follow)
	if *a.Config().ServiceSettings.ThreadAutoFollow {
		_, err := a.Srv().Store().Thread().MaintainMembership(user.Id, post.Id, store.ThreadMembershipOpts{
			Following:          true,
			UpdateFollowing:    true,
			UpdateParticipants: true,
		})
		if err != nil {
			return model.NewAppError("handlePageCommentThreadCreation", "app.post.page_comment_thread.membership_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

// createThreadEntryForPageComment creates a Thread table entry for a page comment post
// This is similar to what updateThreadsFromPosts does, but for page comments which have empty RootId
func (a *App) createThreadEntryForPageComment(post *model.Post, channel *model.Channel) *model.AppError {
	thread := &model.Thread{
		PostId:       post.Id,
		ChannelId:    post.ChannelId,
		ReplyCount:   0,
		LastReplyAt:  post.CreateAt,
		Participants: model.StringArray{post.UserId},
		TeamId:       channel.TeamId,
	}

	mlog.Debug("Creating Thread entry for page comment",
		mlog.String("post_id", thread.PostId),
		mlog.String("channel_id", thread.ChannelId),
		mlog.String("team_id", thread.TeamId))

	if err := a.Srv().Store().Thread().CreateThreadForPageComment(thread); err != nil {
		mlog.Error("Failed to create thread entry for page comment", mlog.Err(err))
		return model.NewAppError("createThreadEntryForPageComment", "app.post.create_thread_entry.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	mlog.Info("Successfully created Thread entry for page comment", mlog.String("post_id", thread.PostId))
	return nil
}
