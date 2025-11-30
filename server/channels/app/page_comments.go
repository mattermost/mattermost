// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"maps"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// handlePageCommentThreadCreation creates thread entries for page comments
func (a *App) handlePageCommentThreadCreation(rctx request.CTX, post *model.Post, user *model.User, channel *model.Channel) *model.AppError {
	rctx.Logger().Debug("handlePageCommentThreadCreation called", mlog.String("post_id", post.Id), mlog.String("message", post.Message))

	if err := a.createThreadEntryForPageComment(post, channel); err != nil {
		rctx.Logger().Error("Failed to create thread entry for page comment", mlog.Err(err))
		return err
	}

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

// GetPageComments retrieves all comments (including inline comments) for a page
func (a *App) GetPageComments(rctx request.CTX, pageID string) ([]*model.Post, *model.AppError) {
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.page_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	if page.Type != model.PostTypePage {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.not_a_page.app_error",
			nil, "post is not a page", http.StatusBadRequest)
	}

	postList, appErr := a.Srv().Store().Page().GetCommentsForPage(pageID, false)
	if appErr != nil {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.store_error.app_error",
			nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	comments := make([]*model.Post, 0)
	for _, postID := range postList.Order {
		if postID != pageID {
			if post, ok := postList.Posts[postID]; ok {
				comments = append(comments, post)
			}
		}
	}

	return comments, nil
}

// CreatePageComment creates a top-level comment on a page
func (a *App) CreatePageComment(rctx request.CTX, pageID, message string, inlineAnchor map[string]any) (*model.Post, *model.AppError) {
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return nil, model.NewAppError("CreatePageComment",
			"app.page.create_comment.page_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	if page.Type != model.PostTypePage {
		return nil, model.NewAppError("CreatePageComment",
			"app.page.create_comment.not_a_page.app_error",
			nil, "post is not a page", http.StatusBadRequest)
	}

	channel, chanErr := a.GetChannel(rctx, page.ChannelId)
	if chanErr != nil {
		return nil, chanErr
	}

	props := model.StringInterface{
		"page_id": pageID,
	}

	wikiID, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr == nil && wikiID != "" {
		props["wiki_id"] = wikiID
	}

	rootID := pageID
	if len(inlineAnchor) > 0 {
		props[model.PostPropsCommentType] = model.PageCommentTypeInline
		props["inline_anchor"] = inlineAnchor
		rootID = ""
	}

	comment := &model.Post{
		ChannelId: page.ChannelId,
		UserId:    rctx.Session().UserId,
		RootId:    rootID,
		Message:   message,
		Type:      model.PostTypePageComment,
		Props:     props,
	}

	createdComment, createErr := a.CreatePost(rctx, comment, channel, model.CreatePostFlags{})
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page comment created",
		mlog.String("comment_id", createdComment.Id),
		mlog.String("page_id", pageID))

	return createdComment, nil
}

// CreatePageCommentReply creates a reply to a page comment (one level of nesting only)
func (a *App) CreatePageCommentReply(rctx request.CTX, pageID, parentCommentID, message string) (*model.Post, *model.AppError) {
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil || page.Type != model.PostTypePage {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.page_not_found.app_error",
			nil, "", http.StatusNotFound)
	}

	parentComment, err := a.GetSinglePost(rctx, parentCommentID, false)
	if err != nil {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.parent_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	if parentComment.Type != model.PostTypePageComment {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.parent_not_comment.app_error",
			nil, "parent is not a page comment", http.StatusBadRequest)
	}

	if parentComment.Props["parent_comment_id"] != nil {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.reply_to_reply_not_allowed.app_error",
			nil, "Can only reply to top-level comments", http.StatusBadRequest)
	}

	channel, chanErr := a.GetChannel(rctx, page.ChannelId)
	if chanErr != nil {
		return nil, chanErr
	}

	rootID := pageID
	if parentComment.Props[model.PostPropsCommentType] == model.PageCommentTypeInline {
		rootID = parentCommentID
	}

	replyProps := model.StringInterface{
		"page_id":           pageID,
		"parent_comment_id": parentCommentID,
	}

	wikiID, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr == nil && wikiID != "" {
		replyProps["wiki_id"] = wikiID
	}

	reply := &model.Post{
		ChannelId: page.ChannelId,
		UserId:    rctx.Session().UserId,
		RootId:    rootID,
		Message:   message,
		Type:      model.PostTypePageComment,
		Props:     replyProps,
	}

	createdReply, createErr := a.CreatePost(rctx, reply, channel, model.CreatePostFlags{})
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page comment reply created",
		mlog.String("reply_id", createdReply.Id),
		mlog.String("page_id", pageID),
		mlog.String("parent_comment_id", parentCommentID))

	return createdReply, nil
}

