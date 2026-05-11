// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitWiki() {
	api.BaseRoutes.Wikis.Handle("", api.APISessionRequired(createWiki)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("", api.APISessionRequired(getWiki)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/wikis", api.APISessionRequired(listChannelWikis)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("", api.APISessionRequired(updateWiki)).Methods(http.MethodPatch)
	api.BaseRoutes.Wiki.Handle("", api.APISessionRequired(deleteWiki)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/pages", api.APISessionRequired(getWikiPages)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages", api.APISessionRequired(createPage)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(getWikiPage)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(updatePage)).Methods(http.MethodPut)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(deletePage)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/restore", api.APISessionRequired(restorePage)).Methods(http.MethodPatch)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/active_editors", api.APISessionRequired(getPageActiveEditors)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/version_history", api.APISessionRequired(getPageVersionHistory)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/breadcrumb", api.APISessionRequired(getPageBreadcrumb)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/move", api.APISessionRequired(movePage)).Methods(http.MethodPut)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/move-to-wiki", api.APISessionRequired(movePageToWiki)).Methods(http.MethodPatch)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/duplicate", api.APISessionRequired(duplicatePage)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments", api.APISessionRequired(getPageComments)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments", api.APISessionRequired(createPageComment)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{parent_comment_id:[A-Za-z0-9]+}/replies", api.APISessionRequired(createPageCommentReply)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{comment_id:[A-Za-z0-9]+}", api.APISessionRequired(deletePageComment)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{comment_id:[A-Za-z0-9]+}/resolve", api.APISessionRequired(resolvePageComment)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{comment_id:[A-Za-z0-9]+}/unresolve", api.APISessionRequired(unresolvePageComment)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/status", api.APISessionRequired(updatePageStatus)).Methods(http.MethodPatch)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/status", api.APISessionRequired(getPageStatus)).Methods(http.MethodGet)
	api.BaseRoutes.Wikis.Handle("/page-status-field", api.APISessionRequired(getPageStatusField)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/extract-image", api.APISessionRequired(extractPageImageText)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/summarize-thread", api.APISessionRequired(summarizeThreadToPage)).Methods(http.MethodPost)
	api.BaseRoutes.Channel.Handle("/pages", api.APISessionRequired(getChannelPages)).Methods(http.MethodGet)
	api.BaseRoutes.TeamWikis.Handle("", api.APISessionRequired(getTeamWikis)).Methods(http.MethodGet)
}

func createWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var wiki model.Wiki
	if err := json.NewDecoder(r.Body).Decode(&wiki); err != nil {
		c.SetInvalidParamWithErr("wiki", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateWiki, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("team_id", wiki.TeamId)

	if !model.IsValidId(wiki.TeamId) {
		c.Err = model.NewAppError("createWiki", "api.wiki.create.missing_team", nil, "", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(wiki.Title) == "" {
		c.Err = model.NewAppError("createWiki", "api.wiki.create.missing_title.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if utf8.RuneCountInString(wiki.Title) > model.WikiTitleMaxRunes {
		c.Err = model.NewAppError("createWiki", "api.wiki.create.title_too_long.app_error",
			map[string]any{"MaxLength": model.WikiTitleMaxRunes}, "", http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), wiki.TeamId, model.PermissionCreateWiki) {
		c.SetPermissionError(model.PermissionCreateWiki)
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

	wikis, appErr := c.App.GetWikisLinkedToChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(wikis); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getTeamWikis(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	perPage := max(1, min(c.Params.PerPage, 200))
	wikis, appErr := c.App.GetUserWikis(c.AppContext, c.AppContext.Session().UserId, c.Params.TeamId, c.Params.Page, perPage)
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

	// Bound the request body to mitigate resource-exhaustion on the update path.
	// 1 MiB is generous for title/description fields while rejecting abusive uploads.
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var wiki model.Wiki
	if err := json.NewDecoder(r.Body).Decode(&wiki); err != nil {
		c.SetInvalidParamWithErr("wiki", err)
		return
	}
	wiki.Id = c.Params.WikiId

	if wiki.Title != "" && strings.TrimSpace(wiki.Title) == "" {
		c.Err = model.NewAppError("updateWiki", "api.wiki.update.missing_title.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if utf8.RuneCountInString(wiki.Title) > model.WikiTitleMaxRunes {
		c.Err = model.NewAppError("updateWiki", "api.wiki.update.title_too_long.app_error",
			map[string]any{"MaxLength": model.WikiTitleMaxRunes}, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateWiki, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", wiki.Id)

	oldWiki, _, ok := c.GetWikiForModify()
	if !ok {
		return
	}
	auditRec.AddEventPriorState(oldWiki)

	if !c.App.SessionHasWikiPermission(*c.AppContext.Session(), oldWiki, model.PermissionManageWiki) {
		c.SetPermissionError(model.PermissionManageWiki)
		return
	}

	wiki.ChannelId = oldWiki.ChannelId
	wiki.CreateAt = oldWiki.CreateAt
	wiki.TeamId = oldWiki.TeamId
	wiki.CreatorId = oldWiki.CreatorId

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

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteWiki, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)

	oldWiki, _, ok := c.GetWikiForModify()
	if !ok {
		return
	}
	auditRec.AddEventPriorState(oldWiki)

	if !c.App.SessionHasWikiPermission(*c.AppContext.Session(), oldWiki, model.PermissionDeleteWiki) {
		c.SetPermissionError(model.PermissionDeleteWiki)
		return
	}

	if appErr := c.App.DeleteWiki(c.AppContext, c.Params.WikiId, c.AppContext.Session().UserId, oldWiki); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("wiki")
	c.LogAudit("title=" + oldWiki.Title)

	ReturnStatusOK(w)
}

func getPageActiveEditors(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	// Use GetPageForRead to combine page validation and wiki/channel fetch in one operation
	_, _, channel, ok := c.GetPageForRead()
	if !ok {
		return
	}

	if channel.DeleteAt != 0 {
		c.SetPermissionError(model.PermissionReadChannel)
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
	_, _, channel, ok := c.GetPageForRead()
	if !ok {
		return
	}

	if channel != nil && channel.DeleteAt != 0 {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	// GetPageForRead already enforces PermissionReadPage; no extra check needed.

	perPage := min(c.Params.PerPage, model.PostEditHistoryLimit)
	versionHistory, appErr := c.App.GetPageVersionHistory(c.AppContext, c.Params.PageId, c.Params.Page*perPage, perPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(versionHistory); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
