// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func getPageComments(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	if _, ok := c.ValidatePageBelongsToWiki(); !ok {
		return
	}

	_, channel, ok := c.RequireWikiReadPermission()
	if !ok {
		return
	}

	if channel.DeleteAt != 0 {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	comments, appErr := c.App.GetPageComments(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(comments); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createPageComment(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	var req struct {
		Message      string         `json:"message"`
		InlineAnchor map[string]any `json:"inline_anchor"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	if req.Message == "" {
		c.SetInvalidParam("message")
		return
	}

	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return
	}

	if _, _, ok := c.RequireWikiReadPermission(); !ok {
		return
	}

	// Type check is no longer needed - ValidatePageBelongsToWiki uses GetPage
	// which already validates the post is of type PostTypePage

	if !c.CheckPagePermission(page, app.PageOperationRead) {
		return
	}

	auditRec := c.MakeAuditRecord("createPageComment", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("page_id", c.Params.PageId)

	comment, appErr := c.App.CreatePageComment(c.AppContext, c.Params.PageId, req.Message, req.InlineAnchor)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(comment)
	auditRec.AddEventObjectType("page_comment")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(comment); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createPageCommentReply(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	parentCommentId := c.Params.ParentCommentId
	if parentCommentId == "" || !model.IsValidId(parentCommentId) {
		c.SetInvalidParam("parent_comment_id")
		return
	}

	var req struct {
		Message string `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	if req.Message == "" {
		c.SetInvalidParam("message")
		return
	}

	if _, _, ok := c.RequireWikiReadPermission(); !ok {
		return
	}

	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return
	}

	// Type check is no longer needed - ValidatePageBelongsToWiki uses GetPage
	// which already validates the post is of type PostTypePage

	if !c.CheckPagePermission(page, app.PageOperationRead) {
		return
	}

	auditRec := c.MakeAuditRecord("createPageCommentReply", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("page_id", c.Params.PageId)
	auditRec.AddMeta("parent_comment_id", parentCommentId)

	reply, appErr := c.App.CreatePageCommentReply(c.AppContext, c.Params.PageId, parentCommentId, req.Message)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(reply)
	auditRec.AddEventObjectType("page_comment_reply")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(reply); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// validateInlinePageComment validates that a comment is an inline page comment for the given page.
// Returns the comment post if valid, or nil if validation fails (c.Err will be set).
func validateInlinePageComment(c *Context, commentId, pageId, handlerName string) *model.Post {
	comment, appErr := c.App.GetSinglePost(c.AppContext, commentId, false)
	if appErr != nil {
		c.Err = appErr
		return nil
	}

	if comment.DeleteAt != 0 {
		c.Err = model.NewAppError(
			handlerName,
			"api.wiki.comment.deleted.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return nil
	}

	if comment.Type != model.PostTypePageComment {
		c.Err = model.NewAppError(
			handlerName,
			"api.wiki.comment.not_comment.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return nil
	}

	commentPageId, ok := comment.Props["page_id"].(string)
	if !ok || commentPageId != pageId {
		c.Err = model.NewAppError(
			handlerName,
			"api.wiki.comment.wrong_page.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return nil
	}

	commentType, _ := comment.Props[model.PostPropsCommentType].(string)
	if commentType != model.PageCommentTypeInline {
		c.Err = model.NewAppError(
			handlerName,
			"api.wiki.comment.not_inline.app_error",
			nil,
			"only inline comments can be resolved/unresolved",
			http.StatusBadRequest,
		)
		return nil
	}

	return comment
}

func resolvePageComment(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	commentId := c.Params.CommentId
	if commentId == "" || !model.IsValidId(commentId) {
		c.SetInvalidParam("comment_id")
		return
	}

	auditRec := c.MakeAuditRecord("resolvePageComment", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("comment_id", commentId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	comment := validateInlinePageComment(c, commentId, c.Params.PageId, "resolvePageComment")
	if comment == nil {
		return
	}

	if !c.App.CanResolvePageComment(c.AppContext, c.AppContext.Session(), comment, c.Params.PageId) {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	resolvedComment, resolveErr := c.App.ResolvePageComment(c.AppContext, commentId, c.AppContext.Session().UserId)
	if resolveErr != nil {
		c.Err = resolveErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(resolvedComment)

	if err := json.NewEncoder(w).Encode(resolvedComment); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func unresolvePageComment(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	commentId := c.Params.CommentId
	if commentId == "" || !model.IsValidId(commentId) {
		c.SetInvalidParam("comment_id")
		return
	}

	auditRec := c.MakeAuditRecord("unresolvePageComment", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("comment_id", commentId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	comment := validateInlinePageComment(c, commentId, c.Params.PageId, "unresolvePageComment")
	if comment == nil {
		return
	}

	if !c.App.CanResolvePageComment(c.AppContext, c.AppContext.Session(), comment, c.Params.PageId) {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	unresolvedComment, unresolveErr := c.App.UnresolvePageComment(c.AppContext, commentId)
	if unresolveErr != nil {
		c.Err = unresolveErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(unresolvedComment)

	if err := json.NewEncoder(w).Encode(unresolvedComment); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