// TransformPageCommentReply transforms a post structure when replying to a page comment
func (a *App) TransformPageCommentReply(rctx request.CTX, post *model.Post, parentComment *model.Post) bool {
	if parentComment.Type != model.PostTypePageComment {
		return false
	}

	parentCommentID := post.RootId
	pageID, _ := parentComment.Props["page_id"].(string)

	if parentComment.Props["parent_comment_id"] != nil {
		return false
	}

	rootID := pageID
	if parentComment.Props[model.PostPropsCommentType] == model.PageCommentTypeInline {
		rootID = parentCommentID
	}

	post.RootId = rootID
	post.Type = model.PostTypePageComment
	if post.Props == nil {
		post.Props = make(model.StringInterface)
	}
	post.Props["page_id"] = pageID
	post.Props["parent_comment_id"] = parentCommentID

	rctx.Logger().Debug("Transformed page comment reply structure",
		mlog.String("original_root_id", parentCommentID),
		mlog.String("new_root_id", rootID),
		mlog.String("parent_comment_id", parentCommentID))

	return true
}

func (a *App) CanResolvePageComment(rctx request.CTX, session *model.Session, comment *model.Post, pageId string) bool {
	if comment.UserId == session.UserId {
		return true
	}

	page, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return false
	}

	if page.UserId == session.UserId {
		return true
	}

	return a.SessionHasPermissionToChannel(rctx, *session, page.ChannelId, model.PermissionManageChannelRoles)
}

func (a *App) ResolvePageComment(rctx request.CTX, commentId string, userId string) (*model.Post, *model.AppError) {
	comment, err := a.GetSinglePost(rctx, commentId, false)
	if err != nil {
		return nil, err
	}

	props := comment.GetProps()
	if resolved, ok := props["comment_resolved"].(bool); ok && resolved {
		return comment, nil
	}

	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	newProps["comment_resolved"] = true
	newProps["resolved_at"] = model.GetMillis()
	newProps["resolved_by"] = userId
	newProps["resolution_reason"] = "manual"
	comment.SetProps(newProps)

	updatedComment, updateErr := a.UpdatePost(rctx, comment, &model.UpdatePostOptions{})
	if updateErr != nil {
		return nil, updateErr
	}

	pageId, ok := comment.Props["page_id"].(string)
	if !ok || pageId == "" {
		return updatedComment, nil
	}

	page, pageErr := a.GetSinglePost(rctx, pageId, false)
	if pageErr == nil {
		channel, channelErr := a.GetChannel(rctx, page.ChannelId)
		if channelErr == nil {
			a.SendCommentResolvedEvent(rctx, updatedComment, page, channel)
		}
	}

	return updatedComment, nil
}

func (a *App) UnresolvePageComment(rctx request.CTX, commentId string) (*model.Post, *model.AppError) {
	comment, err := a.GetSinglePost(rctx, commentId, false)
	if err != nil {
		return nil, err
	}

	props := comment.GetProps()
	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	delete(newProps, "comment_resolved")
	delete(newProps, "resolved_at")
	delete(newProps, "resolved_by")
	delete(newProps, "resolution_reason")
	comment.SetProps(newProps)

	updatedComment, updateErr := a.UpdatePost(rctx, comment, &model.UpdatePostOptions{})
	if updateErr != nil {
		return nil, updateErr
	}

	pageId, ok := comment.Props["page_id"].(string)
	if !ok || pageId == "" {
		return updatedComment, nil
	}

	page, pageErr := a.GetSinglePost(rctx, pageId, false)
	if pageErr == nil {
		channel, channelErr := a.GetChannel(rctx, page.ChannelId)
		if channelErr == nil {
			a.SendCommentUnresolvedEvent(rctx, updatedComment, page, channel)
		}
	}

	return updatedComment, nil
}

func (a *App) SendCommentResolvedEvent(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) {
	message := model.NewWebSocketEvent(
		model.WebsocketEventPageCommentResolved,
		channel.TeamId,
		comment.ChannelId,
		"",
		nil,
		"",
	)
	props := comment.GetProps()
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	message.Add("resolved_at", props["resolved_at"])
	message.Add("resolved_by", props["resolved_by"])
	a.Publish(message)
}

func (a *App) SendCommentUnresolvedEvent(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) {
	message := model.NewWebSocketEvent(
		model.WebsocketEventPageCommentUnresolved,
		channel.TeamId,
		comment.ChannelId,
		"",
		nil,
		"",
	)
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	a.Publish(message)
}

func (a *App) SendCommentDeletedEvent(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) {
	message := model.NewWebSocketEvent(
		model.WebsocketEventPageCommentDeleted,
		channel.TeamId,
		comment.ChannelId,
		"",
		nil,
		"",
	)
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	a.Publish(message)
}
