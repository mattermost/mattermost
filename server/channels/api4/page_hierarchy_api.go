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

// movePage moves a page within the hierarchy. Can change parent and/or reorder among siblings.
func movePage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventMovePage, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	// Check wiki modify permission first (includes channel deletion check)
	if _, _, ok := c.GetWikiForModify(); !ok {
		return
	}

	// Validate page belongs to wiki and get page for permission check
	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return
	}

	// Check page edit permission early
	if !c.CheckPagePermission(page, app.PageOperationEdit) {
		return
	}

	type MovePageRequest struct {
		PageParentId *string `json:"page_parent_id,omitempty"` // nil = keep current parent
		SiblingIndex *int64  `json:"sibling_index,omitempty"`  // position among siblings
	}

	var req MovePageRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	if req.PageParentId != nil && *req.PageParentId != "" && !model.IsValidId(*req.PageParentId) {
		c.SetInvalidParam("page_parent_id")
		return
	}

	// Validate sibling_index if provided
	if req.SiblingIndex != nil && *req.SiblingIndex < 0 {
		c.SetInvalidParam("sibling_index")
		return
	}

	// If new parent is specified, verify it exists, is a page, and belongs to the same wiki
	if req.PageParentId != nil && *req.PageParentId != "" {
		// GetPage validates the post exists and is a page type
		parentPage, err := c.App.GetPage(c.AppContext, *req.PageParentId)
		if err != nil {
			c.Err = model.NewAppError("movePage", "api.wiki.move_page.parent_not_found.app_error", nil, "", err.StatusCode).Wrap(err)
			return
		}

		// Permission check: user must have access to parent page
		// This is implicitly covered by GetWikiForModify (same wiki = same channel),
		// but we verify explicitly for defense in depth
		if !c.CheckPagePermission(parentPage, app.PageOperationRead) {
			return
		}

		// Extract wiki ID from the already-fetched parent page's Props
		parentWikiId, ok := parentPage.Props[model.PagePropsWikiID].(string)
		if !ok || parentWikiId == "" {
			// Fallback: get wiki_id from PropertyValues (source of truth)
			var wikiErr *model.AppError
			parentWikiId, wikiErr = c.App.GetWikiIdForPage(c.AppContext, *req.PageParentId)
			if wikiErr != nil || parentWikiId == "" {
				c.Err = model.NewAppError("movePage", "api.wiki.page_wiki_not_set.app_error", nil, "", http.StatusBadRequest)
				return
			}
		}
		if parentWikiId != c.Params.WikiId {
			c.Err = model.NewAppError("movePage", "api.wiki.move_page.parent_different_wiki.app_error", nil, "", http.StatusBadRequest)
			return
		}
	}

	if req.PageParentId != nil {
		model.AddEventParameterToAuditRec(auditRec, "page_parent_id", *req.PageParentId)
	}
	if req.SiblingIndex != nil {
		model.AddEventParameterToAuditRec(auditRec, "sibling_index", *req.SiblingIndex)
	}

	siblings, appErr := c.App.MovePage(c.AppContext, c.Params.PageId, req.PageParentId, c.Params.WikiId, req.SiblingIndex)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	// If siblings were updated, return them; otherwise return OK
	if siblings != nil {
		if err := json.NewEncoder(w).Encode(siblings); err != nil {
			c.Logger.Warn("Error writing response", mlog.Err(err))
		}
	} else {
		ReturnStatusOK(w)
	}
}

func movePageToWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	type MovePageRequest struct {
		TargetWikiId string  `json:"target_wiki_id"`
		PageParentId *string `json:"page_parent_id,omitempty"`
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

	if req.PageParentId != nil && *req.PageParentId != "" && !model.IsValidId(*req.PageParentId) {
		c.SetInvalidParam("page_parent_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventMovePageToWiki, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	model.AddEventParameterToAuditRec(auditRec, "source_wiki_id", c.Params.WikiId)
	model.AddEventParameterToAuditRec(auditRec, "target_wiki_id", req.TargetWikiId)
	if req.PageParentId != nil && *req.PageParentId != "" {
		model.AddEventParameterToAuditRec(auditRec, "page_parent_id", *req.PageParentId)
	}
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	sourceWiki, _, ok := c.GetWikiForModify()
	if !ok {
		return
	}

	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return
	}

	// Moving a page to a different wiki requires delete permission on the source
	// (you're removing it from this wiki) and create permission on the target
	// (you're adding it to that wiki). This aligns with Confluence's permission model.
	if !c.CheckPagePermission(page, app.PageOperationDelete) {
		return
	}

	targetWiki, err := c.App.GetWiki(c.AppContext, req.TargetWikiId)
	if err != nil {
		c.Err = err
		return
	}

	if sourceWiki.TeamId != targetWiki.TeamId {
		c.Err = model.NewAppError("movePageToWiki", "api.wiki_link.cross_team_not_allowed", nil, "", http.StatusBadRequest)
		return
	}

	if targetWiki.ChannelId == "" {
		c.Err = model.NewAppError("movePageToWiki", "api.wiki.no_channel.app_error", nil, "", http.StatusBadRequest)
		return
	}

	targetChannel, chanErr := c.App.GetWikiBackingChannel(c.AppContext, targetWiki.ChannelId)
	if chanErr != nil {
		c.Err = chanErr
		return
	}

	if !c.App.SessionHasWikiPermission(*c.AppContext.Session(), targetWiki, model.PermissionReadWiki) {
		c.SetPermissionError(model.PermissionReadWiki)
		return
	}

	if !c.CheckChannelPagePermission(targetChannel, app.PageOperationCreate) {
		return
	}

	if appErr := c.App.MovePageToWiki(c.AppContext, page, req.TargetWikiId, req.PageParentId, c.Params.WikiId, sourceWiki, targetWiki); appErr != nil {
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

	c.Logger.Debug("duplicatePage called",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("page_id", c.Params.PageId),
	)

	type DuplicatePageRequest struct {
		TargetWikiId string  `json:"target_wiki_id"`
		PageParentId *string `json:"page_parent_id,omitempty"`
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

	if req.PageParentId != nil && *req.PageParentId != "" && !model.IsValidId(*req.PageParentId) {
		c.SetInvalidParam("page_parent_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDuplicatePage, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	model.AddEventParameterToAuditRec(auditRec, "source_wiki_id", c.Params.WikiId)
	model.AddEventParameterToAuditRec(auditRec, "target_wiki_id", req.TargetWikiId)
	if req.Title != nil && *req.Title != "" {
		model.AddEventParameterToAuditRec(auditRec, "custom_title", *req.Title)
	}
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	// GetPageForRead validates source wiki exists, page belongs to it, and user has read permission
	page, _, _, ok := c.GetPageForRead()
	if !ok {
		return
	}

	// Get source wiki to enforce team isolation
	sourceWiki, srcErr := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if srcErr != nil {
		c.Err = srcErr
		return
	}

	targetWiki, err := c.App.GetWiki(c.AppContext, req.TargetWikiId)
	if err != nil {
		c.Err = err
		return
	}

	if sourceWiki.TeamId != targetWiki.TeamId {
		c.Err = model.NewAppError("duplicatePage", "api.wiki_link.cross_team_not_allowed", nil, "", http.StatusBadRequest)
		return
	}

	if targetWiki.ChannelId == "" {
		c.Err = model.NewAppError("duplicatePage", "api.wiki.no_channel.app_error", nil, "", http.StatusBadRequest)
		return
	}

	channel, chanErr := c.App.GetWikiBackingChannel(c.AppContext, targetWiki.ChannelId)
	if chanErr != nil {
		c.Err = chanErr
		return
	}

	if !c.App.SessionHasWikiPermission(*c.AppContext.Session(), targetWiki, model.PermissionReadWiki) {
		c.SetPermissionError(model.PermissionReadWiki)
		return
	}

	if !c.CheckChannelPagePermission(channel, app.PageOperationCreate) {
		return
	}

	duplicatedPage, appErr := c.App.DuplicatePage(c.AppContext, page, req.TargetWikiId, req.PageParentId, req.Title, c.AppContext.Session().UserId, targetWiki, channel)
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

	page, wiki, _, ok := c.GetPageForRead()
	if !ok {
		return
	}

	breadcrumbPath, appErr := c.App.BuildBreadcrumbPath(c.AppContext, page, wiki)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(breadcrumbPath); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
