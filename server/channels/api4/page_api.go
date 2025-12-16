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

func getWikiPages(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	if _, _, ok := c.RequireWikiReadPermission(); !ok {
		return
	}

	pages, appErr := c.App.GetWikiPages(c.AppContext, c.Params.WikiId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	c.Logger.Debug("API returning pages", mlog.Int("count", len(pages)), mlog.String("wiki_id", c.Params.WikiId))

	if err := json.NewEncoder(w).Encode(pages); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getWikiPage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	if _, ok := c.ValidatePageBelongsToWiki(); !ok {
		return
	}

	wiki, _, ok := c.RequireWikiReadPermission()
	if !ok {
		return
	}

	if wiki.DeleteAt != 0 {
		c.Err = model.NewAppError("getWikiPage", "api.wiki.get_page.wiki_deleted.app_error", nil, "", http.StatusNotFound)
		return
	}

	// GetPage loads page content from PageContent table and checks permissions
	page, appErr := c.App.GetPage(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(page); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deletePage", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	wiki, _, ok := c.RequirePageModifyPermission(app.PageOperationDelete, "deletePage")
	if !ok {
		return
	}

	if appErr := c.App.DeleteWikiPage(c.AppContext, c.Params.PageId, c.Params.WikiId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("page_id=" + c.Params.PageId + " wiki_id=" + c.Params.WikiId + " wiki_title=" + wiki.Title)

	ReturnStatusOK(w)
}

func createPage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	var req struct {
		Title        string `json:"title,omitempty"`
		PageParentId string `json:"page_parent_id,omitempty"`
		Content      string `json:"content,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	auditRec := c.MakeAuditRecord("createPage", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("parent_id", req.PageParentId)

	_, channel, ok := c.RequireWikiModifyPermission("createPage")
	if !ok {
		return
	}

	// Additive permission check: Need BOTH page permission (content) AND wiki permission (container)

	// Check page permission (content)
	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionCreatePage) {
		c.SetPermissionError(model.PermissionCreatePage)
		return
	}

	page, appErr := c.App.CreateWikiPage(c.AppContext, c.Params.WikiId, req.PageParentId, req.Title, req.Content, c.AppContext.Session().UserId, "", "")
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(page)
	auditRec.AddEventObjectType("page")

	// Broadcast page_published event (for direct page creation via API, not draft publishing)
	c.App.BroadcastPagePublished(page, c.Params.WikiId, page.ChannelId, "", c.AppContext.Session().UserId)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(page); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func updatePage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	var req struct {
		Title      string `json:"title,omitempty"`
		Content    string `json:"content,omitempty"`
		SearchText string `json:"search_text,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	auditRec := c.MakeAuditRecord("updatePage", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	_, _, ok := c.RequirePageModifyPermission(app.PageOperationEdit, "updatePage")
	if !ok {
		return
	}

	updatedPage, appErr := c.App.UpdatePage(c.AppContext, c.Params.PageId, req.Title, req.Content, req.SearchText)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedPage)
	auditRec.AddEventObjectType("page")

	if err := json.NewEncoder(w).Encode(updatedPage); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getChannelPages(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !model.IsValidId(c.Params.ChannelId) {
		c.SetInvalidParam("channel_id")
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	postList, err := c.App.GetChannelPages(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, postList)
	clientPostList, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
