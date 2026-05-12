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

// GetPageComments retrieves comments (including inline comments) for a page with pagination.
// Note: Permission checks are performed by the API layer before calling this method.
func (a *App) GetPageComments(rctx request.CTX, pageID string, offset, limit int) ([]*model.Post, *model.AppError) {
	postList, appErr := a.Srv().Store().Page().GetCommentsForPage(pageID, false, offset, limit)
	if appErr != nil {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.store_error.app_error",
			nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	page, pageExists := postList.Posts[pageID]
	if !pageExists || !IsPagePost(page) {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.page_not_found.app_error",
			nil, "", http.StatusNotFound)
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

// CreatePageComment creates a top-level comment on a page.
// wikiID is optional - if empty, it will be fetched from the page's property values.
// page and channel are optional - if provided, avoids DB fetches.
func (a *App) CreatePageComment(rctx request.CTX, pageID, message string, inlineAnchor map[string]any, wikiID string, page *model.Post, channel *model.Channel) (*model.Post, *model.AppError) {
	if strings.TrimSpace(message) == "" {
		return nil, model.NewAppError("CreatePageComment",
			"app.page.create_comment.empty_message.app_error",
			nil, "message cannot be empty", http.StatusBadRequest)
	}

	// Use provided page or fetch if not provided
	if page == nil {
		var err *model.AppError
		page, err = a.GetPage(rctx, pageID)
		if err != nil {
			return nil, err
		}
	}

	// Use provided channel or fetch if not provided
	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetWikiBackingChannel(rctx, page.ChannelId)
		if chanErr != nil {
			return nil, chanErr
		}
	}

	props := model.StringInterface{
		model.PagePropsPageID: pageID,
	}

	// Use provided wikiID or fetch if not provided; wiki_id is required on all page comments.
	if wikiID == "" {
		fetchedWikiID, wikiErr := a.GetWikiIdForPost(rctx, page)
		if wikiErr != nil {
			return nil, model.NewAppError("CreatePageComment", "app.page_comment.create.wiki_lookup.app_error",
				nil, "", http.StatusInternalServerError).Wrap(wikiErr)
		}
		wikiID = fetchedWikiID
	}
	props[model.PagePropsWikiID] = wikiID

	rootID := pageID
	if len(inlineAnchor) > 0 {
		props[model.PostPropsCommentType] = model.PageCommentTypeInline
		props[model.PagePropsInlineAnchor] = inlineAnchor
		rootID = ""
	}

	userId := sessionUserID(rctx)
	if userId == "" {
		rctx.Logger().Warn("Creating page comment without a user session", mlog.String("page_id", pageID))
	}

	comment := &model.Post{
		ChannelId: page.ChannelId,
		UserId:    userId,
		RootId:    rootID,
		Message:   message,
		Type:      model.PostTypePageComment,
		Props:     props,
	}

	createdComment, _, createErr := a.CreatePost(rctx, comment, channel, model.CreatePostFlags{})
	if createErr != nil {
		return nil, createErr
	}

	a.SendCommentCreatedEvent(rctx, createdComment, page)

	rctx.Logger().Debug("Page comment created",
		mlog.String("comment_id", createdComment.Id),
		mlog.String("page_id", pageID))

	return createdComment, nil
}

// CreatePageCommentReply creates a reply to a page comment (one level of nesting only).
// wikiID is optional - if empty, it will be fetched from the page's property values.
// page and channel are optional - if provided, avoids DB fetches.
func (a *App) CreatePageCommentReply(rctx request.CTX, pageID, parentCommentID, message string, wikiID string, page *model.Post, channel *model.Channel) (*model.Post, *model.AppError) {
	if strings.TrimSpace(message) == "" {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.empty_message.app_error",
			nil, "message cannot be empty", http.StatusBadRequest)
	}

	// Use provided page or fetch if not provided
	if page == nil {
		var err *model.AppError
		page, err = a.GetPage(rctx, pageID)
		if err != nil {
			return nil, model.NewAppError("CreatePageCommentReply",
				"app.page.create_comment_reply.page_not_found.app_error",
				nil, "", http.StatusNotFound).Wrap(err)
		}
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

	parentPageID := ""
	if parentComment.Props != nil {
		parentPageID, _ = parentComment.Props[model.PagePropsPageID].(string)
	}
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

	// Use provided channel or fetch if not provided
	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetWikiBackingChannel(rctx, page.ChannelId)
		if chanErr != nil {
			return nil, chanErr
		}
	}

	rootID := pageID
	if parentComment.Props[model.PostPropsCommentType] == model.PageCommentTypeInline {
		rootID = parentCommentID
	}

	replyProps := model.StringInterface{
		model.PagePropsPageID:          pageID,
		model.PagePropsParentCommentID: parentCommentID,
	}

	// Use provided wikiID or fetch if not provided
	if wikiID == "" {
		fetchedWikiID, wikiErr := a.GetWikiIdForPost(rctx, page)
		if wikiErr == nil && fetchedWikiID != "" {
			wikiID = fetchedWikiID
		}
	}
	if wikiID != "" {
		replyProps[model.PagePropsWikiID] = wikiID
	}

	replyUserId := sessionUserID(rctx)
	if replyUserId == "" {
		rctx.Logger().Warn("Creating page comment reply without a user session", mlog.String("page_id", pageID))
	}

	reply := &model.Post{
		ChannelId: page.ChannelId,
		UserId:    replyUserId,
		RootId:    rootID,
		Message:   message,
		Type:      model.PostTypePageComment,
		Props:     replyProps,
	}

	createdReply, _, createErr := a.CreatePost(rctx, reply, channel, model.CreatePostFlags{})
	if createErr != nil {
		return nil, createErr
	}

	a.SendCommentCreatedEvent(rctx, createdReply, page)

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

// CanResolvePageComment checks if the user can resolve a comment.
// page is optional - if provided, avoids a DB fetch.
func (a *App) CanResolvePageComment(rctx request.CTX, session *model.Session, comment *model.Post, pageId string, page *model.Post) bool {
	if comment.UserId == session.UserId {
		return true
	}

	// Use provided page or fetch if not provided
	if page == nil {
		var err *model.AppError
		page, err = a.GetSinglePost(rctx, pageId, false)
		if err != nil {
			return false
		}
	}

	if page.UserId == session.UserId {
		return true
	}

	// Check ManageWiki permission via wiki-scoped permission resolution.
	// Checking SchemeAdmin on the wiki backing channel is wrong: the backing
	// channel has no members, so that check always returns false.
	// Derive the wiki from the page's backing channel (authoritative, always set).
	wiki, getWikiErr := a.GetWikiByChannelId(rctx, page.ChannelId)
	if getWikiErr != nil {
		return false
	}

	if a.IsWikiOwner(*session, wiki) {
		return true
	}

	return a.SessionHasPermissionToTeam(*session, wiki.TeamId, model.PermissionManageWiki)
}

// ResolvePageComment marks a comment as resolved.
// page and channel are optional - if provided, they're used for WebSocket events without extra DB fetches.
func (a *App) ResolvePageComment(rctx request.CTX, comment *model.Post, userId string, page *model.Post, channel *model.Channel) (*model.Post, *model.AppError) {
	props := comment.GetProps()
	if resolved, ok := props[model.PagePropsCommentResolved].(bool); ok && resolved {
		return comment, nil
	}

	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	newProps[model.PagePropsCommentResolved] = true
	newProps[model.PagePropsResolvedAt] = model.GetMillis()
	newProps[model.PagePropsResolvedBy] = userId
	newProps[model.PagePropsResolutionReason] = model.PageResolutionReasonManual

	updatedComment, storeErr := a.Srv().Store().Page().UpdateCommentProps(comment.Id, newProps)
	if storeErr != nil {
		return nil, model.NewAppError("ResolvePageComment", "app.page.resolve_comment.update_props.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	// Send WebSocket event - use provided page or fetch if not provided
	if page != nil {
		a.SendCommentResolvedEvent(rctx, updatedComment, page)
	} else {
		pageId, ok := comment.Props[model.PagePropsPageID].(string)
		if ok && pageId != "" {
			fetchedPage, pageErr := a.GetPage(rctx, pageId)
			if pageErr != nil {
				rctx.Logger().Warn("Failed to fetch page for comment_resolved event", mlog.String("page_id", pageId), mlog.String("comment_id", comment.Id), mlog.Err(pageErr))
			} else {
				a.SendCommentResolvedEvent(rctx, updatedComment, fetchedPage)
			}
		}
	}

	return updatedComment, nil
}

// UnresolvePageComment marks a comment as unresolved.
// page and channel are optional - if provided, they're used for WebSocket events without extra DB fetches.
func (a *App) UnresolvePageComment(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) (*model.Post, *model.AppError) {
	props := comment.GetProps()
	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	delete(newProps, model.PagePropsCommentResolved)
	delete(newProps, model.PagePropsResolvedAt)
	delete(newProps, model.PagePropsResolvedBy)
	delete(newProps, model.PagePropsResolutionReason)

	updatedComment, storeErr := a.Srv().Store().Page().UpdateCommentProps(comment.Id, newProps)
	if storeErr != nil {
		return nil, model.NewAppError("UnresolvePageComment", "app.page.unresolve_comment.update_props.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	// Send WebSocket event - use provided page or fetch if not provided
	if page != nil {
		a.SendCommentUnresolvedEvent(rctx, updatedComment, page)
	} else {
		pageId, ok := comment.Props[model.PagePropsPageID].(string)
		if ok && pageId != "" {
			fetchedPage, pageErr := a.GetPage(rctx, pageId)
			if pageErr != nil {
				rctx.Logger().Warn("Failed to fetch page for comment_unresolved event", mlog.String("page_id", pageId), mlog.String("comment_id", comment.Id), mlog.Err(pageErr))
			} else {
				a.SendCommentUnresolvedEvent(rctx, updatedComment, fetchedPage)
			}
		}
	}

	return updatedComment, nil
}

func (a *App) SendCommentCreatedEvent(rctx request.CTX, comment *model.Post, page *model.Post) {
	commentJSON, jsonErr := comment.ToJSON()
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to encode comment to JSON for WebSocket event",
			mlog.String("comment_id", comment.Id),
			mlog.Err(jsonErr))
		return
	}

	wikiId, _ := page.GetProps()[model.PagePropsWikiID].(string)
	if wikiId == "" {
		rctx.Logger().Debug("Skipping comment_created broadcast: page has no wiki_id prop",
			mlog.String("page_id", page.Id))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPageCommentCreated, "", "", "", nil, "")
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	message.Add("comment", commentJSON)
	a.publishToLinkedSourceChannels(wikiId, message)
}

func (a *App) SendCommentResolvedEvent(rctx request.CTX, comment *model.Post, page *model.Post) {
	wikiId, _ := page.GetProps()[model.PagePropsWikiID].(string)
	if wikiId == "" {
		rctx.Logger().Debug("Skipping comment_resolved broadcast: page has no wiki_id prop",
			mlog.String("page_id", page.Id))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPageCommentResolved, "", "", "", nil, "")
	props := comment.GetProps()
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	message.Add("resolved_at", props[model.PagePropsResolvedAt])
	message.Add("resolved_by", props[model.PagePropsResolvedBy])
	a.publishToLinkedSourceChannels(wikiId, message)
}

func (a *App) SendCommentUnresolvedEvent(rctx request.CTX, comment *model.Post, page *model.Post) {
	wikiId, _ := page.GetProps()[model.PagePropsWikiID].(string)
	if wikiId == "" {
		rctx.Logger().Debug("Skipping comment_unresolved broadcast: page has no wiki_id prop",
			mlog.String("page_id", page.Id))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPageCommentUnresolved, "", "", "", nil, "")
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	a.publishToLinkedSourceChannels(wikiId, message)
}

// DeletePageComment soft-deletes a page comment and broadcasts the deletion event.
// page and channel are optional; if nil the method fetches them from the comment's props.
func (a *App) DeletePageComment(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) *model.AppError {
	userID := sessionUserID(rctx)
	if err := a.Srv().Store().Post().Delete(rctx, comment.Id, model.GetMillis(), userID); err != nil {
		return model.NewAppError("DeletePageComment", "app.page.delete_comment.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.Srv().Go(func() {
		a.deleteFlaggedPosts(rctx, comment.Id)
	})

	if page != nil {
		a.SendCommentDeletedEvent(rctx, comment, page)
	} else {
		pageId, ok := comment.Props[model.PagePropsPageID].(string)
		if ok && pageId != "" {
			fetchedPage, pageErr := a.GetPage(rctx, pageId)
			if pageErr != nil {
				rctx.Logger().Warn("Failed to fetch page for comment_deleted event", mlog.String("page_id", pageId), mlog.String("comment_id", comment.Id), mlog.Err(pageErr))
			} else {
				a.SendCommentDeletedEvent(rctx, comment, fetchedPage)
			}
		}
	}

	return nil
}

func (a *App) SendCommentDeletedEvent(rctx request.CTX, comment *model.Post, page *model.Post) {
	wikiId, _ := page.GetProps()[model.PagePropsWikiID].(string)
	if wikiId == "" {
		rctx.Logger().Debug("Skipping comment_deleted broadcast: page has no wiki_id prop",
			mlog.String("page_id", page.Id))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPageCommentDeleted, "", "", "", nil, "")
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	if anchor, ok := comment.Props[model.PagePropsInlineAnchor].(map[string]any); ok {
		if anchorID, ok := anchor["anchor_id"].(string); ok && anchorID != "" {
			message.Add("anchor_id", anchorID)
		}
	}
	a.publishToLinkedSourceChannels(wikiId, message)
}
