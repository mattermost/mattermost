// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitCard() {
	if api.srv.Config().FeatureFlags.IntegratedBoards {
		api.BaseRoutes.Cards.Handle("", api.APISessionRequired(createCard)).Methods(http.MethodPost)
		api.BaseRoutes.Card.Handle("", api.APISessionRequired(updateCard)).Methods(http.MethodPut)
		api.BaseRoutes.Card.Handle("/patch", api.APISessionRequired(patchCard)).Methods(http.MethodPut)
		api.BaseRoutes.Card.Handle("", api.APISessionRequired(deleteCard)).Methods(http.MethodDelete)
		api.BaseRoutes.Card.Handle("/edit_history", api.APISessionRequired(getCardEditHistory)).Methods(http.MethodGet)
	}
}

func createCardChecks(where string, c *Context, post *model.Post) {
	userCreatePostPermissionCheckWithContext(c, post.ChannelId)
	if c.Err != nil {
		return
	}

	if len(post.FileIds) > 0 {
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionUploadFile); !ok {
			c.SetPermissionError(model.PermissionUploadFile)
			return
		}
	}

	postHardenedModeCheckWithContext(where, c, post.GetProps())
	if c.Err != nil {
		return
	}
}

func createCard(c *Context, w http.ResponseWriter, r *http.Request) {
	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	post.SanitizeInput()
	post.UserId = c.AppContext.Session().UserId
	post.Type = model.PostTypeCard

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterAuditableToAuditRec(auditRec, "post", &post)

	if post.CreateAt != 0 && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		post.CreateAt = 0
	}

	createCardChecks("Api4.createCard", c, &post)
	if c.Err != nil {
		return
	}

	setOnline := r.URL.Query().Get("set_online")
	setOnlineBool := true // By default, always set online.
	var err2 error
	if setOnline != "" {
		setOnlineBool, err2 = strconv.ParseBool(setOnline)
		if err2 != nil {
			c.Logger.Warn("Failed to parse set_online URL query parameter from createCard request", mlog.Err(err2))
			setOnlineBool = true // Set online nevertheless.
		}
	}

	rp, isMemberForPreviews, err := c.App.CreatePostAsUser(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), c.AppContext.Session().Id, setOnlineBool)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	auditRec.AddEventResultState(rp)
	auditRec.AddEventObjectType("post")

	if !isMemberForPreviews {
		previewPost := rp.GetPreviewPost()
		if previewPost != nil {
			model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
		}
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	if setOnlineBool {
		c.App.SetStatusOnline(c.AppContext.Session().UserId, false)
	}

	c.App.Srv().Platform().UpdateLastActivityAtIfNeeded(*c.AppContext.Session())
	c.ExtendSessionExpiryIfNeeded(w, r)

	w.WriteHeader(http.StatusCreated)

	// Note that rp has already had PreparePostForClient called on it by App.CreatePost

	if err := rp.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateCard(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	// MM-67055: Strip client-supplied metadata.embeds to prevent spoofing.
	// This matches createPost behavior.
	post.SanitizeInput()
	post.Type = model.PostTypeCard

	auditRec := c.MakeAuditRecord(model.AuditEventUpdatePost, model.AuditStatusFail)
	model.AddEventParameterAuditableToAuditRec(auditRec, "post", &post)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	// The post being updated in the payload must be the same one as indicated in the URL.
	if post.Id != c.Params.PostId {
		c.SetInvalidParam("id")
		return
	}

	postHardenedModeCheckWithContext("updateCard", c, post.GetProps())
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	ok, isMember := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditPost)
	if !ok {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if originalPost.Type != model.PostTypeCard {
		c.Err = model.NewAppError("updateCard", "api.card.not_card_post.app_error", nil, "postId="+c.Params.PostId, http.StatusBadRequest)
		return
	}

	// Users who can't create posts in a channel shouldn't be able to edit them either.
	userCreatePostPermissionCheckWithContext(c, originalPost.ChannelId)
	if c.Err != nil {
		return
	}

	auditRec.AddEventPriorState(originalPost)
	auditRec.AddEventObjectType("post")

	// passing a nil fileIds should not have any effect on a post's file IDs
	// so, we restore the original file IDs in this case
	if post.FileIds == nil {
		post.FileIds = originalPost.FileIds
	}

	// passing nil props should not have any effect on a post's props
	// so, we restore the original props in this case
	if post.Props == nil {
		post.Props = originalPost.Props
	}

	if postEditTimeLimitExpired(c.App.Config(), originalPost) &&
		(post.Message != originalPost.Message ||
			!slices.Equal(post.FileIds, originalPost.FileIds) ||
			model.StringInterfaceToJSON(post.GetProps()) != model.StringInterfaceToJSON(originalPost.GetProps()) ||
			post.IsPinned != originalPost.IsPinned) {
		c.Err = model.NewAppError("updateCard", "api.post.update_post.permissions_time_limit.app_error", map[string]any{"timeLimit": *c.App.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
		return
	}

	// Check upload_file permission only if update is adding NEW files (not just keeping existing ones)
	checkUploadFilePermissionForNewFiles(c, post.FileIds, originalPost)
	if c.Err != nil {
		return
	}

	// Check edit_file_attachment permission if file IDs are being changed (files added or removed)
	checkEditFileAttachmentPermission(c, post.FileIds, originalPost)
	if c.Err != nil {
		return
	}

	post.Id = c.Params.PostId

	rpost, isMemberForPreviews, err := c.App.UpdatePost(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), &model.UpdatePostOptions{SafeUpdate: false})
	if err != nil {
		c.Err = err
		return
	}

	if !isMember || !isMemberForPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
		if !isMemberForPreviews {
			previewPost := rpost.GetPreviewPost()
			if previewPost != nil {
				model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
			}
		}
	}

	auditRec.Success()
	auditRec.AddEventResultState(rpost)

	if err := rpost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCard(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var post model.PostPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPost, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "id", c.Params.PostId)
	model.AddEventParameterAuditableToAuditRec(auditRec, "patch", &post)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	if post.Props != nil {
		postHardenedModeCheckWithContext("patchCard", c, *post.Props)
		if c.Err != nil {
			return
		}
	}

	isMember := cardPostPatchChecks(c, auditRec, &post)
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if post.FileIds != nil {
		checkUploadFilePermissionForNewFiles(c, *post.FileIds, originalPost)
		if c.Err != nil {
			return
		}

		checkEditFileAttachmentPermission(c, *post.FileIds, originalPost)
		if c.Err != nil {
			return
		}
	}

	patchedPost, isMemberForPReviews, err := c.App.PatchPost(c.AppContext, c.Params.PostId, c.App.PostPatchWithProxyRemovedFromImageURLs(&post), nil)
	if err != nil {
		c.Err = err
		return
	}

	if !isMember || !isMemberForPReviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	auditRec.Success()
	auditRec.AddEventResultState(patchedPost)

	if err := patchedPost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func cardPostPatchChecks(c *Context, auditRec *model.AuditRecord, patch *model.PostPatch) bool {
	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return false
	}

	permission := model.PermissionEditPost

	ok, isMember := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, permission)
	if !ok {
		c.SetPermissionError(permission)
		return false
	}

	if originalPost.Type != model.PostTypeCard {
		c.Err = model.NewAppError("patchCard", "api.card.not_card_post.app_error", nil, "postId="+c.Params.PostId, http.StatusBadRequest)
		return false
	}
	auditRec.AddEventPriorState(originalPost)
	auditRec.AddEventObjectType("post")

	// Users who can't create posts in a channel shouldn't be able to edit them either.
	userCreatePostPermissionCheckWithContext(c, originalPost.ChannelId)
	if c.Err != nil {
		return false
	}

	if postEditTimeLimitExpired(c.App.Config(), originalPost) && !patch.IsEmpty() {
		c.Err = model.NewAppError("patchCard", "api.post.update_post.permissions_time_limit.app_error", map[string]any{"timeLimit": *c.App.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
		return isMember
	}

	return isMember
}

func deleteCard(c *Context, w http.ResponseWriter, _ *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	permanent := c.Params.Permanent

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "post_id", c.Params.PostId)
	model.AddEventParameterToAuditRec(auditRec, "permanent", permanent)

	includeDeleted := permanent

	if permanent && !*c.App.Config().ServiceSettings.EnableAPIPostDeletion {
		c.Err = model.NewAppError("deleteCard", "api.post.delete_post.not_enabled.app_error", nil, "postId="+c.Params.PostId, http.StatusNotImplemented)
		return
	}

	if permanent && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	post, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PostId, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionDeletePost); !ok {
		c.SetPermissionError(model.PermissionDeletePost)
		return
	}

	if post.Type != model.PostTypeCard {
		c.Err = model.NewAppError("deleteCard", "api.card.not_card_post.app_error", nil, "postId="+c.Params.PostId, http.StatusBadRequest)
		return
	}

	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	if permanent {
		appErr = c.App.PermanentDeletePost(c.AppContext, c.Params.PostId, c.AppContext.Session().UserId)
	} else {
		_, appErr = c.App.DeletePost(c.AppContext, c.Params.PostId, c.AppContext.Session().UserId)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getCardEditHistory(c *Context, w http.ResponseWriter, _ *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	ok, isMember := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditPost)
	if !ok {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if originalPost.Type != model.PostTypeCard {
		c.Err = model.NewAppError("getCardEditHistory", "api.card.not_card_post.app_error", nil, "postId="+c.Params.PostId, http.StatusBadRequest)
		return
	}

	postsList, err := c.App.GetEditHistoryForPost(c.Params.PostId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetEditHistoryForPost, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "post_id", c.Params.PostId)

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	if err := json.NewEncoder(w).Encode(postsList); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
