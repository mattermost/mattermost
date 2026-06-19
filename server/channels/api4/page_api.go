// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func updatePageStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdatePageStatus, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Status) == "" {
		c.SetInvalidParam("status")
		return
	}
	req.Status = strings.TrimSpace(req.Status)

	_, page, _, ok := c.GetPageForModify(app.PageOperationEdit, "updatePageStatus")
	if !ok {
		return
	}

	auditRec.AddEventPriorState(page)

	if err := c.App.SetPageStatus(c.AppContext, page.Id, req.Status); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func patchPageProps(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdatePage, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req struct {
		Props map[string]any `json:"props"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Props) == 0 {
		c.SetInvalidParam("props")
		return
	}

	_, page, channel, ok := c.GetPageForModify(app.PageOperationEdit, "patchPageProps")
	if !ok {
		return
	}

	auditRec.AddEventPriorState(page)

	updatedPage, appErr := c.App.PatchPageProps(c.AppContext, page, req.Props, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedPage)
	auditRec.AddEventObjectType("page")

	if err := json.NewEncoder(w).Encode(updatedPage); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPageStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	page, _, _, ok := c.GetPageForRead()
	if !ok {
		return
	}

	c.App.EnrichPageWithProperties(c.AppContext, page)
	status, _ := page.Properties[model.PagePropsPageStatus].(string)

	if err := json.NewEncoder(w).Encode(map[string]string{"status": status}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPageStatusField(c *Context, w http.ResponseWriter, r *http.Request) {
	field, err := c.App.GetPageStatusField()
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(field); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getWikiPages(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	_, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	pages, appErr := c.App.GetWikiPages(c.AppContext, c.Params.WikiId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

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

	start := time.Now()
	page, _, _, ok := c.GetPageForRead()
	if !ok {
		return
	}

	// Enrich page with properties (GetPageForRead doesn't include content enrichment)
	c.App.EnrichPageWithProperties(c.AppContext, page)

	if c.App.Metrics() != nil {
		c.App.Metrics().ObserveWikiPageOperation("view", time.Since(start).Seconds())
	}

	if err := json.NewEncoder(w).Encode(page); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPageFiles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	_, _, channel, ok := c.GetPageForRead()
	if !ok {
		return
	}

	if channel.DeleteAt != 0 {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	infos, appErr := c.App.GetPageFiles(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(infos); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePage, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	wiki, page, channel, ok := c.GetPageForModify(app.PageOperationDelete, "deletePage")
	if !ok {
		return
	}

	auditRec.AddEventPriorState(page)

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

	auditRec := c.MakeAuditRecord(model.AuditEventRestorePage, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	// Get wiki and check read permission first (prevents deleted page ID enumeration)
	wiki, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	// Get the deleted page (must use GetPageWithDeleted since normal GetPage excludes deleted)
	page, appErr := c.App.GetPageWithDeleted(c.AppContext, c.Params.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Wiki membership is structural: a page belongs to the wiki whose backing channel matches.
	// GetWikiIdForPage cannot be used here — it calls GetPage which excludes soft-deleted posts.
	if page.ChannelId != wiki.ChannelId {
		c.Err = model.NewAppError("restorePage", "api.wiki.page_not_found.app_error", nil, "", http.StatusNotFound)
		return
	}

	// Restore requires admin-level delete permission (PermissionDeletePage),
	// not just PermissionDeleteOwnPage. Rationale: a deleted page is gone from
	// the user's view; re-introducing it affects channel-wide state and is a
	// moderator action even if the restorer was the original author. Channel
	// admins can restore on behalf of regular users if needed.
	if !c.CheckPagePermission(page, app.PageOperationRestore) {
		return
	}

	auditRec.AddEventPriorState(page)

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

	r.Body = http.MaxBytesReader(w, r.Body, model.PageContentMaxSize)
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

	if req.PageParentId != "" && !model.IsValidId(req.PageParentId) {
		c.SetInvalidParam("page_parent_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePage, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("parent_id", req.PageParentId)

	wiki, _, ok := c.GetWikiForModify()
	if !ok {
		return
	}

	if !c.App.SessionHasWikiPermission(*c.AppContext.Session(), wiki, model.PermissionCreatePage) {
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
	c.App.BroadcastPagePublished(page, c.Params.WikiId, "", c.AppContext.Session().UserId)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(page); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updatePage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	c.RequirePageId()
	if c.Err != nil {
		return
	}

	var req struct {
		Title      string   `json:"title,omitempty"`
		Content    string   `json:"content,omitempty"`
		SearchText string   `json:"search_text,omitempty"`
		BaseEditAt int64    `json:"base_edit_at,omitempty"`
		Force      bool     `json:"force,omitempty"`
		FileIds    []string `json:"file_ids,omitempty"`
	}

	r.Body = http.MaxBytesReader(w, r.Body, model.PageContentMaxSize)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	req.Title = strings.TrimSpace(req.Title)

	if req.Title == "" && req.Content == "" && len(req.FileIds) == 0 {
		c.Err = model.NewAppError("updatePage", "api.page.update.empty_update.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(req.Title) > model.MaxPageTitleLength {
		c.Err = model.NewAppError("updatePage", "api.page.update.title_too_long.app_error",
			map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		return
	}

	// Validate file_ids format before any DB write so a malformed ID can't leave
	// the page partially updated.
	for _, fid := range req.FileIds {
		if !model.IsValidId(fid) {
			c.SetInvalidParam("file_ids")
			return
		}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdatePage, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)
	auditRec.AddMeta("page_id", c.Params.PageId)

	_, page, channel, ok := c.GetPageForModify(app.PageOperationEdit, "updatePage")
	if !ok {
		return
	}

	auditRec.AddEventPriorState(page)

	updatedPage, appErr := c.App.UpdatePageWithOptimisticLocking(c.AppContext, page, req.Title, req.Content, req.SearchText, req.BaseEditAt, req.Force, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if len(req.FileIds) > 0 {
		updatedPage, appErr = c.App.AttachFilesToPage(c.AppContext, updatedPage, req.FileIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
		// Re-broadcast so connected clients receive the page with the final file IDs.
		// UpdatePageWithOptimisticLocking already broadcast before attachment; this
		// second broadcast ensures the last state clients observe is complete.
		c.App.SendPageEditedBroadcast(c.AppContext, updatedPage)
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedPage)
	auditRec.AddEventObjectType("page")

	w.Header().Set(model.HeaderEtagServer, fmt.Sprintf("%v.%v", updatedPage.Id, updatedPage.UpdateAt))
	if err := json.NewEncoder(w).Encode(updatedPage); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelPages(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	includeContent := r.URL.Query().Get("include_content") == "true"

	// Check channel existence before permission to return 404 (not 403) for missing channels.
	if _, chErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId); chErr != nil {
		c.Err = chErr
		return
	}

	// PermissionReadChannelContent governs access, including for guests in DM/Group channels.
	// Guests who are members of a DM or group channel may see pages linked to it — this is
	// intentional since those users already have read access to the channel's content.
	if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannelContent); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	pages, hasPartialContent, appErr := c.App.GetPagesForChannel(c.AppContext, c.Params.ChannelId, c.Params.Page, c.Params.PerPage, includeContent)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if hasPartialContent {
		w.Header().Set("X-Mattermost-Partial-Content", "true")
	}

	if err := json.NewEncoder(w).Encode(pages); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func extractPageImageText(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	// Audit logging for AI image extraction
	auditRec := c.MakeAuditRecord(model.AuditEventExtractPageImageText, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)

	_, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
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

	if !checkAIRateLimit(c, w, c.AppContext.Session().UserId, AIEndpointExtractPageImageText) {
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

		// Check if file belongs to a post the user can access.
		// Use GetPage since files on wiki pages have a page post as PostId.
		if fileInfo.PostId != "" {
			post, postErr := c.App.GetPage(c.AppContext, fileInfo.PostId)
			if postErr != nil {
				if postErr.StatusCode == http.StatusNotFound {
					c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.file_post_not_found.app_error",
						nil, "the post this file was attached to no longer exists", http.StatusNotFound).Wrap(postErr)
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
			if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionReadChannelContent); !hasPermission {
				c.SetPermissionError(model.PermissionReadChannelContent)
				return
			}
		} else {
			// File not attached to post - verify user owns it or user is admin
			if fileInfo.CreatorId != c.AppContext.Session().UserId {
				if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
					c.SetPermissionError(model.PermissionManageSystem)
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

		// Block SSRF: reject URLs targeting loopback, link-local, or RFC-1918 addresses
		if err := c.App.ValidateURLForSSRF(r.Context(), req.ImageURL); err != nil {
			c.Err = model.NewAppError("extractPageImageText", "api.wiki.extract_image.ssrf_blocked.app_error", nil, "URL not allowed", http.StatusBadRequest)
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

	if err := json.NewEncoder(w).Encode(*response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// summarizeThreadToPage handles POST /api/v4/wiki/{wiki_id}/pages/summarize-thread
func summarizeThreadToPage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	if !checkAIRateLimit(c, w, c.AppContext.Session().UserId, AIEndpointSummarizeThreadToPage) {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSummarizeThreadToPage, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	wiki, _, ok := c.GetWikiForModify()
	if !ok {
		return
	}

	if !c.App.SessionHasWikiPermission(*c.AppContext.Session(), wiki, model.PermissionCreatePage) {
		c.SetPermissionError(model.PermissionCreatePage)
		return
	}

	auditRec.AddMeta("wiki_id", wiki.Id)

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
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

	auditRec.AddMeta("thread_id", req.ThreadID)
	auditRec.AddMeta("agent_id", req.AgentID)

	if strings.TrimSpace(req.Title) == "" {
		c.SetInvalidParam("title")
		return
	}
	if len(req.Title) > model.MaxPageTitleLength {
		c.Err = model.NewAppError("summarizeThreadToPage", "api.page.summarize_thread.title_too_long.app_error",
			map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		return
	}

	// Verify the thread exists and user can access it
	rootPost, appErr := c.App.GetSinglePost(c.AppContext, req.ThreadID, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Check user has read access to the channel containing the thread
	if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), rootPost.ChannelId, model.PermissionReadChannelContent); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
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

	auditRec.Success()
	auditRec.AddEventObjectType("page")
	auditRec.AddMeta("draft_page_id", draftPageID)

	response := app.SummarizeThreadToPageResponse{
		PageID: draftPageID,
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
