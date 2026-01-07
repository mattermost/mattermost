// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"maps"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// handlePageCommentThreadCreation creates thread entries for page comments
func (a *App) handlePageCommentThreadCreation(rctx request.CTX, post *model.Post, user *model.User, channel *model.Channel) *model.AppError {
	rctx.Logger().Debug("handlePageCommentThreadCreation called", mlog.String("post_id", post.Id), mlog.String("message", post.Message))

	if err := a.createThreadEntryForPageComment(rctx, post, channel); err != nil {
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
func (a *App) createThreadEntryForPageComment(rctx request.CTX, post *model.Post, channel *model.Channel) *model.AppError {
	thread := &model.Thread{
		PostId:       post.Id,
		ChannelId:    post.ChannelId,
		ReplyCount:   0,
		LastReplyAt:  post.CreateAt,
		Participants: model.StringArray{post.UserId},
		TeamId:       channel.TeamId,
	}

	if err := a.Srv().Store().Thread().CreateThreadForPageComment(thread); err != nil {
		return model.NewAppError("createThreadEntryForPageComment", "app.post.create_thread_entry.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// GetPageComments retrieves all comments (including inline comments) for a page
func (a *App) GetPageComments(rctx request.CTX, pageID string) ([]*model.Post, *model.AppError) {
	page, err := a.GetPage(rctx, pageID)
	if err != nil {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.page_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	// Verify user has permission to read the page before returning comments
	session := rctx.Session()
	if !a.HasPermissionToChannel(rctx, session.UserId, page.ChannelId(), model.PermissionReadPage) {
		return nil, model.NewAppError("GetPageComments", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
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
	if strings.TrimSpace(message) == "" {
		return nil, model.NewAppError("CreatePageComment",
			"app.page.create_comment.empty_message.app_error",
			nil, "message cannot be empty", http.StatusBadRequest)
	}

	page, err := a.GetPage(rctx, pageID)
	if err != nil {
		if err.Id == "app.page.get.not_a_page.app_error" {
			return nil, model.NewAppError("CreatePageComment",
				"app.page.create_comment.not_a_page.app_error",
				nil, "", http.StatusBadRequest).Wrap(err)
		}
		return nil, model.NewAppError("CreatePageComment",
			"app.page.create_comment.page_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	channel, chanErr := a.GetChannel(rctx, page.ChannelId())
	if chanErr != nil {
		return nil, chanErr
	}

	props := model.StringInterface{
		model.PagePropsPageID: pageID,
	}

	wikiID, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr == nil && wikiID != "" {
		props[model.PagePropsWikiID] = wikiID
	}

	rootID := pageID
	if len(inlineAnchor) > 0 {
		props[model.PostPropsCommentType] = model.PageCommentTypeInline
		props[model.PagePropsInlineAnchor] = inlineAnchor
		rootID = ""
	}

	comment := &model.Post{
		ChannelId: page.ChannelId(),
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

	a.SendCommentCreatedEvent(rctx, createdComment, page.Post(), channel)

	rctx.Logger().Debug("Page comment created",
		mlog.String("comment_id", createdComment.Id),
		mlog.String("page_id", pageID))

	return createdComment, nil
}

// CreatePageCommentReply creates a reply to a page comment (one level of nesting only)
func (a *App) CreatePageCommentReply(rctx request.CTX, pageID, parentCommentID, message string) (*model.Post, *model.AppError) {
	if strings.TrimSpace(message) == "" {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.empty_message.app_error",
			nil, "message cannot be empty", http.StatusBadRequest)
	}

	page, err := a.GetPage(rctx, pageID)
	if err != nil {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.page_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	parentComment, err := a.GetSinglePost(rctx, parentCommentID, false)
	if err != nil {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.parent_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPageComment(parentComment) {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.parent_not_comment.app_error",
			nil, "parent is not a page comment", http.StatusBadRequest)
	}

	parentPageID, _ := parentComment.Props[model.PagePropsPageID].(string)
	if parentPageID != pageID {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.parent_wrong_page.app_error",
			nil, "parent comment does not belong to the specified page", http.StatusBadRequest)
	}

	if parentComment.Props[model.PagePropsParentCommentID] != nil {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.reply_to_reply_not_allowed.app_error",
			nil, "Can only reply to top-level comments", http.StatusBadRequest)
	}

	channel, chanErr := a.GetChannel(rctx, page.ChannelId())
	if chanErr != nil {
		return nil, chanErr
	}

	rootID := pageID
	if parentComment.Props[model.PostPropsCommentType] == model.PageCommentTypeInline {
		rootID = parentCommentID
	}

	replyProps := model.StringInterface{
		model.PagePropsPageID:          pageID,
		model.PagePropsParentCommentID: parentCommentID,
	}

	wikiID, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr == nil && wikiID != "" {
		replyProps[model.PagePropsWikiID] = wikiID
	}

	reply := &model.Post{
		ChannelId: page.ChannelId(),
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

	a.SendCommentCreatedEvent(rctx, createdReply, page.Post(), channel)

	rctx.Logger().Debug("Page comment reply created",
		mlog.String("reply_id", createdReply.Id),
		mlog.String("page_id", pageID),
		mlog.String("parent_comment_id", parentCommentID))

	return createdReply, nil
}

// TransformPageCommentReply transforms a post structure when replying to a page comment
func (a *App) TransformPageCommentReply(rctx request.CTX, post *model.Post, parentComment *model.Post) bool {
	if !IsPageComment(parentComment) {
		return false
	}

	parentCommentID := post.RootId
	pageID, _ := parentComment.Props[model.PagePropsPageID].(string)

	if pageID == "" {
		rctx.Logger().Warn("Parent comment missing page_id prop, cannot transform reply",
			mlog.String("parent_comment_id", parentCommentID))
		return false
	}

	if parentComment.Props[model.PagePropsParentCommentID] != nil {
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
	post.Props[model.PagePropsPageID] = pageID
	post.Props[model.PagePropsParentCommentID] = parentCommentID

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

	member, memberErr := a.GetChannelMember(rctx, page.ChannelId, session.UserId)
	if memberErr != nil {
		return false
	}

	return member.SchemeAdmin
}

func (a *App) ResolvePageComment(rctx request.CTX, comment *model.Post, userId string) (*model.Post, *model.AppError) {
	props := comment.GetProps()
	if resolved, ok := props[model.PagePropsCommentResolved].(bool); ok && resolved {
		return comment, nil
	}

	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	newProps[model.PagePropsCommentResolved] = true
	newProps[model.PagePropsResolvedAt] = model.GetMillis()
	newProps[model.PagePropsResolvedBy] = userId
	newProps["resolution_reason"] = "manual"
	comment.SetProps(newProps)

	updatedComment, updateErr := a.UpdatePost(rctx, comment, &model.UpdatePostOptions{})
	if updateErr != nil {
		return nil, updateErr
	}

	pageId, ok := comment.Props[model.PagePropsPageID].(string)
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

func (a *App) UnresolvePageComment(rctx request.CTX, comment *model.Post) (*model.Post, *model.AppError) {
	props := comment.GetProps()
	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	delete(newProps, model.PagePropsCommentResolved)
	delete(newProps, model.PagePropsResolvedAt)
	delete(newProps, model.PagePropsResolvedBy)
	delete(newProps, "resolution_reason")
	comment.SetProps(newProps)

	updatedComment, updateErr := a.UpdatePost(rctx, comment, &model.UpdatePostOptions{})
	if updateErr != nil {
		return nil, updateErr
	}

	pageId, ok := comment.Props[model.PagePropsPageID].(string)
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

func (a *App) SendCommentCreatedEvent(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) {
	message := model.NewWebSocketEvent(
		model.WebsocketEventPageCommentCreated,
		channel.TeamId,
		comment.ChannelId,
		"",
		nil,
		"",
	)
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	commentJSON, _ := comment.ToJSON()
	message.Add("comment", commentJSON)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           comment.ChannelId,
		ReliableClusterSend: true,
	})
	a.Publish(message)
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
	message.Add("resolved_at", props[model.PagePropsResolvedAt])
	message.Add("resolved_by", props[model.PagePropsResolvedBy])
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           comment.ChannelId,
		ReliableClusterSend: true,
	})
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
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           comment.ChannelId,
		ReliableClusterSend: true,
	})
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
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           comment.ChannelId,
		ReliableClusterSend: true,
	})
	a.Publish(message)
}
