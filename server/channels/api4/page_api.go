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

func getWikiPages(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	wiki, channel, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	if wiki.DeleteAt != 0 {
		c.Err = model.NewAppError("getWikiPages", "api.wiki.get_pages.wiki_deleted.app_error", nil, "", http.StatusNotFound)
		return
	}

	// Guests cannot access pages in DM/Group channels
	if channel.Type == model.ChannelTypeGroup || channel.Type == model.ChannelTypeDirect {
		if c.AppContext.Session().IsGuest() {
			c.Err = model.NewAppError("getWikiPages", "api.page.permission.guest_cannot_access.app_error", nil, "", http.StatusForbidden)
			return
		}
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

	wiki, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	if wiki.DeleteAt != 0 {
		c.Err = model.NewAppError("getWikiPage", "api.wiki.get_page.wiki_deleted.app_error", nil, "", http.StatusNotFound)
		return
	}

	page, appErr := c.App.GetPageWithContent(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !c.CheckPagePermission(page, app.PageOperationRead) {
		return
	}

	// Validate page belongs to the wiki in URL (using already-fetched page)
	pageWikiId, wikiIdOk := page.Props[model.PagePropsWikiID].(string)
	if !wikiIdOk || pageWikiId == "" {
		// Fallback: get wiki_id from PropertyValues (source of truth)
		var wikiErr *model.AppError
		pageWikiId, wikiErr = c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
		if wikiErr != nil || pageWikiId == "" {
			c.Err = model.NewAppError("getWikiPage", "api.wiki.page_wiki_not_set.app_error", nil, "", http.StatusBadRequest)
			return
		}
	}
	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("getWikiPage", "api.wiki.page_wiki_mismatch.app_error", nil, "", http.StatusBadRequest)
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

	wiki, page, channel, ok := c.GetPageForModify(app.PageOperationDelete, "deletePage")
	if !ok {
		return
	}

	if appErr := c.App.DeleteWikiPage(c.AppContext, page, c.Params.WikiId, wiki, channel); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("page_id=" + c.Params.PageId + " wiki_id=" + c.Params.WikiId + " wiki_title=" + wiki.Title)

	ReturnStatusOK(w)
}

func restorePage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("restorePage", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	// Get the deleted page (must use GetPageWithDeleted since normal GetPage excludes deleted)
	page, appErr := c.App.GetPageWithDeleted(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Validate page belongs to this wiki
	pageWikiId, ok := page.Props[model.PagePropsWikiID].(string)
	if !ok || pageWikiId == "" {
		// Fallback: get wiki_id from PropertyValues (source of truth)
		var wikiErr *model.AppError
		pageWikiId, wikiErr = c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
		if wikiErr != nil || pageWikiId == "" {
			c.Err = model.NewAppError("restorePage", "api.wiki.page_wiki_not_set.app_error", nil, "", http.StatusBadRequest)
			return
		}
	}
	if pageWikiId != c.Params.WikiId {
		c.Err = model.NewAppError("restorePage", "api.wiki.page_wiki_mismatch.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Get wiki and check modify permission
	wiki, _, ok := c.GetWikiForModify("restorePage")
	if !ok {
		return
	}

	// Validate page's channel matches wiki's channel
	if page.ChannelId != wiki.ChannelId {
		c.Err = model.NewAppError("restorePage", "api.wiki.page_channel_mismatch.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Check delete permission (restore requires same permission as delete)
	if !c.CheckPagePermission(page, app.PageOperationDelete) {
		return
	}

	if appErr := c.App.RestorePage(c.AppContext, page); appErr != nil {
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

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.Err = model.NewAppError("createPage", "api.page.create.empty_title.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if len(req.Title) > model.MaxPageTitleLength {
		c.Err = model.NewAppError("createPage", "api.page.create.title_too_long.app_error",
			map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("createPage", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("parent_id", req.PageParentId)

	_, channel, ok := c.GetWikiForModify("createPage")
	if !ok {
		return
	}

	// Additive permission check: Need BOTH page permission (content) AND wiki permission (container)

	// Check page permission (content)
	if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionCreatePage); !hasPermission {
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
		BaseEditAt int64  `json:"base_edit_at,omitempty"`
		Force      bool   `json:"force,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	req.Title = strings.TrimSpace(req.Title)

	auditRec := c.MakeAuditRecord("updatePage", model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	_, page, channel, ok := c.GetPageForModify(app.PageOperationEdit, "updatePage")
	if !ok {
		return
	}

	updatedPage, appErr := c.App.UpdatePageWithOptimisticLocking(c.AppContext, page, req.Title, req.Content, req.SearchText, req.BaseEditAt, req.Force, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedPage)
	auditRec.AddEventObjectType("page")

	w.Header().Set(model.HeaderEtagServer, updatedPage.Etag())
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

	includeContent := r.URL.Query().Get("include_content") == "true"

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if hasPermission, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	// Guests cannot access pages in DM/Group channels
	if channel.Type == model.ChannelTypeGroup || channel.Type == model.ChannelTypeDirect {
		if c.AppContext.Session().IsGuest() {
			c.Err = model.NewAppError("getChannelPages", "api.page.permission.guest_cannot_access.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	postList, err := c.App.GetChannelPages(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if includeContent {
		if contentErr := c.App.LoadPageContent(c.AppContext, postList, app.PageContentLoadOptions{}); contentErr != nil {
			c.Err = contentErr
			return
		}
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, postList)
	clientPostList, _, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func extractPageImageText(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	// Audit logging for AI image extraction
	auditRec := c.MakeAuditRecord("extractPageImageText", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)

	wiki, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	if wiki.DeleteAt != 0 {
		c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.wiki_deleted.app_error", nil, "", http.StatusNotFound)
		return
	}

	var req app.PageImageExtractionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request_body", err)
		return
	}

	auditRec.AddMeta("agent_id", req.AgentID)
	auditRec.AddMeta("action", string(req.Action))

	if !model.IsValidId(req.AgentID) {
		c.SetInvalidParam("agent_id")
		return
	}

	// Validate that exactly one of file_id or image_url is provided
	hasFileID := req.FileID != ""
	hasImageURL := req.ImageURL != ""

	if hasFileID && hasImageURL {
		c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.both_file_and_url.app_error", nil, "cannot provide both file_id and image_url", http.StatusBadRequest)
		return
	}

	if !hasFileID && !hasImageURL {
		c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.missing_file_or_url.app_error", nil, "must provide either file_id or image_url", http.StatusBadRequest)
		return
	}

	if hasFileID {
		if !model.IsValidId(req.FileID) {
			c.SetInvalidParam("file_id")
			return
		}
		auditRec.AddMeta("file_id", req.FileID)

		// Verify user has permission to access the file
		fileInfo, appErr := c.App.GetFileInfo(c.AppContext, req.FileID)
		if appErr != nil {
			c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.file_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
			return
		}

		// Check if file belongs to a post the user can access
		if fileInfo.PostId != "" {
			post, postErr := c.App.GetSinglePost(c.AppContext, fileInfo.PostId, false)
			if postErr != nil {
				// Distinguish between post not found/deleted vs other errors
				if postErr.StatusCode == http.StatusNotFound {
					c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.file_post_not_found.app_error",
						nil, "the post this file was attached to no longer exists", http.StatusNotFound).Wrap(postErr)
					return
				}
				if postErr.StatusCode == http.StatusForbidden {
					// Cloud message limits or other access restrictions
					c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.file_post_inaccessible.app_error",
						nil, "the post this file was attached to is not accessible", http.StatusForbidden).Wrap(postErr)
					return
				}
				c.Err = postErr
				return
			}

			// Defensive check: verify file's channel matches post's channel
			if fileInfo.ChannelId != "" && fileInfo.ChannelId != post.ChannelId {
				c.SetPermissionError(model.PermissionReadChannel)
				return
			}

			// Verify user has read access to the channel
			if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionReadChannel); !hasPermission {
				c.SetPermissionError(model.PermissionReadChannel)
				return
			}
		} else {
			// File not attached to post - verify user owns it or user is admin
			if fileInfo.CreatorId != c.AppContext.Session().UserId {
				if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
					c.SetPermissionError(model.PermissionReadChannel)
					return
				}
			}
		}
	}

	if hasImageURL {
		// Trim whitespace
		req.ImageURL = strings.TrimSpace(req.ImageURL)
		if req.ImageURL == "" {
			c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.empty_image_url.app_error", nil, "image_url cannot be empty or whitespace", http.StatusBadRequest)
			return
		}

		// Validate URL length
		if len(req.ImageURL) > model.LinkMetadataMaxURLLength {
			c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.url_too_long.app_error",
				map[string]any{"MaxLength": model.LinkMetadataMaxURLLength}, "", http.StatusBadRequest)
			return
		}

		// Validate URL format (http/https scheme, valid structure)
		if !model.IsValidHTTPURL(req.ImageURL) {
			c.SetInvalidParam("image_url")
			return
		}

		auditRec.AddMeta("image_url", req.ImageURL)
	}

	if req.Action != app.PageImageExtractionExtractHandwriting && req.Action != app.PageImageExtractionDescribeImage {
		c.SetInvalidParam("action")
		return
	}

	response, appErr := c.App.ExtractPageImageText(
		c.AppContext,
		req.AgentID,
		req.FileID,
		req.ImageURL,
		req.Action,
	)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(*response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// summarizeThreadToPage handles POST /api/v4/wiki/{wiki_id}/pages/summarize-thread
func summarizeThreadToPage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	wiki, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	if wiki.DeleteAt != 0 {
		c.Err = model.NewAppError("summarizeThreadToPage", "api.wiki.summarize_thread.wiki_deleted.app_error", nil, "", http.StatusNotFound)
		return
	}

	var req app.SummarizeThreadToPageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request_body", err)
		return
	}

	if !model.IsValidId(req.AgentID) {
		c.SetInvalidParam("agent_id")
		return
	}

	if !model.IsValidId(req.ThreadID) {
		c.SetInvalidParam("thread_id")
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		c.SetInvalidParam("title")
		return
	}

	// Verify the thread exists and user can access it
	rootPost, appErr := c.App.GetSinglePost(c.AppContext, req.ThreadID, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Check user has read access to the channel containing the thread
	if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), rootPost.ChannelId, model.PermissionReadChannel); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	draftPageID, appErr := c.App.SummarizeThreadToPage(
		c.AppContext,
		req.AgentID,
		req.ThreadID,
		wiki.Id,
		req.Title,
	)
	if appErr != nil {
		c.Err = appErr
		return
	}

	response := app.SummarizeThreadToPageResponse{
		PageID: draftPageID,
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
