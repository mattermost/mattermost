// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitDrafts() {
	api.BaseRoutes.Drafts.Handle("", api.APISessionRequired(upsertDraft)).Methods(http.MethodPost)

	api.BaseRoutes.TeamForUser.Handle("/drafts", api.APISessionRequired(getDrafts)).Methods(http.MethodGet)

	api.BaseRoutes.ChannelForUser.Handle("/drafts/{thread_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteDraft)).Methods(http.MethodDelete)
	api.BaseRoutes.ChannelForUser.Handle("/drafts", api.APISessionRequired(deleteDraft)).Methods(http.MethodDelete)

	api.BaseRoutes.Wiki.Handle("/drafts/{draft_id:[A-Za-z0-9-]+}", api.APISessionRequired(getPageDraft)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/drafts/{draft_id:[A-Za-z0-9-]+}", api.APISessionRequired(savePageDraft)).Methods(http.MethodPut)
	api.BaseRoutes.Wiki.Handle("/drafts/{draft_id:[A-Za-z0-9-]+}", api.APISessionRequired(deletePageDraft)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/drafts/{draft_id:[A-Za-z0-9-]+}/publish", api.APISessionRequired(publishPageDraft)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/drafts", api.APISessionRequired(getPageDraftsForWiki)).Methods(http.MethodGet)
}

func upsertDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("upsertDraft", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	var draft model.Draft
	if jsonErr := json.NewDecoder(r.Body).Decode(&draft); jsonErr != nil {
		c.SetInvalidParam("draft")
		return
	}

	draft.DeleteAt = 0
	draft.UserId = c.AppContext.Session().UserId
	connectionID := r.Header.Get(model.ConnectionId)

	hasPermission := false

	if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), draft.ChannelId, model.PermissionCreatePost) {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(c.AppContext, draft.ChannelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	dt, err := c.App.UpsertDraft(c.AppContext, &draft, connectionID)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)

	if err := json.NewEncoder(w).Encode(dt); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getDrafts(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("getDrafts", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	hasPermission := false

	if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		hasPermission = true
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	drafts, err := c.App.GetDraftsForUser(c.AppContext, c.AppContext.Session().UserId, c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	// Return empty array instead of null when there are no drafts
	if drafts == nil {
		drafts = []*model.Draft{}
	}

	if err := json.NewEncoder(w).Encode(drafts); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("deleteDraft", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	rootID := ""

	connectionID := r.Header.Get(model.ConnectionId)

	if c.Params.ThreadId != "" {
		rootID = c.Params.ThreadId
	}

	userID := c.AppContext.Session().UserId
	channelID := c.Params.ChannelId

	draft, err := c.App.GetDraft(userID, channelID, rootID)
	if err != nil {
		switch {
		case err.StatusCode == http.StatusNotFound:
			// If the draft doesn't exist in the server, we don't need to delete.
			ReturnStatusOK(w)
		default:
			c.Err = err
		}
		return
	}

	if c.AppContext.Session().UserId != draft.UserId {
		c.SetPermissionError(model.PermissionDeletePost)
		return
	}

	if err := c.App.DeleteDraft(c.AppContext, draft, connectionID); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequireDraftId()
	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	draft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.DraftId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(draft); err != nil {
		c.Logger.Warn("Error encoding draft response", mlog.Err(err))
	}
}

func savePageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequireDraftId()
	c.RequireWikiWritePermission()
	if c.Err != nil {
		return
	}

	var req struct {
		Message string         `json:"message"`
		Title   string         `json:"title"`
		PageId  string         `json:"page_id"`
		Props   map[string]any `json:"props"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	c.Logger.Debug("Received page draft save request",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("draft_id", c.Params.DraftId),
		mlog.String("message", req.Message),
		mlog.Int("message_length", len(req.Message)),
		mlog.String("title", req.Title),
		mlog.String("page_id", req.PageId),
		mlog.Any("props", req.Props))

	draft, appErr := c.App.SavePageDraftWithMetadata(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.DraftId, req.Message, req.Title, req.PageId, req.Props)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(draft); err != nil {
		c.Logger.Warn("Error encoding draft response", mlog.Err(err))
	}
}

func deletePageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequireDraftId()
	c.RequireWikiWritePermission()
	if c.Err != nil {
		return
	}

	if appErr := c.App.DeletePageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.DraftId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func getPageDraftsForWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	drafts, appErr := c.App.GetPageDraftsForWiki(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Return empty array instead of null when there are no drafts
	if drafts == nil {
		drafts = []*model.Draft{}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(drafts); err != nil {
		c.Logger.Warn("Error encoding drafts response", mlog.Err(err))
	}
}

func publishPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequireDraftId()
	c.RequireWikiWritePermission()
	if c.Err != nil {
		return
	}

	var req struct {
		PageParentId string `json:"page_parent_id"`
		Title        string `json:"title"`
		SearchText   string `json:"search_text"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	post, appErr := c.App.PublishPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.DraftId, req.PageParentId, req.Title, req.SearchText)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(post); err != nil {
		c.Logger.Warn("Error encoding post response", mlog.Err(err))
	}
}
