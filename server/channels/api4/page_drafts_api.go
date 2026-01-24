// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func getPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	if _, _, ok := c.GetWikiForRead(); !ok {
		return
	}

	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Explicit ownership validation (defense-in-depth)
	if pageDraft.UserId != c.AppContext.Session().UserId {
		c.SetPermissionError(model.PermissionEditPage)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(pageDraft); err != nil {
		c.Logger.Warn("Error encoding page draft response", mlog.Err(err))
	}
}

func savePageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("savePageDraft", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	_, channel, ok := c.GetWikiForModify("savePageDraft")
	if !ok {
		return
	}

	// Check page permission based on whether this is a draft for an existing page or new page
	if existingPage, err := c.App.GetPage(c.AppContext, c.Params.PageId); err == nil {
		if !c.CheckPagePermission(existingPage, app.PageOperationEdit) {
			return
		}
	} else {
		// New page draft - require create permission
		if !c.CheckChannelPagePermission(channel, app.PageOperationCreate) {
			return
		}
	}

	var req struct {
		Content      string         `json:"content"`
		Title        string         `json:"title"`
		LastUpdateAt int64          `json:"last_updateat"`
		Props        map[string]any `json:"props"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	req.Title = strings.TrimSpace(req.Title)

	c.Logger.Debug("Received page draft save request",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("page_id", c.Params.PageId),
		mlog.Int("content_length", len(req.Content)),
		mlog.String("title", req.Title),
		mlog.Int("last_update_at", int(req.LastUpdateAt)),
		mlog.Any("props", req.Props))

	pageDraft, appErr := c.App.SavePageDraftWithMetadata(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, req.Content, req.Title, req.LastUpdateAt, req.Props)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(pageDraft)
	auditRec.AddEventObjectType("page_draft")

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(pageDraft); err != nil {
		c.Logger.Warn("Error encoding page draft response", mlog.Err(err))
	}
}

func deletePageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deletePageDraft", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	c.Logger.Info("API: deletePageDraft called",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("page_id", c.Params.PageId),
		mlog.String("user_id", c.AppContext.Session().UserId))

	if _, _, ok := c.GetWikiForModify("deletePageDraft"); !ok {
		return
	}

	// Explicit ownership validation before delete
	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if pageDraft.UserId != c.AppContext.Session().UserId {
		c.SetPermissionError(model.PermissionEditPage)
		return
	}

	if appErr := c.App.DeletePageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventPriorState(pageDraft)
	auditRec.AddEventObjectType("page_draft")

	ReturnStatusOK(w)
}

func movePageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("movePageDraft", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	if _, _, ok := c.GetWikiForModify("movePageDraft"); !ok {
		return
	}

	// Explicit ownership validation before move
	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if pageDraft.UserId != c.AppContext.Session().UserId {
		c.SetPermissionError(model.PermissionEditPage)
		return
	}

	var req struct {
		ParentId string `json:"parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	// Validate ParentId if provided
	if req.ParentId != "" && !model.IsValidId(req.ParentId) {
		c.SetInvalidParam("parent_id")
		return
	}

	auditRec.AddMeta("new_parent_id", req.ParentId)

	if appErr := c.App.MovePageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, req.ParentId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventPriorState(pageDraft)
	auditRec.AddEventObjectType("page_draft")

	ReturnStatusOK(w)
}

func getPageDraftsForWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	wiki, channel, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	pageDrafts, appErr := c.App.GetPageDraftsForWiki(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.Page*c.Params.PerPage, c.Params.PerPage, wiki, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if pageDrafts == nil {
		pageDrafts = []*model.PageDraft{}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(pageDrafts); err != nil {
		c.Logger.Warn("Error encoding page drafts response", mlog.Err(err))
	}
}

func createPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("createPageDraft", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)

	_, channel, ok := c.GetWikiForModify("createPageDraft")
	if !ok {
		return
	}

	// Check that user has permission to create pages in this channel
	if !c.CheckChannelPagePermission(channel, app.PageOperationCreate) {
		return
	}

	var req struct {
		Title        string `json:"title"`
		PageParentId string `json:"page_parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	req.Title = strings.TrimSpace(req.Title)

	// Validate parent page if provided
	if req.PageParentId != "" {
		if !model.IsValidId(req.PageParentId) {
			c.SetInvalidParam("page_parent_id")
			return
		}

		// First try to find as a published page
		parentPage, parentErr := c.App.GetPage(c.AppContext, req.PageParentId)
		if parentErr != nil {
			// Parent is not a published page - check if it's a draft
			// This allows creating child drafts under draft parents (not yet published)
			parentDraftExists, _, draftErr := c.App.CheckPageDraftExists(req.PageParentId, c.AppContext.Session().UserId)
			if draftErr != nil || !parentDraftExists {
				c.Err = model.NewAppError("createPageDraft", "api.draft.create.invalid_parent.app_error",
					nil, "parent page or draft not found", http.StatusBadRequest).Wrap(parentErr)
				return
			}
			// Parent exists as a draft for this user - no wiki validation needed since
			// drafts are wiki-scoped and we'll save the child with the same wiki ID
		} else {
			// Verify parent page belongs to the same wiki
			parentWikiId, _ := parentPage.Props[model.PagePropsWikiID].(string)
			if parentWikiId == "" {
				// Fallback: get wiki_id from PropertyValues (source of truth)
				var wikiErr *model.AppError
				parentWikiId, wikiErr = c.App.GetWikiIdForPage(c.AppContext, req.PageParentId)
				if wikiErr != nil || parentWikiId == "" {
					c.Err = model.NewAppError("createPageDraft", "api.wiki.page_wiki_not_set.app_error", nil, "", http.StatusBadRequest)
					return
				}
			}
			if parentWikiId != c.Params.WikiId {
				c.Err = model.NewAppError("createPageDraft", "api.draft.create.parent_different_wiki.app_error",
					nil, "parent page belongs to a different wiki", http.StatusBadRequest)
				return
			}
		}
	}

	// Generate server-side page ID
	pageId := model.NewId()

	placeholderContent := model.EmptyTipTapJSON

	c.Logger.Debug("Creating new page draft",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("page_id", pageId),
		mlog.String("title", req.Title),
		mlog.String("page_parent_id", req.PageParentId))

	props := map[string]any{}
	if req.PageParentId != "" {
		props["page_parent_id"] = req.PageParentId
	}

	pageDraft, appErr := c.App.SavePageDraftWithMetadata(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, pageId, placeholderContent, req.Title, 0, props)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(pageDraft)
	auditRec.AddEventObjectType("page_draft")

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(pageDraft); err != nil {
		c.Logger.Warn("Error encoding page draft response", mlog.Err(err))
	}
}

func publishPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("publishPageDraft", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	_, channel, ok := c.GetWikiForModify("publishPageDraft")
	if !ok {
		return
	}

	// Explicit ownership validation before publish
	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if pageDraft.UserId != c.AppContext.Session().UserId {
		c.SetPermissionError(model.PermissionEditPage)
		return
	}

	var opts model.PublishPageDraftOptions
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	// Set WikiId and PageId from URL params
	opts.WikiId = c.Params.WikiId
	opts.PageId = c.Params.PageId

	// Check page permissions based on whether this creates a new page or updates existing
	isNewPage := false
	if existingPage, err := c.App.GetPage(c.AppContext, opts.PageId); err == nil {
		if !c.CheckPagePermission(existingPage, app.PageOperationEdit) {
			return
		}
	} else {
		isNewPage = true
		if !c.CheckChannelPagePermission(channel, app.PageOperationCreate) {
			return
		}
	}
	auditRec.AddMeta("is_new_page", isNewPage)

	post, appErr := c.App.PublishPageDraft(c.AppContext, c.AppContext.Session().UserId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(post)
	auditRec.AddEventObjectType("page")

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(post); err != nil {
		c.Logger.Warn("Error encoding post response", mlog.Err(err))
	}
}

func notifyEditorStopped(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	wiki, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	userId := c.AppContext.Session().UserId
	pageId := c.Params.PageId

	message := model.NewWebSocketEvent(model.WebsocketEventPageEditorStopped, "", wiki.ChannelId, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	c.App.Publish(message)

	ReturnStatusOK(w)
}
