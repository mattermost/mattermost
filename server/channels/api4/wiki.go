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
	api.BaseRoutes.Wiki.Handle("/pages", api.APISessionRequired(getWikiPages)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages", api.APISessionRequired(createPage)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(getWikiPage)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(addPageToWiki)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}", api.APISessionRequired(removePageFromWiki)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/breadcrumb", api.APISessionRequired(getPageBreadcrumb)).Methods(http.MethodGet)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/parent", api.APISessionRequired(updatePageParent)).Methods(http.MethodPut)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments", api.APISessionRequired(createPageComment)).Methods(http.MethodPost)
	api.BaseRoutes.Wiki.Handle("/pages/{page_id:[A-Za-z0-9]+}/comments/{parent_comment_id:[A-Za-z0-9]+}/replies", api.APISessionRequired(createPageCommentReply)).Methods(http.MethodPost)
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

	if err := c.App.HasPermissionToModifyWiki(c.AppContext, c.AppContext.Session(), channel, app.WikiOperationCreate, "createWiki"); err != nil {
		c.Err = err
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
	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	wiki, appErr := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if appErr != nil {
		c.Err = appErr
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

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	wikis, appErr := c.App.GetWikisForChannel(c.AppContext, c.Params.ChannelId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Return empty array instead of null when there are no wikis
	if wikis == nil {
		wikis = []*model.Wiki{}
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

	oldWiki, _, ok := c.RequireWikiModifyPermission(app.WikiOperationEdit, "updateWiki")
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

	oldWiki, _, ok := c.RequireWikiModifyPermission(app.WikiOperationDelete, "deleteWiki")
	if !ok {
		return
	}
	auditRec.AddEventPriorState(oldWiki)

	if appErr := c.App.DeleteWiki(c.AppContext, c.Params.WikiId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("wiki")
	c.LogAudit("title=" + oldWiki.Title)

	ReturnStatusOK(w)
}

func getWikiPages(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	pages, appErr := c.App.GetWikiPages(c.AppContext, c.Params.WikiId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Return empty array instead of null when there are no pages
	if pages == nil {
		pages = []*model.Post{}
	}

	// Debug logging before encoding
	for _, p := range pages {
		c.Logger.Debug("API returning page", mlog.String("post_id", p.Id), mlog.String("page_parent_id", p.PageParentId), mlog.Any("props", p.Props))
	}

	if err := json.NewEncoder(w).Encode(pages); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getWikiPage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("getWikiPage", "api.wiki.get_page.invalid_wiki", nil, "", http.StatusBadRequest)
		return
	}

	page, appErr := c.App.GetPage(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "getWikiPage"); err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(page); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addPageToWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("addPageToWiki", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	wiki, _, ok := c.RequireWikiModifyPermission(app.WikiOperationEdit, "addPageToWiki")
	if !ok {
		return
	}

	page, pageErr := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if pageErr != nil {
		c.Err = pageErr
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationEdit, "addPageToWiki"); err != nil {
		c.Err = err
		return
	}

	if page.ChannelId != wiki.ChannelId {
		c.Err = model.NewAppError("addPageToWiki", "api.wiki.add.channel_mismatch", nil, "", http.StatusBadRequest)
		return
	}

	if appErr := c.App.AddPageToWiki(c.AppContext, c.Params.PageId, c.Params.WikiId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("page_id=" + c.Params.PageId + " wiki_id=" + c.Params.WikiId + " wiki_title=" + wiki.Title)

	ReturnStatusOK(w)
}

func removePageFromWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("removePageFromWiki", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	wiki, _, ok := c.RequireWikiModifyPermission(app.WikiOperationDelete, "removePageFromWiki")
	if !ok {
		return
	}

	page, pageErr := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if pageErr != nil {
		c.Err = pageErr
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationDelete, "removePageFromWiki"); err != nil {
		c.Err = err
		return
	}

	if page.ChannelId != wiki.ChannelId {
		c.Err = model.NewAppError("removePageFromWiki", "api.wiki.remove.channel_mismatch", nil, "", http.StatusBadRequest)
		return
	}

	if appErr := c.App.RemovePageFromWiki(c.AppContext, c.Params.PageId, c.Params.WikiId); appErr != nil {
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
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	auditRec := c.MakeAuditRecord("createPage", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("parent_id", req.PageParentId)

	_, channel, ok := c.RequireWikiModifyPermission(app.WikiOperationEdit, "createPage")
	if !ok {
		return
	}

	// Additive permission check: Need BOTH page permission (content) AND wiki permission (container)

	// Check page permission (content)
	var pagePermission *model.Permission
	if channel.Type == model.ChannelTypeOpen {
		pagePermission = model.PermissionCreatePagePublicChannel
	} else {
		pagePermission = model.PermissionCreatePagePrivateChannel
	}
	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, pagePermission) {
		c.SetPermissionError(pagePermission)
		return
	}

	page, appErr := c.App.CreateWikiPage(c.AppContext, c.Params.WikiId, req.PageParentId, req.Title, "", c.AppContext.Session().UserId, "")
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(page)
	auditRec.AddEventObjectType("page")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(page); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}
func updatePageParent(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.invalid_wiki", nil, "", http.StatusBadRequest)
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

	auditRec := c.MakeAuditRecord("updatePageParent", model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "page_id", c.Params.PageId)
	model.AddEventParameterToAuditRec(auditRec, "new_parent_id", req.NewParentId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	post, err := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if err != nil {
		c.Err = err
		return
	}

	if post.Type != model.PostTypePage {
		c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.not_page.app_error", nil, "pageId="+c.Params.PageId, http.StatusBadRequest)
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), post, app.PageOperationEdit, "updatePageParent"); err != nil {
		c.Err = err
		return
	}

	if req.NewParentId != "" {
		newParent, err := c.App.GetPostIfAuthorized(c.AppContext, req.NewParentId, c.AppContext.Session(), false)
		if err != nil {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_not_found.app_error", nil, "parentId="+req.NewParentId, http.StatusNotFound).Wrap(err)
			return
		}

		if newParent.Type != model.PostTypePage {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.parent_not_page.app_error", nil, "parentId="+req.NewParentId, http.StatusBadRequest)
			return
		}

		if newParent.ChannelId != post.ChannelId {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.different_channel.app_error", nil, "postChannelId="+post.ChannelId+", parentChannelId="+newParent.ChannelId, http.StatusBadRequest)
			return
		}

		ancestors, err := c.App.GetPageAncestors(c.AppContext, req.NewParentId)
		if err != nil {
			c.Err = err
			return
		}

		if _, exists := ancestors.Posts[c.Params.PageId]; exists {
			c.Err = model.NewAppError("updatePageParent", "api.wiki.update_page_parent.circular_reference.app_error", nil, "pageId="+c.Params.PageId+", newParentId="+req.NewParentId, http.StatusBadRequest)
			return
		}
	}

	if appErr := c.App.ChangePageParent(c.AppContext, c.Params.PageId, req.NewParentId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
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

func getPageBreadcrumb(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	// Check wiki read permission
	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	// Verify page belongs to this wiki
	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("getPageBreadcrumb", "api.wiki.breadcrumb.invalid_wiki", nil, "", http.StatusBadRequest)
		return
	}

	// Get the page
	page, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Check if it's a page
	if page.Type != model.PostTypePage {
		c.SetInvalidParam("page_id")
		return
	}

	// Check permission to read page
	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "getPageBreadcrumb"); err != nil {
		c.Err = err
		return
	}

	// Build breadcrumb path
	breadcrumbPath, appErr := c.App.BuildBreadcrumbPath(c.AppContext, page)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(breadcrumbPath); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createPageComment(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	var req struct {
		Message      string         `json:"message"`
		InlineAnchor map[string]any `json:"inline_anchor"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	if req.Message == "" {
		c.SetInvalidParam("message")
		return
	}

	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("createPageComment", "api.wiki.create_comment.invalid_wiki", nil, "", http.StatusBadRequest)
		return
	}

	page, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if page.Type != model.PostTypePage {
		c.Err = model.NewAppError("createPageComment", "api.wiki.create_comment.not_page.app_error", nil, "pageId="+c.Params.PageId, http.StatusBadRequest)
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "createPageComment"); err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("createPageComment", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("page_id", c.Params.PageId)

	comment, appErr := c.App.CreatePageComment(c.AppContext, c.Params.PageId, req.Message, req.InlineAnchor)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(comment)
	auditRec.AddEventObjectType("page_comment")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(comment); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createPageCommentReply(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	c.RequireWikiReadPermission()
	if c.Err != nil {
		return
	}

	parentCommentId := c.Params.ParentCommentId
	if parentCommentId == "" || !model.IsValidId(parentCommentId) {
		c.SetInvalidParam("parent_comment_id")
		return
	}

	var req struct {
		Message string `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	if req.Message == "" {
		c.SetInvalidParam("message")
		return
	}

	pageWikiId, wikiErr := c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
	if wikiErr != nil {
		c.Err = wikiErr
		return
	}

	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("createPageCommentReply", "api.wiki.create_comment_reply.invalid_wiki", nil, "", http.StatusBadRequest)
		return
	}

	page, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PageId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if page.Type != model.PostTypePage {
		c.Err = model.NewAppError("createPageCommentReply", "api.wiki.create_comment_reply.not_page.app_error", nil, "pageId="+c.Params.PageId, http.StatusBadRequest)
		return
	}

	if err := c.App.HasPermissionToModifyPage(c.AppContext, c.AppContext.Session(), page, app.PageOperationRead, "createPageCommentReply"); err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("createPageCommentReply", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("page_id", c.Params.PageId)
	auditRec.AddMeta("parent_comment_id", parentCommentId)

	reply, appErr := c.App.CreatePageCommentReply(c.AppContext, c.Params.PageId, parentCommentId, req.Message)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(reply)
	auditRec.AddEventObjectType("page_comment_reply")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(reply); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
