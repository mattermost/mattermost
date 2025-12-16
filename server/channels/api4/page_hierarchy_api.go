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

func updatePageParent(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	if _, ok := c.ValidatePageBelongsToWiki(); !ok {
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

	type UpdateParentRequest struct {
		NewParentId string `json:"new_parent_id"`
	}

	var req UpdateParentRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	if req.NewParentId != "" && !model.IsValidId(req.NewParentId) {
		c.SetInvalidParam("new_parent_id")
		return
	}

	// If new parent is specified, verify it exists, is a page, and belongs to the same wiki
	if req.NewParentId != "" {
		parentPost, err := c.App.GetSinglePost(c.AppContext, req.NewParentId, false)
		if err != nil {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_not_found", nil, "", http.StatusBadRequest).Wrap(err)
			return
		}

		if parentPost.Type != model.PostTypePage {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_not_page", nil, "", http.StatusBadRequest)
			return
		}

		parentWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, req.NewParentId)
		if wikiErr != nil {
			c.Err = wikiErr
			return
		}

		if parentWikiId != c.Params.WikiId {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_different_wiki", nil, "", http.StatusBadRequest)
			return
		}
	}

	auditRec := c.MakeAuditRecord("updatePageParent", model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	model.AddEventParameterToAuditRec(auditRec, "new_parent_id", req.NewParentId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	post, err := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if err != nil {
		c.Err = err
		return
	}

	if post.Type != model.PostTypePage {
		c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.not_page.app_error", map[string]any{"PageId": c.Params.PageId}, "", http.StatusBadRequest)
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), post, app.PageOperationEdit, "updatePageParent"); err != nil {
		c.Err = err
		return
	}

	if appErr := c.App.ChangePageParent(c.AppContext, c.Params.PageId, req.NewParentId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func movePageToWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	type MovePageRequest struct {
		TargetWikiId string  `json:"target_wiki_id"`
		ParentPageId *string `json:"parent_page_id,omitempty"`
	}

	var req MovePageRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	if !model.IsValidId(req.TargetWikiId) {
		c.SetInvalidParam("target_wiki_id")
		return
	}

	if req.ParentPageId != nil && *req.ParentPageId != "" && !model.IsValidId(*req.ParentPageId) {
		c.SetInvalidParam("parent_page_id")
		return
	}

	auditRec := c.MakeAuditRecord("movePageToWiki", model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	model.AddEventParameterToAuditRec(auditRec, "source_wiki_id", c.Params.WikiId)
	model.AddEventParameterToAuditRec(auditRec, "target_wiki_id", req.TargetWikiId)
	if req.ParentPageId != nil && *req.ParentPageId != "" {
		model.AddEventParameterToAuditRec(auditRec, "parent_page_id", *req.ParentPageId)
	}
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	sourceWiki, _, ok := c.RequireWikiModifyPermission("movePageToWiki")
	if !ok {
		return
	}

	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationEdit, "movePageToWiki"); err != nil {
		c.Err = err
		return
	}

	if appErr := c.App.MovePageToWiki(c.AppContext, c.Params.PageId, req.TargetWikiId, req.ParentPageId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("page_id=" + c.Params.PageId + " source_wiki_id=" + c.Params.WikiId + " target_wiki_id=" + req.TargetWikiId + " source_wiki_title=" + sourceWiki.Title)

	ReturnStatusOK(w)
}

func duplicatePage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	c.Logger.Info("duplicatePage called",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("page_id", c.Params.PageId),
	)

	type DuplicatePageRequest struct {
		TargetWikiId string  `json:"target_wiki_id"`
		ParentPageId *string `json:"parent_page_id,omitempty"`
		Title        *string `json:"title,omitempty"`
	}

	var req DuplicatePageRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	if !model.IsValidId(req.TargetWikiId) {
		c.SetInvalidParam("target_wiki_id")
		return
	}

	auditRec := c.MakeAuditRecord("duplicatePage", model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	model.AddEventParameterToAuditRec(auditRec, "source_wiki_id", c.Params.WikiId)
	model.AddEventParameterToAuditRec(auditRec, "target_wiki_id", req.TargetWikiId)
	if req.Title != nil && *req.Title != "" {
		model.AddEventParameterToAuditRec(auditRec, "custom_title", *req.Title)
	}
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	page, err := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if err != nil {
		c.Logger.Error("GetSinglePost failed in duplicatePage",
			mlog.String("page_id", c.Params.PageId),
			mlog.Err(err),
		)
		c.Err = err
		return
	}
	c.Logger.Info("GetSinglePost succeeded", mlog.String("page_id", page.Id))

	if err = c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "duplicatePage"); err != nil {
		c.Err = err
		return
	}

	targetWiki, err := c.App.GetWiki(c.AppContext, req.TargetWikiId)
	if err != nil {
		c.Err = err
		return
	}

	channel, chanErr := c.App.GetChannel(c.AppContext, targetWiki.ChannelId)
	if chanErr != nil {
		c.Err = chanErr
		return
	}

	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), targetWiki.ChannelId, model.PermissionCreatePage) {
			c.SetPermissionError(model.PermissionCreatePage)
			return
		}
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// For DM/Group channels: check guest status first (prevents info leakage), then membership
		if c.AppContext.Session().IsGuest() {
			c.Err = model.NewAppError("duplicatePage", "api.page.duplicate.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("duplicatePage", "api.page.duplicate.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}
	default:
		c.Err = model.NewAppError("duplicatePage", "api.page.duplicate.invalid_channel_type", nil, "", http.StatusBadRequest)
		return
	}

	duplicatedPage, appErr := c.App.DuplicatePage(c.AppContext, c.Params.PageId, req.TargetWikiId, req.ParentPageId, req.Title, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(duplicatedPage)
	auditRec.AddEventObjectType("page")
	c.LogAudit("duplicated_page_id=" + duplicatedPage.Id + " target_wiki_id=" + req.TargetWikiId)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(duplicatedPage); err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func getPageBreadcrumb(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return
	}

	if page.Type != model.PostTypePage {
		c.SetInvalidParam("page_id")
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

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "getPageBreadcrumb"); err != nil {
		c.Err = err
		return
	}

	breadcrumbPath, appErr := c.App.BuildBreadcrumbPath(c.AppContext, page, wiki, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(breadcrumbPath); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
