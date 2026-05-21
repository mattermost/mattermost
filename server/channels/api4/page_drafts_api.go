// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Page draft handlers use GetWikiForRead rather than GetWikiForModify on the
// save / delete / move / publish paths. Rationale: drafts are user-scoped and
// stored on the Drafts table keyed by (UserId, WikiId, PageId). A user who
// can read the wiki may privately draft against it without needing write
// permission on the wiki itself; the draft is not visible to others until
// published. Published drafts then go through the regular page create/update
// path which DOES check write permissions. Ownership of the draft is
// enforced by GetPageDraft(userId, ...) below — callers can only see/modify
// their own drafts.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitPageDrafts() {
	api.BaseRoutes.Wiki.Handle("/drafts", api.APISessionRequired(createPageDraft)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/drafts", api.APISessionRequired(getPageDraftsForWiki)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/drafts/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(getPageDraft)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/drafts/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(savePageDraft)).Methods(http.MethodPut)
	api.BaseRoutes.Wiki.Handle("/drafts/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(deletePageDraft)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/drafts/{page_id:[A-Za-z0-9]+}/move", api.APISessionRequired(movePageDraft)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/drafts/{page_id:[A-Za-z0-9]+}/publish", api.APISessionRequired(publishPageDraft)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/drafts/{page_id:[A-Za-z0-9]+}/editor_stopped", api.APISessionRequired(notifyEditorStopped)).Methods(http.MethodPost)
}

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

	// GetPageDraft already filters by session user; a returned draft belongs to
	// the caller. Keep a 404 on ownership mismatch for defense-in-depth so the
	// response matches sibling draft handlers and doesn't leak existence of
	// other users' drafts.
	if pageDraft.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("getPageDraft", "api.page_draft.not_found.app_error", nil, "", http.StatusNotFound)
		return
	}

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

	auditRec := c.MakeAuditRecord(model.AuditEventSavePageDraft, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	_, channel, ok := c.GetWikiForRead()
	if !ok {
		return
	}
	if channel == nil {
		c.Err = model.NewAppError("savePageDraft", "api.wiki.no_channel.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Check page permission based on whether this is a draft for an existing page or new page
	if existingPage, err := c.App.GetPage(c.AppContext, c.Params.PageId); err == nil {
		if existingPage.ChannelId != channel.Id {
			c.Err = model.NewAppError("savePageDraft", "api.wiki.page_wiki_mismatch.app_error", nil, "", http.StatusBadRequest)
			return
		}
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

	r.Body = http.MaxBytesReader(w, r.Body, model.PageContentMaxSize)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.Err = model.NewAppError("savePageDraft", "api.page.save_draft.title_empty.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if len(req.Title) > model.MaxPageTitleLength {
		c.Err = model.NewAppError("savePageDraft", "api.page.save_draft.title_too_long.app_error",
			map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		return
	}

	pageDraft, appErr := c.App.SavePageDraftWithMetadata(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, req.Content, req.Title, req.LastUpdateAt, req.Props)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(pageDraft)
	auditRec.AddEventObjectType("page_draft")

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

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePageDraft, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	if _, _, ok := c.GetWikiForRead(); !ok {
		return
	}

	// GetPageDraft filters by session user, so a successful fetch already means
	// the draft belongs to the caller; no extra ownership check needed here.
	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventPriorState(pageDraft)

	if appErr := c.App.DeletePageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("page_draft")

	ReturnStatusOK(w)
}

func movePageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventMovePageDraft, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	if _, _, ok := c.GetWikiForRead(); !ok {
		return
	}

	// GetPageDraft filters by session user, so a successful fetch already means
	// the draft belongs to the caller; no extra ownership check needed here.
	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, true)
	if appErr != nil {
		c.Err = appErr
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

	if req.ParentId != "" {
		parentPage, appErr := c.App.GetPage(c.AppContext, req.ParentId)
		if appErr != nil {
			c.Err = appErr
			return
		}
		if !c.CheckPagePermission(parentPage, app.PageOperationRead) {
			return
		}
		parentWikiId, appErr := c.App.GetWikiIdForPage(c.AppContext, parentPage.Id)
		if appErr != nil {
			c.Err = appErr
			return
		}
		if parentWikiId != c.Params.WikiId {
			c.SetInvalidParam("parent_id")
			return
		}
	}

	auditRec.AddMeta("new_parent_id", req.ParentId)
	auditRec.AddEventPriorState(pageDraft)

	if appErr := c.App.MovePageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, req.ParentId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
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

	if err := json.NewEncoder(w).Encode(pageDrafts); err != nil {
		c.Logger.Warn("Error encoding page drafts response", mlog.Err(err))
	}
}

func createPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePageDraft, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)

	_, channel, ok := c.GetWikiForRead()
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
	if req.Title == "" {
		c.Err = model.NewAppError("createPageDraft", "api.page.create_draft.title_empty.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if len(req.Title) > model.MaxPageTitleLength {
		c.Err = model.NewAppError("createPageDraft", "api.page.save_draft.title_too_long.app_error",
			map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		return
	}

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

			parentDraftExists, draftErr := c.App.CheckPageDraftExists(c.AppContext, req.PageParentId, c.AppContext.Session().UserId, c.Params.WikiId)
			if draftErr != nil || !parentDraftExists {
				var wrapErr error
				if draftErr != nil {
					wrapErr = draftErr
				} else {
					wrapErr = parentErr
				}
				c.Err = model.NewAppError("createPageDraft", "api.draft.create.invalid_parent.app_error",
					nil, "parent page or draft not found", http.StatusBadRequest).Wrap(wrapErr)
				return
			}
			// Parent exists as a draft for this user - no wiki validation needed since
			// drafts are wiki-scoped and we'll save the child with the same wiki ID
		} else {
			if !c.CheckPagePermission(parentPage, app.PageOperationRead) {
				return
			}
			parentWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, parentPage.Id)
			if wikiErr != nil || parentWikiId == "" {
				c.Err = model.NewAppError("createPageDraft", "api.wiki.page_wiki_not_set.app_error", nil, "", http.StatusBadRequest)
				return
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

	props := map[string]any{
		model.PagePropsTitle: req.Title,
	}
	if req.PageParentId != "" {
		props[model.DraftPropsPageParentID] = req.PageParentId
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

	auditRec := c.MakeAuditRecord(model.AuditEventPublishPageDraft, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	// GetWikiForModify already enforces read access + guest restriction; using it upfront
	// avoids a second wiki round-trip on the new-page path.
	_, channel, ok := c.GetWikiForModify()
	if !ok {
		return
	}

	// GetPageDraft filters by session user, so a successful fetch already means
	// the draft belongs to the caller; no extra ownership check needed here.
	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(pageDraft)

	var opts model.PublishPageDraftOptions
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	// Set WikiId and PageId from URL params
	opts.WikiId = c.Params.WikiId
	opts.PageId = c.Params.PageId

	// Check page permissions based on whether this creates a new page or updates existing.
	// Publishing a draft as a new page is a write operation equivalent to createPage, so
	// it requires page-create permission in addition to the wiki access already checked above.
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

	if isNewPage {
		w.WriteHeader(http.StatusCreated)
	}
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

	wiki, channel, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	if !c.CheckChannelPagePermission(channel, app.PageOperationEdit) {
		return
	}

	// Active-editors entries on connected clients are keyed by pageId; the
	// server-side page record is irrelevant. Broadcast unconditionally so
	// stale indicators clear even when the page is gone or never existed
	// (deleted, moved, or never-published draft). The audience is the linked
	// source channels of this wiki, resolved by BroadcastPageEditorStopped via
	// publishDraftEventToWikiAuthorizedUsers → WikiLinkStore.GetByWiki. A forged pageId
	// is harmless: no client has that key in its map.
	userId := c.AppContext.Session().UserId
	c.App.BroadcastPageEditorStopped(c.AppContext, wiki, c.Params.PageId, userId)

	ReturnStatusOK(w)
}
