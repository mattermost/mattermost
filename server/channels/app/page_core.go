// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// fileIdPattern matches file IDs in /api/v4/files/{fileId} URLs within TipTap content
var fileIdPattern = regexp.MustCompile(`/api/v4/files/([a-z0-9]{26})`)

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
	channel, chanErr := a.GetChannel(rctx, channelID)
	if chanErr != nil {
		return nil, chanErr
	}

	return a.CreatePageWithChannel(rctx, channel, title, pageParentID, content, userID, searchText, pageID)
}

// CreatePageWithChannel creates a new page using a pre-fetched channel.
// Use this when the channel has already been fetched to avoid redundant DB calls.
func (a *App) CreatePageWithChannel(rctx request.CTX, channel *model.Channel, title, pageParentID, content, userID, searchText, pageID string) (*model.Post, *model.AppError) {
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

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("CreatePage", "app.page.create.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	channelID := channel.Id

	if pageParentID != "" {
		parentPage, err := a.GetPage(rctx, pageParentID)
		if err != nil {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_parent.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if parentPage.ChannelId != channelID {
			return nil, model.NewAppError("CreatePage", "app.page.create.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
		}

		parentDepth, depthErr := a.calculatePageDepth(rctx, pageParentID, parentPage)
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
		var contentErr error
		content, searchText, contentErr = validateAndNormalizePageContent(content, searchText)
		if contentErr != nil {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(contentErr)
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

	// Set initial sort order for the new page (append at end of siblings)
	siblings, sibErr := a.Srv().Store().Page().GetSiblingPages(pageParentID, channelID)
	if sibErr != nil {
		rctx.Logger().Warn("Failed to get sibling pages for sort order",
			mlog.String("channel_id", channelID),
			mlog.String("parent_id", pageParentID),
			mlog.Err(sibErr))
		// Continue without sort order - will use CreateAt as fallback
	} else {
		var maxOrder int64
		for _, s := range siblings {
			if order := s.GetPageSortOrder(); order > maxOrder {
				maxOrder = order
			}
		}
		page.SetPageSortOrder(maxOrder + model.PageSortOrderGap)
	}

	createdPage, createErr := a.Srv().Store().Page().CreatePage(rctx, page, content, searchText)
	if createErr != nil {
		if strings.Contains(createErr.Error(), "invalid_content") {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(createErr)
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(createErr)
	}

	// Attach files referenced in the content to this page
	if content != "" {
		fileIds := extractFileIdsFromContent(content)
		if len(fileIds) > 0 {
			a.attachFileIDsToPost(rctx, createdPage.Id, channelID, userID, fileIds)
		}
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, createdPage, true); enrichErr != nil {
		return nil, enrichErr
	}

	if contentErr := a.loadPageContentForPost(rctx, createdPage); contentErr != nil {
		return nil, contentErr
	}

	// Invalidate cache across cluster so other nodes see the new page
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

// GetPageWithContent fetches a page and loads its content.
// Returns *model.Post with Message field populated from PageContent table.
// Note: Permission checks should be performed by the API layer before calling this method.
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

	// Note: Permission checks are performed by the API layer (GetWikiForRead/GetPageForRead)
	// before calling this method. App layer focuses on business logic only.

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

// maxPageContentBatchSize limits the number of page IDs per batch query
// to prevent unbounded IN clauses that degrade database performance.
const maxPageContentBatchSize = 100

// LoadPageContent loads page content from the PageContent table for pages in the PostList.
// Use options to control loading behavior (deleted content, search text only).
// Content is loaded in batches to prevent unbounded IN clauses.
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

	// Load content in batches to prevent unbounded IN clauses
	contentMap := make(map[string]*model.PageContent, len(pageIDs))
	for i := 0; i < len(pageIDs); i += maxPageContentBatchSize {
		end := min(i+maxPageContentBatchSize, len(pageIDs))
		batch := pageIDs[i:end]

		var batchContents []*model.PageContent
		var contentErr error

		if opts.IncludeDeleted {
			batchContents, contentErr = a.Srv().Store().Page().GetManyPageContentsWithDeleted(batch)
		} else {
			batchContents, contentErr = a.Srv().Store().Page().GetManyPageContents(batch)
		}
		if contentErr != nil {
			return model.NewAppError("LoadPageContent", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
		}

		for _, content := range batchContents {
			contentMap[content.PageId] = content
		}
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
// channel is optional - if provided, avoids a DB fetch for mention handling.
func (a *App) UpdatePage(rctx request.CTX, page *model.Post, title, content, searchText string, channel *model.Channel) (*model.Post, *model.AppError) {
	pageID := page.Id

	if title != "" {
		title = model.SanitizeUnicode(title)
		if len(title) > model.MaxPageTitleLength {
			return nil, model.NewAppError("UpdatePage", "app.page.update.title_too_long.app_error", map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		}
	}

	// Validate and normalize content
	if content != "" {
		var contentErr error
		content, searchText, contentErr = validateAndNormalizePageContent(content, searchText)
		if contentErr != nil {
			return nil, model.NewAppError("UpdatePage", "app.page.update.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(contentErr)
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

	// Attach files referenced in the content to this page
	if content != "" {
		fileIds := extractFileIdsFromContent(content)
		if len(fileIds) > 0 {
			a.attachFileIDsToPost(rctx, pageID, updatedPost.ChannelId, session.UserId, fileIds)
		}
	}
	if content != "" {
		// Use provided channel or fetch if not provided
		if channel == nil {
			var chanErr *model.AppError
			channel, chanErr = a.GetChannel(rctx, updatedPost.ChannelId)
			if chanErr != nil {
				rctx.Logger().Warn("Failed to get channel for mention handling",
					mlog.String("page_id", pageID),
					mlog.String("channel_id", updatedPost.ChannelId),
					mlog.Err(chanErr))
			}
		}
		if channel != nil {
			a.handlePageMentions(rctx, updatedPost, channel, content, session.UserId)
		}
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

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId, nil, nil)

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
	// In HA clusters, clients on other nodes may request data immediately after
	// receiving the WebSocket event. Cache must be invalidated first to prevent
	// serving stale data.
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
// channel is optional - if provided, avoids a redundant DB fetch for mention handling.
func (a *App) UpdatePageWithOptimisticLocking(rctx request.CTX, page *model.Post, title, content, searchText string, baseEditAt int64, force bool, channel *model.Channel) (*model.Post, *model.AppError) {
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

	// Validate and normalize content
	if content != "" {
		var contentErr error
		content, _, contentErr = validateAndNormalizePageContent(content, searchText)
		if contentErr != nil {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(contentErr)
		}
	}

	// Check for conflicts only when content is being updated.
	// Title-only updates (rename) skip conflict detection because:
	// 1. Title changes are atomic and don't risk losing content
	// 2. Users expect consecutive renames to work without conflict errors
	// 3. Conflict detection is meant to protect content edits, not metadata changes
	if content != "" && !force && post.EditAt != baseEditAt {
		modifiedBy := post.UserId
		if lastModifiedBy, ok := post.Props[model.PagePropsLastModifiedBy].(string); ok && lastModifiedBy != "" {
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

	post.Props[model.PagePropsLastModifiedBy] = session.UserId

	updatedPost, storeErr := a.Srv().Store().Page().Update(rctx, post)
	if storeErr != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(storeErr, &notFoundErr) {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound)
		}

		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	// Attach files referenced in the content to this page
	if content != "" {
		fileIds := extractFileIdsFromContent(content)
		if len(fileIds) > 0 {
			a.attachFileIDsToPost(rctx, pageID, updatedPost.ChannelId, session.UserId, fileIds)
		}
	}

	if content != "" {
		if channel == nil {
			var chanErr *model.AppError
			channel, chanErr = a.GetChannel(rctx, updatedPost.ChannelId)
			if chanErr != nil {
				rctx.Logger().Warn("Failed to get channel for mention handling",
					mlog.String("page_id", pageID),
					mlog.String("channel_id", updatedPost.ChannelId),
					mlog.Err(chanErr))
			}
		}
		if channel != nil {
			a.handlePageMentions(rctx, updatedPost, channel, content, session.UserId)
		}
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

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
	// In HA clusters, clients on other nodes may request data immediately after
	// receiving the WebSocket event. Cache must be invalidated first to prevent
	// serving stale data.
	a.invalidateCacheForChannelPosts(updatedPost.ChannelId)

	// Broadcast POST_EDITED event so all clients update their page content
	a.sendPageEditedEvent(rctx, updatedPost)

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId, nil, nil)

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

	// Atomic deletion with reparenting: reparents children to the deleted page's parent,
	// then deletes content, comments, and page post - all in a single transaction.
	// This prevents race conditions where a new child could be added between reparenting and deletion.
	if err := a.Srv().Store().Page().DeletePage(pageID, session.UserId, page.PageParentId); err != nil {
		return model.NewAppError("DeletePage", "app.page.delete.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
	// In HA clusters, clients on other nodes may request data immediately after
	// receiving the WebSocket event.
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

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
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
	// Verify the page exists
	if _, appErr := a.GetSinglePost(rctx, pageId, false); appErr != nil {
		return nil, model.NewAppError("App.GetPageVersionHistory", "app.page.get_version_history.not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	}

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

// extractFileIdsFromContent extracts Mattermost file IDs from TipTap JSON content.
// It searches for /api/v4/files/{fileId} patterns in the content string.
// Returns a deduplicated slice of file IDs.
func extractFileIdsFromContent(content string) []string {
	if content == "" {
		return nil
	}

	matches := fileIdPattern.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil
	}

	// Deduplicate file IDs
	seen := make(map[string]bool)
	var fileIds []string
	for _, match := range matches {
		if len(match) > 1 {
			fileId := match[1]
			if !seen[fileId] {
				seen[fileId] = true
				fileIds = append(fileIds, fileId)
			}
		}
	}

	return fileIds
}

// validateAndNormalizePageContent validates and normalizes page content.
// If content looks like JSON, validates it as TipTap document.
// If content contains markdown syntax, converts it to TipTap JSON via markdown parsing.
// If content is plain text, converts it to TipTap JSON format.
// Returns the normalized content, updated searchText, and any validation error.
func validateAndNormalizePageContent(content, searchText string) (string, string, error) {
	if content == "" {
		return content, searchText, nil
	}

	trimmedContent := strings.TrimSpace(content)

	// If content looks like JSON (starts with {), validate it as TipTap (no fallthrough - fail fast)
	if strings.HasPrefix(trimmedContent, "{") {
		if err := model.ValidateTipTapDocument(content); err != nil {
			return "", "", err
		}
		return content, searchText, nil
	}

	// Markdown content → convert to TipTap
	if utils.LooksLikeMarkdown(content) {
		tiptap, err := utils.MarkdownToTipTapJSON(content)
		if err != nil {
			// Fallback to plain text if markdown conversion fails
			tiptap = convertPlainTextToTipTapJSON(content)
		}
		// Leave searchText empty; PreSave() computes it from TipTap JSON
		return tiptap, "", nil
	}

	// Plain text → wrap in paragraphs
	normalizedContent := convertPlainTextToTipTapJSON(content)

	// Extract search text from plain content if not provided
	if searchText == "" {
		searchText = content
	}

	return normalizedContent, searchText, nil
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
