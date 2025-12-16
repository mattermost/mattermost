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

func getPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	if _, _, ok := c.RequireWikiReadPermission(); !ok {
		return
	}

	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
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

	if !c.CheckWikiModifyPermission(channel) {
		return
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

	c.Logger.Info("API: deletePageDraft called",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("page_id", c.Params.PageId),
		mlog.String("user_id", c.AppContext.Session().UserId))

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

	if !c.CheckWikiModifyPermission(channel) {
		return
	}

	if appErr := c.App.DeletePageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func movePageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
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

	if !c.CheckWikiModifyPermission(channel) {
		return
	}

	var req struct {
		ParentId string `json:"parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	if appErr := c.App.MovePageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.PageId, req.ParentId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func getPageDraftsForWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	if _, _, ok := c.RequireWikiReadPermission(); !ok {
		return
	}

	pageDrafts, appErr := c.App.GetPageDraftsForWiki(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId)
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

	if !c.CheckWikiModifyPermission(channel) {
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

	if !c.CheckWikiModifyPermission(channel) {
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
	if existingPage, err := c.App.GetPage(c.AppContext, opts.PageId); err == nil {
		if !c.CheckPagePermission(existingPage, app.PageOperationEdit) {
			return
		}
	} else {
		if !c.CheckChannelPagePermission(channel, app.PageOperationCreate) {
			return
		}
	}

	post, appErr := c.App.PublishPageDraft(c.AppContext, c.AppContext.Session().UserId, opts)
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

func notifyEditorStopped(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	wiki, _, ok := c.RequireWikiReadPermission()
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
