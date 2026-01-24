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

func (api *API) InitWiki() {
	api.BaseRoutes.Wikis.Handle("", api.APISessionRequired(createWiki)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("", api.APISessionRequired(getWiki)).Methods(http.MethodGet)
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/wikis", api.APISessionRequired(listChannelWikis)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("", api.APISessionRequired(updateWiki)).Methods(http.MethodPatch)
	api.BaseRoutes.Wiki.Handle("", api.APISessionRequired(deleteWiki)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/move", api.APISessionRequired(moveWikiToChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages", api.APISessionRequired(getWikiPages)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages", api.APISessionRequired(createPage)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(getWikiPage)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(updatePage)).Methods(http.MethodPut)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(deletePage)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/restore", api.APISessionRequired(restorePage)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/active_editors", api.APISessionRequired(getPageActiveEditors)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/version_history", api.APISessionRequired(getPageVersionHistory)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/breadcrumb", api.APISessionRequired(getPageBreadcrumb)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/parent", api.APISessionRequired(updatePageParent)).Methods(http.MethodPut)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/move", api.APISessionRequired(movePageToWiki)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/duplicate", api.APISessionRequired(duplicatePage)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments", api.APISessionRequired(getPageComments)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments", api.APISessionRequired(createPageComment)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{parent_comment_id:[A-Za-z0-9]+}/replies", api.APISessionRequired(createPageCommentReply)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{comment_id:[A-Za-z0-9]+}/resolve", api.APISessionRequired(resolvePageComment)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{comment_id:[A-Za-z0-9]+}/unresolve", api.APISessionRequired(unresolvePageComment)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/extract-image", api.APISessionRequired(extractPageImageText)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/summarize-thread", api.APISessionRequired(summarizeThreadToPage)).Methods(http.MethodPost)
	api.BaseRoutes.Channel.Handle("/pages", api.APISessionRequired(getChannelPages)).Methods(http.MethodGet)
}

func createWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	var wiki model.Wiki
	if err := json.NewDecoder(r.Body).Decode(&wiki); err != nil {
		c.SetInvalidParamWithErr("wiki", err)
		return
	}

	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("createWiki", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("channel_id", wiki.ChannelId)

	if !model.IsValidId(wiki.ChannelId) {
		c.SetInvalidParam("channel_id")
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, wiki.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("createWiki", "api.wiki.create.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.CheckWikiModifyPermission(channel) {
		return
	}

	// Wiki creation also requires CreatePage permission since it creates a default draft page
	// that will need to be published. Without this check, users could create wikis but be
	// unable to publish the default page if manage_pages moderation is disabled.
	if !c.CheckChannelPagePermission(channel, app.PageOperationCreate) {
		return
	}

	createdWiki, appErr := c.App.CreateWiki(c.AppContext, &wiki, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(createdWiki)
	auditRec.AddEventObjectType("wiki")
	c.LogAudit("title=" + createdWiki.Title)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdWiki); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	wiki, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	if err := json.NewEncoder(w).Encode(wiki); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func listChannelWikis(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if hasPermission, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	wikis, appErr := c.App.GetWikisForChannel(c.AppContext, c.Params.ChannelId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(wikis); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	var wiki model.Wiki
	if err := json.NewDecoder(r.Body).Decode(&wiki); err != nil {
		c.SetInvalidParamWithErr("wiki", err)
		return
	}
	wiki.Id = c.Params.WikiId

	auditRec := c.MakeAuditRecord("updateWiki", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", wiki.Id)

	oldWiki, _, ok := c.GetWikiForModify("updateWiki")
	if !ok {
		return
	}
	auditRec.AddEventPriorState(oldWiki)

	wiki.ChannelId = oldWiki.ChannelId

	updatedWiki, appErr := c.App.UpdateWiki(c.AppContext, &wiki)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedWiki)
	auditRec.AddEventObjectType("wiki")

	auditMsg := "title=" + updatedWiki.Title
	if oldWiki.Title != updatedWiki.Title {
		auditMsg += " (changed from '" + oldWiki.Title + "')"
	}
	c.LogAudit(auditMsg)

	if err := json.NewEncoder(w).Encode(updatedWiki); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deleteWiki", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)

	oldWiki, _, ok := c.GetWikiForModify("deleteWiki")
	if !ok {
		return
	}
	auditRec.AddEventPriorState(oldWiki)

	if appErr := c.App.DeleteWiki(c.AppContext, c.Params.WikiId, c.AppContext.Session().UserId, oldWiki); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("wiki")
	c.LogAudit("title=" + oldWiki.Title)

	ReturnStatusOK(w)
}

func moveWikiToChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	var req struct {
		TargetChannelId string `json:"target_channel_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	if !model.IsValidId(req.TargetChannelId) {
		c.SetInvalidParam("target_channel_id")
		return
	}

	wiki, _, ok := c.GetWikiForModify("moveWikiToChannel")
	if !ok {
		return
	}

	targetChannel, err := c.App.GetChannel(c.AppContext, req.TargetChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if !c.CheckWikiModifyPermission(targetChannel) {
		return
	}

	auditRec := c.MakeAuditRecord("moveWikiToChannel", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "wiki_id", c.Params.WikiId)
	model.AddEventParameterToAuditRec(auditRec, "source_channel_id", wiki.ChannelId)
	model.AddEventParameterToAuditRec(auditRec, "target_channel_id", req.TargetChannelId)

	movedWiki, appErr := c.App.MoveWikiToChannel(c.AppContext, wiki, targetChannel, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(movedWiki)

	if err := json.NewEncoder(w).Encode(movedWiki); err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func getPageActiveEditors(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	// Use GetPageForRead to combine page validation and wiki/channel fetch in one operation
	pagePost, _, channel, ok := c.GetPageForRead()
	if !ok {
		return
	}

	if channel.DeleteAt != 0 {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if !c.CheckPagePermission(pagePost, app.PageOperationRead) {
		return
	}

	activeEditors, appErr := c.App.GetPageActiveEditors(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Header().Set("Cache-Control", "max-age=10")
	if err := json.NewEncoder(w).Encode(activeEditors); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPageVersionHistory(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	// Use GetPageForRead to combine page validation and wiki/channel fetch in one operation
	pagePost, _, channel, ok := c.GetPageForRead()
	if !ok {
		return
	}

	if channel.DeleteAt != 0 {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if !c.CheckPagePermission(pagePost, app.PageOperationRead) {
		return
	}

	versionHistory, appErr := c.App.GetPageVersionHistory(c.AppContext, c.Params.PageId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(versionHistory); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
