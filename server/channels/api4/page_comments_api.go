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

	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("getPageComments", "api.wiki.get_comments.invalid_wiki", nil, "", http.StatusBadRequest)
		return
	}

	wiki, appErr := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, wiki.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
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

	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("createPageComment", "api.wiki.create_comment.invalid_wiki", nil, "", http.StatusBadRequest)
		return
	}

	wiki, appErr := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, wiki.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	page, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if page.Type != model.PostTypePage {
		c.Err = model.NewAppError("createPageComment", "api.wiki.create_comment.not_page.app_error", nil, "pageId="+c.Params.PageId, http.StatusBadRequest)
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "createPageComment"); err != nil {
		c.Err = err
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

	wiki, appErr := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, wiki.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("createPageCommentReply", "api.wiki.create_comment_reply.invalid_wiki", nil, "", http.StatusBadRequest)
		return
	}

	page, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if page.Type != model.PostTypePage {
		c.Err = model.NewAppError("createPageCommentReply", "api.wiki.create_comment_reply.not_page.app_error", nil, "pageId="+c.Params.PageId, http.StatusBadRequest)
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "createPageCommentReply"); err != nil {
		c.Err = err
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

	comment, appErr := c.App.GetSinglePost(c.AppContext, commentId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if comment.DeleteAt != 0 {
		c.Err = model.NewAppError(
			"resolvePageComment",
			"api.wiki.resolve_comment.deleted.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return
	}

	if comment.Type != model.PostTypePageComment {
		c.Err = model.NewAppError(
			"resolvePageComment",
			"api.wiki.resolve_comment.not_comment.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return
	}

	commentPageId, ok := comment.Props["page_id"].(string)
	if !ok || commentPageId != c.Params.PageId {
		c.Err = model.NewAppError(
			"resolvePageComment",
			"api.wiki.resolve_comment.wrong_page.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return
	}

	commentType, _ := comment.Props[model.PostPropsCommentType].(string)
	if commentType != model.PageCommentTypeInline {
		c.Err = model.NewAppError(
			"resolvePageComment",
			"api.wiki.resolve_comment.not_inline.app_error",
			nil,
			"only inline comments can be resolved",
			http.StatusBadRequest,
		)
		return
	}

	if !c.App.CanResolvePageComment(c.AppContext, c.AppContext.Session(), comment, c.Params.PageId) {
		c.SetPermissionError(model.PermissionReadChannelContent)
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

	comment, appErr := c.App.GetSinglePost(c.AppContext, commentId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if comment.DeleteAt != 0 {
		c.Err = model.NewAppError(
			"unresolvePageComment",
			"api.wiki.unresolve_comment.deleted.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return
	}

	if comment.Type != model.PostTypePageComment {
		c.Err = model.NewAppError(
			"unresolvePageComment",
			"api.wiki.unresolve_comment.not_comment.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return
	}

	commentPageId, ok := comment.Props["page_id"].(string)
	if !ok || commentPageId != c.Params.PageId {
		c.Err = model.NewAppError(
			"unresolvePageComment",
			"api.wiki.unresolve_comment.wrong_page.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
		return
	}

	commentType, _ := comment.Props[model.PostPropsCommentType].(string)
	if commentType != model.PageCommentTypeInline {
		c.Err = model.NewAppError(
			"unresolvePageComment",
			"api.wiki.unresolve_comment.not_inline.app_error",
			nil,
			"only inline comments can be unresolved",
			http.StatusBadRequest,
		)
		return
	}

	if !c.App.CanResolvePageComment(c.AppContext, c.AppContext.Session(), comment, c.Params.PageId) {
		c.SetPermissionError(model.PermissionReadChannelContent)
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
