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
	c.RequireDraftId()
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

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	pageDraft, appErr := c.App.GetPageDraft(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.DraftId)
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
	c.RequireDraftId()
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

	if err := c.App.HasPermissionToModifyWiki(c.AppContext, c.AppContext.Session(), channel, app.WikiOperationEdit, "savePageDraft"); err != nil {
		c.Err = err
		return
	}

	var req struct {
		Content string         `json:"content"`
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
		mlog.Int("content_length", len(req.Content)),
		mlog.String("title", req.Title),
		mlog.String("page_id", req.PageId),
		mlog.Any("props", req.Props))

	pageDraft, appErr := c.App.SavePageDraftWithMetadata(c.AppContext, c.AppContext.Session().UserId, c.Params.WikiId, c.Params.DraftId, req.Content, req.Title, req.PageId, req.Props)
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
	c.RequireDraftId()
	if c.Err != nil {
		return
	}

	c.Logger.Info("API: deletePageDraft called",
		mlog.String("wiki_id", c.Params.WikiId),
		mlog.String("draft_id", c.Params.DraftId),
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

	if err := c.App.HasPermissionToModifyWiki(c.AppContext, c.AppContext.Session(), channel, app.WikiOperationEdit, "deletePageDraft"); err != nil {
		c.Err = err
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

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
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

func publishPageDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequireDraftId()
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

	if err := c.App.HasPermissionToModifyWiki(c.AppContext, c.AppContext.Session(), channel, app.WikiOperationEdit, "publishPageDraft"); err != nil {
		c.Err = err
		return
	}

	var opts model.PublishPageDraftOptions
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	// Set WikiId and DraftId from URL params (API layer responsibility)
	opts.WikiId = c.Params.WikiId
	opts.DraftId = c.Params.DraftId

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
	c.RequireDraftId()
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

	userId := c.AppContext.Session().UserId
	pageId := c.Params.DraftId

	message := model.NewWebSocketEvent(model.WebsocketEventPageEditorStopped, "", channel.Id, "", nil, "")
	message.Add("page_id", pageId)
	message.Add("user_id", userId)
	c.App.Publish(message)

	ReturnStatusOK(w)
}
