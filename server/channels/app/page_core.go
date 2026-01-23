// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// PageOperation represents the type of operation being performed on a page
type PageOperation int

const (
	PageOperationCreate PageOperation = iota
	PageOperationRead
	PageOperationEdit
	PageOperationDelete
)

const (
	// ActiveEditorTimeoutMs is the time window (in milliseconds) to consider an editor as "active"
	// Editors who haven't made changes within this window are not shown as active
	ActiveEditorTimeoutMs = 5 * 60 * 1000 // 5 minutes
)

// CreatePage creates a new page with title and content.
// If pageID is provided, it will be used as the page's ID (for publishing drafts with unified IDs).
// If pageID is empty, a new ID will be generated.
func (a *App) CreatePage(rctx request.CTX, channelID, title, pageParentID, content, userID, searchText, pageID string) (*model.Post, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("create", time.Since(start).Seconds())
		}
	}()

	title = strings.TrimSpace(title)
	title = model.SanitizeUnicode(title)
	if title == "" {
		return nil, model.NewAppError("CreatePage", "app.page.create.missing_title.app_error", nil, "", http.StatusBadRequest)
	}
	if len(title) > model.MaxPageTitleLength {
		return nil, model.NewAppError("CreatePage", "app.page.create.title_too_long.app_error", map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
	}

	channel, chanErr := a.GetChannel(rctx, channelID)
	if chanErr != nil {
		return nil, chanErr
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("CreatePage", "app.page.create.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if pageParentID != "" {
		parentPage, err := a.GetPage(rctx, pageParentID)
		if err != nil {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_parent.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if parentPage.ChannelId != channelID {
			return nil, model.NewAppError("CreatePage", "app.page.create.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
		}

		parentDepth, depthErr := a.calculatePageDepth(rctx, pageParentID)
		if depthErr != nil {
			return nil, depthErr
		}
		newPageDepth := parentDepth + 1
		if newPageDepth > model.PostPageMaxDepth {
			return nil, model.NewAppError("CreatePage", "app.page.create.max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth}, "", http.StatusBadRequest)
		}
	}

	if content != "" {
		trimmedContent := strings.TrimSpace(content)

		// If content looks like JSON (starts with {), validate it
		if strings.HasPrefix(trimmedContent, "{") {
			if err := model.ValidateTipTapDocument(content); err != nil {
				return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		} else {
			// Not JSON - treat as plain text and auto-convert to TipTap JSON
			content = convertPlainTextToTipTapJSON(content)

			// Extract search text from plain content if not provided
			if searchText == "" {
				searchText = content
			}
		}
	}

	page := &model.Post{
		Id:           pageID, // If empty, PreSave() will generate a new ID
		Type:         model.PostTypePage,
		ChannelId:    channelID,
		UserId:       userID,
		Message:      "",
		PageParentId: pageParentID,
		Props: model.StringInterface{
			"title": title,
		},
	}

	createdPage, createErr := a.Srv().Store().Page().CreatePage(rctx, page, content, searchText)
	if createErr != nil {
		if strings.Contains(createErr.Error(), "invalid_content") {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(createErr)
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(createErr)
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, createdPage, true); enrichErr != nil {
		return nil, enrichErr
	}

	if contentErr := a.loadPageContentForPost(rctx, createdPage); contentErr != nil {
		return nil, contentErr
	}

	// Invalidate cache so other nodes see the new page
	a.invalidateCacheForChannelPosts(createdPage.ChannelId)

	return createdPage, nil
}

// GetPage fetches a page by ID and returns the Post.
// Returns error if not found or if the post is not a page type.
// Note: Uses master DB to avoid read-after-write issues with replica lag in cloud deployments.
func (a *App) GetPage(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Post().GetSingle(RequestContextWithMaster(rctx), pageID, false)
	if err != nil {
		return nil, model.NewAppError("GetPage", "app.page.get.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return nil, model.NewAppError("GetPage", "app.page.get.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	return post, nil
}

// GetPageWithDeleted fetches a page including soft-deleted pages.
// Use for restore operations.
func (a *App) GetPageWithDeleted(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Post().GetSingle(RequestContextWithMaster(rctx), pageID, true)
	if err != nil {
		return nil, model.NewAppError("GetPageWithDeleted", "app.page.get.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return nil, model.NewAppError("GetPageWithDeleted", "app.page.get.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	return post, nil
}

// GetPageWithContent fetches a page with permission check and loads content.
// Returns *model.Post with Message field populated from PageContent table.
func (a *App) GetPageWithContent(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("view", time.Since(start).Seconds())
		}
	}()

	page, err := a.GetPage(rctx, pageID)
	if err != nil {
		return nil, err
	}
	post := page

	session := rctx.Session()
	if hasPermission, _ := a.HasPermissionToChannel(rctx, session.UserId, post.ChannelId, model.PermissionReadPage); !hasPermission {
		return nil, model.NewAppError("GetPageWithContent", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
	}

	pageContent, contentErr := a.Srv().Store().Page().GetPageContent(pageID)
	if contentErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(contentErr, &nfErr) {
			post.Message = ""
		} else {
			return nil, model.NewAppError("GetPageWithContent", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
		}
	} else {
		contentJSON, jsonErr := pageContent.GetDocumentJSON()
		if jsonErr != nil {
			return nil, model.NewAppError("GetPageWithContent", "app.page.get.serialize_content.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		}
		post.Message = contentJSON
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, post); enrichErr != nil {
		return nil, enrichErr
	}

	return post, nil
}

// PageContentLoadOptions configures how page content is loaded.
type PageContentLoadOptions struct {
	// IncludeDeleted loads content for soft-deleted pages (for version history)
	IncludeDeleted bool
	// SearchTextOnly loads only search_text into Props instead of full document JSON
	SearchTextOnly bool
}

// LoadPageContent loads page content from the PageContent table for pages in the PostList.
// Use options to control loading behavior (deleted content, search text only).
func (a *App) LoadPageContent(rctx request.CTX, postList *model.PostList, opts PageContentLoadOptions) *model.AppError {
	if postList == nil || postList.Posts == nil {
		return nil
	}

	pageIDs := make([]string, 0, len(postList.Posts))
	for _, post := range postList.Posts {
		if NeedsContentLoading(post) {
			pageIDs = append(pageIDs, post.Id)
		}
	}

	if len(pageIDs) == 0 {
		return nil
	}

	var pageContents []*model.PageContent
	var contentErr error

	if opts.IncludeDeleted {
		pageContents, contentErr = a.Srv().Store().Page().GetManyPageContentsWithDeleted(pageIDs)
	} else {
		pageContents, contentErr = a.Srv().Store().Page().GetManyPageContents(pageIDs)
	}
	if contentErr != nil {
		return model.NewAppError("LoadPageContent", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	contentMap := make(map[string]*model.PageContent, len(pageContents))
	for _, content := range pageContents {
		contentMap[content.PageId] = content
	}

	for _, post := range postList.Posts {
		if !NeedsContentLoading(post) {
			continue
		}

		pageContent, found := contentMap[post.Id]
		if !found {
			if !opts.SearchTextOnly {
				post.Message = ""
			}
			continue
		}

		if opts.SearchTextOnly {
			if pageContent.SearchText != "" {
				if post.Props == nil {
					post.Props = make(model.StringInterface)
				}
				post.Props["search_text"] = pageContent.SearchText
			}
		} else {
			contentJSON, jsonErr := pageContent.GetDocumentJSON()
			if jsonErr != nil {
				return model.NewAppError("LoadPageContent", "app.page.get.serialize_content.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
			}
			post.Message = contentJSON
		}
	}

	return nil
}

// loadPageContentForPost loads the page content from PageContents table and sets it to post.Message.
// This is needed because page content is stored in a separate table, not in Posts.Message.
// Returns nil if content is loaded successfully or if content is not found (acceptable for new pages).
// Returns error for database issues or serialization failures.
func (a *App) loadPageContentForPost(rctx request.CTX, post *model.Post) *model.AppError {
	if post == nil {
		return nil
	}

	pageContent, contentErr := a.Srv().Store().Page().GetPageContent(post.Id)
	if contentErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(contentErr, &nfErr) {
			post.Message = ""
			return nil // Not found is acceptable - new page or edge case
		}
		return model.NewAppError("loadPageContentForPost", "app.page.load_content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	contentJSON, jsonErr := pageContent.GetDocumentJSON()
	if jsonErr != nil {
		return model.NewAppError("loadPageContentForPost", "app.page.serialize_content.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	post.Message = contentJSON
	return nil
}

// UpdatePage updates a page's title and/or content.
func (a *App) UpdatePage(rctx request.CTX, page *model.Post, title, content, searchText string) (*model.Post, *model.AppError) {
	pageID := page.Id

	if title != "" {
		title = model.SanitizeUnicode(title)
		if len(title) > model.MaxPageTitleLength {
			return nil, model.NewAppError("UpdatePage", "app.page.update.title_too_long.app_error", map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		}
	}

	updatedPost, storeErr := a.Srv().Store().Page().UpdatePageWithContent(rctx, pageID, title, content, searchText)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(storeErr, &nfErr) {
			return nil, model.NewAppError("UpdatePage", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(storeErr)
		}
		if strings.Contains(storeErr.Error(), "invalid_content") {
			return nil, model.NewAppError("UpdatePage", "app.page.update.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(storeErr)
		}
		return nil, model.NewAppError("UpdatePage", "app.page.update.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	session := rctx.Session()
	if content != "" {
		a.handlePageMentions(rctx, updatedPost, updatedPost.ChannelId, content, session.UserId)
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, updatedPost, true); enrichErr != nil {
		return nil, enrichErr
	}

	if content != "" {
		// Content was just written - normalize and use directly to avoid extra DB query
		pageContent := &model.PageContent{}
		if setErr := pageContent.SetDocumentJSON(content); setErr == nil {
			if normalizedContent, jsonErr := pageContent.GetDocumentJSON(); jsonErr == nil {
				updatedPost.Message = normalizedContent
			}
		}
	} else {
		// No content update - load existing content from DB
		if contentErr := a.loadPageContentForPost(rctx, updatedPost); contentErr != nil {
			return nil, contentErr
		}
	}

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId)

	// Invalidate cache so other nodes see the update
	a.invalidateCacheForChannelPosts(updatedPost.ChannelId)

	// Broadcast POST_EDITED event so clients update the page
	a.sendPageEditedEvent(rctx, updatedPost)

	// Broadcast title update if title was changed
	if title != "" {
		wikiId, _ := updatedPost.Props["wiki_id"].(string)
		if wikiId != "" {
			a.BroadcastPageTitleUpdated(pageID, title, wikiId, updatedPost.ChannelId, updatedPost.UpdateAt)
		}
	}

	return updatedPost, nil
}

// UpdatePageWithOptimisticLocking updates a page with first-one-wins concurrency control.
// baseEditAt is the EditAt timestamp the client last saw when they started editing
// Returns 409 Conflict if the page content was modified by someone else
// Returns 404 Not Found if the page was deleted
func (a *App) UpdatePageWithOptimisticLocking(rctx request.CTX, page *model.Post, title, content, searchText string, baseEditAt int64, force bool) (*model.Post, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("update", time.Since(start).Seconds())
		}
	}()

	pageID := page.Id

	// Use master context to avoid reading stale data from replicas in HA mode
	// This is critical for conflict detection - we need the latest EditAt value
	post, err := a.GetSinglePost(RequestContextWithMaster(rctx), pageID, false)
	if err != nil {
		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	session := rctx.Session()

	if title != "" {
		title = model.SanitizeUnicode(title)
		if len(title) > model.MaxPageTitleLength {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.title_too_long.app_error", map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		}
	}

	// Check for conflicts (business logic - following MM pattern)
	// Uses EditAt instead of UpdateAt to only detect content changes, not metadata/hierarchy changes
	// Note: baseEditAt=0 means "page was never edited" (fresh page), post.EditAt > 0 means "someone edited"
	// So we need to compare directly: if they don't match, there's a conflict
	if !force && post.EditAt != baseEditAt {
		modifiedBy := post.UserId
		if lastModifiedBy, ok := post.Props["last_modified_by"].(string); ok && lastModifiedBy != "" {
			modifiedBy = lastModifiedBy
		}
		modifiedAt := post.EditAt

		if a.Metrics() != nil {
			a.Metrics().IncrementWikiEditConflict()
		}

		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.conflict.app_error",
			map[string]any{"ModifiedBy": modifiedBy, "ModifiedAt": modifiedAt}, fmt.Sprintf("modified_by=%s edit_at=%d", modifiedBy, modifiedAt), http.StatusConflict)
	}

	if title != "" {
		post.Props["title"] = title
	}

	if content != "" {
		post.Message = content
	}

	post.Props["last_modified_by"] = session.UserId

	updatedPost, storeErr := a.Srv().Store().Page().Update(rctx, post)
	if storeErr != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(storeErr, &notFoundErr) {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound)
		}

		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	if content != "" {
		a.handlePageMentions(rctx, updatedPost, updatedPost.ChannelId, content, session.UserId)
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, updatedPost, true); enrichErr != nil {
		return nil, enrichErr
	}

	if content != "" {
		// Content was just written - normalize and use directly to avoid extra DB query
		pageContent := &model.PageContent{}
		if setErr := pageContent.SetDocumentJSON(content); setErr == nil {
			if normalizedContent, jsonErr := pageContent.GetDocumentJSON(); jsonErr == nil {
				updatedPost.Message = normalizedContent
			}
		}
	} else {
		// No content update - load existing content from DB
		if contentErr := a.loadPageContentForPost(rctx, updatedPost); contentErr != nil {
			return nil, contentErr
		}
	}

	// Broadcast POST_EDITED event so all clients update their page content
	a.sendPageEditedEvent(rctx, updatedPost)

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId)

	// Invalidate cache so other nodes see the update
	a.invalidateCacheForChannelPosts(updatedPost.ChannelId)

	return updatedPost, nil
}

// DeletePage deletes a page. If wikiId is provided, it will be included in the broadcast event.
// Uses atomic store operation to delete content, comments, and page post in a single transaction.
// Before deletion, reparents any child pages to the deleted page's parent to avoid orphans.
func (a *App) DeletePage(rctx request.CTX, page *model.Post, wikiId string) *model.AppError {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("delete", time.Since(start).Seconds())
		}
	}()

	pageID := page.Id
	session := rctx.Session()

	// Reparent any children to the deleted page's parent (or make them root pages)
	// This prevents orphaned pages when a parent is deleted
	if err := a.Srv().Store().Page().ReparentChildren(pageID, page.PageParentId); err != nil {
		return model.NewAppError("DeletePage", "app.page.delete.reparent_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Atomic deletion of content, comments, and page post in a single transaction
	if err := a.Srv().Store().Page().DeletePage(pageID, session.UserId); err != nil {
		return model.NewAppError("DeletePage", "app.page.delete.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Invalidate cache so other nodes see the deletion
	a.invalidateCacheForChannelPosts(page.ChannelId)

	a.broadcastPageDeleted(pageID, wikiId, page.ChannelId, rctx.Session().UserId)
	return nil
}

// RestorePage restores a soft-deleted page.
// Uses atomic store operation to restore content and page post in a single transaction.
func (a *App) RestorePage(rctx request.CTX, page *model.Post) *model.AppError {
	pageID := page.Id
	post := page

	if page.DeleteAt == 0 {
		return model.NewAppError("RestorePage",
			"app.page.restore.not_deleted.app_error", nil, "", http.StatusBadRequest)
	}

	session := rctx.Session()

	// Atomic restoration of content and page post in a single transaction
	if err := a.Srv().Store().Page().RestorePage(pageID); err != nil {
		return model.NewAppError("RestorePage",
			"app.page.restore.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Update local copy for broadcasting (DB was updated by store)
	restoredPost := post.Clone()
	restoredPost.DeleteAt = 0
	restoredPost.UpdateAt = model.GetMillis()

	a.invalidateCacheForChannelPosts(restoredPost.ChannelId)

	if enrichErr := a.EnrichPageWithProperties(rctx, restoredPost, true); enrichErr != nil {
		rctx.Logger().Warn("Failed to enrich restored page", mlog.String("page_id", pageID), mlog.Err(enrichErr))
	}

	wikiId, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr != nil {
		wikiId = ""
	}

	a.BroadcastPagePublished(restoredPost, wikiId, restoredPost.ChannelId, "", session.UserId)
	return nil
}

// PermanentDeletePage permanently deletes a page and its content.
func (a *App) PermanentDeletePage(rctx request.CTX, page *model.Post) *model.AppError {
	pageID := page.Id

	session := rctx.Session()
	if err := a.Srv().Store().Page().PermanentDeletePageContent(pageID); err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			rctx.Logger().Warn("Failed to permanently delete PageContent", mlog.String("page_id", pageID), mlog.Err(err))
		}
	}

	if err := a.PermanentDeletePost(rctx, pageID, session.UserId); err != nil {
		return err
	}

	return nil
}

type PageActiveEditors struct {
	UserIds        []string         `json:"user_ids"`
	LastActivities map[string]int64 `json:"last_activities"`
}

func (a *App) GetPageActiveEditors(rctx request.CTX, pageId string) (*PageActiveEditors, *model.AppError) {
	activeEditorCutoff := model.GetMillis() - ActiveEditorTimeoutMs

	drafts, err := a.Srv().Store().Draft().GetActiveEditorsForPage(pageId, activeEditorCutoff)
	if err != nil {
		return nil, model.NewAppError("App.GetPageActiveEditors", "app.page.get_active_editors.get_drafts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	userIds := []string{}
	lastActivities := make(map[string]int64)

	for _, draft := range drafts {
		userIds = append(userIds, draft.UserId)
		lastActivities[draft.UserId] = draft.UpdateAt
	}

	return &PageActiveEditors{
		UserIds:        userIds,
		LastActivities: lastActivities,
	}, nil
}

func (a *App) GetPageVersionHistory(rctx request.CTX, pageId string, offset, limit int) ([]*model.Post, *model.AppError) {
	posts, err := a.Srv().Store().Page().GetPageVersionHistory(pageId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("App.GetPageVersionHistory", "app.page.get_version_history.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	postList := &model.PostList{
		Posts: make(map[string]*model.Post, len(posts)),
		Order: make([]string, len(posts)),
	}
	for i, post := range posts {
		postList.Posts[post.Id] = post
		postList.Order[i] = post.Id
	}

	if loadErr := a.LoadPageContent(rctx, postList, PageContentLoadOptions{IncludeDeleted: true}); loadErr != nil {
		return nil, loadErr
	}

	return posts, nil
}

// RestorePageVersion restores a page to a previous version from its history
func (a *App) RestorePageVersion(
	rctx request.CTX,
	userID, pageID, restoreVersionID string,
	toRestorePostVersion *model.Post,
) (*model.Post, *model.AppError) {
	// Step 1: Get historical PageContents
	historicalContent, storeErr := a.Srv().Store().Page().GetPageContentWithDeleted(restoreVersionID)
	if storeErr != nil {
		var notFoundErr *store.ErrNotFound
		if !errors.As(storeErr, &notFoundErr) {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.get_content.app_error", nil, "",
				http.StatusInternalServerError).Wrap(storeErr)
		}
		// No historical content found - will restore metadata only
	}

	// Step 2: Extract title from historical post
	var title string
	if toRestorePostVersion.Props != nil {
		if titleValue, ok := toRestorePostVersion.Props["title"]; ok {
			if titleStr, isString := titleValue.(string); isString {
				title = titleStr
			}
		}
	}

	// Step 3: Restore content and title together using UpdatePageWithContent
	var updatedPost *model.Post
	if historicalContent != nil {
		contentJSON, jsonErr := historicalContent.GetDocumentJSON()
		if jsonErr != nil {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.serialize_content.app_error", nil, "",
				http.StatusInternalServerError).Wrap(jsonErr)
		}

		updatedPost, storeErr = a.Srv().Store().Page().UpdatePageWithContent(
			rctx, pageID, title, contentJSON, historicalContent.SearchText)
		if storeErr != nil {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.update_content.app_error", nil, "",
				http.StatusInternalServerError).Wrap(storeErr)
		}
	} else {
		updatedPost, storeErr = a.Srv().Store().Page().UpdatePageWithContent(
			rctx, pageID, title, "", "")
		if storeErr != nil {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.update_title.app_error", nil, "",
				http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	// Step 4: Restore FileIds if they differ (UpdatePageWithContent doesn't handle FileIds)
	if !toRestorePostVersion.FileIds.Equals(updatedPost.FileIds) {
		postPatch := &model.PostPatch{
			FileIds: &toRestorePostVersion.FileIds,
		}

		patchPostOptions := &model.UpdatePostOptions{
			IsRestorePost: true,
		}

		var patchErr *model.AppError
		updatedPost, _, patchErr = a.PatchPost(rctx, pageID, postPatch, patchPostOptions)
		if patchErr != nil {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.update_fileids.app_error", nil, "",
				http.StatusInternalServerError).Wrap(patchErr)
		}
	}

	// Reload the complete page with content for WebSocket event
	freshPage, getErr := a.GetPageWithContent(rctx, pageID)
	if getErr != nil {
		freshPage = updatedPost
	}

	// Step 6: Send WebSocket POST_EDITED event so clients update the page
	a.sendPageEditedEvent(rctx, freshPage)

	return updatedPost, nil
}

// sendPageEditedEvent sends a WebSocket POST_EDITED event for a page
// This is necessary because publishWebsocketEventForPost returns early for pages
func (a *App) sendPageEditedEvent(rctx request.CTX, page *model.Post) {
	pageJSON, jsonErr := page.ToJSON()
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to encode page to JSON for WebSocket event",
			mlog.String("page_id", page.Id),
			mlog.Err(jsonErr))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", page.ChannelId, "", nil, "")
	message.Add("post", pageJSON)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           page.ChannelId,
		ReliableClusterSend: true,
	})

	a.Publish(message)
}

// isValidTipTapJSON checks if the given content is valid TipTap JSON format
func isValidTipTapJSON(content string) bool {
	return model.ValidateTipTapDocument(content) == nil
}

// convertPlainTextToTipTapJSON converts plain text content to TipTap JSON format
func convertPlainTextToTipTapJSON(plainText string) string {
	// Split into paragraphs
	paragraphs := strings.Split(plainText, "\n")

	// Build TipTap content nodes
	contentNodes := make([]map[string]any, 0, len(paragraphs))

	for _, para := range paragraphs {
		trimmed := strings.TrimSpace(para)

		// Skip empty paragraphs but keep as empty paragraph for structure
		if trimmed == "" {
			contentNodes = append(contentNodes, map[string]any{
				"type": "paragraph",
			})
			continue
		}

		// Create paragraph node with text content
		contentNodes = append(contentNodes, map[string]any{
			"type": "paragraph",
			"content": []map[string]any{
				{
					"type": "text",
					"text": trimmed,
				},
			},
		})
	}

	// Build final TipTap document
	doc := map[string]any{
		"type":    model.TipTapDocType,
		"content": contentNodes,
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(doc)
	if err != nil {
		// Fallback: return empty document
		return model.EmptyTipTapJSON
	}

	return string(jsonBytes)
}
