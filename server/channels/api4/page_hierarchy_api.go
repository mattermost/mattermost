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

	// Check wiki modify permission first (includes channel deletion check)
	if _, _, ok := c.GetWikiForModify("updatePageParent"); !ok {
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
		// GetPage validates the post exists and is a page type
		parentPage, err := c.App.GetPage(c.AppContext, req.NewParentId)
		if err != nil {
			if err.Id == "app.page.get.not_a_page.app_error" {
				c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_not_page.app_error", nil, "", http.StatusBadRequest)
				return
			}
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
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
			parentWikiId, wikiErr = c.App.GetWikiIdForPage(c.AppContext, req.NewParentId)
			if wikiErr != nil || parentWikiId == "" {
				c.Err = model.NewAppError("updatePageParent", "api.wiki.page_wiki_not_set.app_error", nil, "", http.StatusBadRequest)
				return
			}
		}
		if parentWikiId != c.Params.WikiId {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_different_wiki.app_error", nil, "", http.StatusBadRequest)
			return
		}
	}

	auditRec := c.MakeAuditRecord("updatePageParent", model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	model.AddEventParameterToAuditRec(auditRec, "new_parent_id", req.NewParentId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	if appErr := c.App.ChangePageParent(c.AppContext, c.Params.PageId, req.NewParentId, c.Params.WikiId); appErr != nil {
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

	sourceWiki, _, ok := c.GetWikiForModify("movePageToWiki")
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

	targetChannel, chanErr := c.App.GetChannel(c.AppContext, targetWiki.ChannelId)
	if chanErr != nil {
		c.Err = chanErr
		return
	}

	if !c.CheckChannelPagePermission(targetChannel, app.PageOperationCreate) {
		return
	}

	if appErr := c.App.MovePageToWiki(c.AppContext, page, req.TargetWikiId, req.ParentPageId, c.Params.WikiId, sourceWiki, targetWiki); appErr != nil {
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

	page, err := c.App.GetPage(c.AppContext, c.Params.PageId)
	if err != nil {
		c.Logger.Error("GetPage failed in duplicatePage",
			mlog.String("page_id", c.Params.PageId),
			mlog.Err(err),
		)
		c.Err = err
		return
	}
	c.Logger.Info("GetPage succeeded", mlog.String("page_id", page.Id))

	if !c.CheckPagePermission(page, app.PageOperationRead) {
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

	if !c.CheckChannelPagePermission(channel, app.PageOperationCreate) {
		return
	}

	duplicatedPage, appErr := c.App.DuplicatePage(c.AppContext, page, req.TargetWikiId, req.ParentPageId, req.Title, c.AppContext.Session().UserId, targetWiki, channel)
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

	// Use GetPageForRead to get page, wiki, and channel in one operation
	page, wiki, channel, ok := c.GetPageForRead()
	if !ok {
		return
	}

	if !c.CheckPagePermission(page, app.PageOperationRead) {
		return
	}

	// Fetch team once here to pass to BuildBreadcrumbPath, avoiding a redundant fetch
	team, teamErr := c.App.GetTeam(channel.TeamId)
	if teamErr != nil {
		c.Err = teamErr
		return
	}

	breadcrumbPath, appErr := c.App.BuildBreadcrumbPath(c.AppContext, page, wiki, channel, team)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(breadcrumbPath); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
