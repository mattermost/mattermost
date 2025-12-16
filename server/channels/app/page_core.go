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
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
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

func getPagePermission(operation PageOperation) *model.Permission {
	switch operation {
	case PageOperationCreate:
		return model.PermissionCreatePage
	case PageOperationRead:
		return model.PermissionReadPage
	case PageOperationEdit:
		return model.PermissionEditPage
	case PageOperationDelete:
		return model.PermissionDeleteOwnPage
	default:
		return nil
	}
}

// checkPagePermissionInChannel checks if a user can perform an operation on pages in a channel.
// This is the core permission checking logic used by both CreatePage and HasPermissionToModifyPage.
// For ownership-based checks (edit/delete others' pages), use HasPermissionToModifyPage instead.
func (a *App) checkPagePermissionInChannel(
	rctx request.CTX,
	userID string,
	channel *model.Channel,
	operation PageOperation,
	operationName string,
) *model.AppError {
	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		permission := getPagePermission(operation)
		if permission == nil {
			return model.NewAppError(operationName, "api.page.permission.invalid_operation", nil, "", http.StatusForbidden)
		}
		if !a.HasPermissionToChannel(rctx, userID, channel.Id, permission) {
			return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, err := a.GetChannelMember(rctx, channel.Id, userID); err != nil {
			return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
		}
		user, err := a.GetUser(userID)
		if err != nil {
			return err
		}
		if user.IsGuest() {
			return model.NewAppError(operationName, "api.page.permission.guest_cannot_modify", nil, "", http.StatusForbidden)
		}

	default:
		return model.NewAppError(operationName, "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
	}

	return nil
}

// HasPermissionToModifyPage checks if a user can perform an action on a page.
// For Create/Read/Edit: Checks if user has the channel-level page permission.
// For Delete: Checks permission AND requires user to be page author OR channel admin.
func (a *App) HasPermissionToModifyPage(
	rctx request.CTX,
	session *model.Session,
	page *model.Post,
	operation PageOperation,
	operationName string,
) *model.AppError {
	channel, err := a.GetChannel(rctx, page.ChannelId)
	if err != nil {
		return err
	}

	if err := a.checkPagePermissionInChannel(rctx, session.UserId, channel, operation, operationName); err != nil {
		return err
	}

	// Additional ownership checks for existing pages in Open/Private channels
	if channel.Type == model.ChannelTypeOpen || channel.Type == model.ChannelTypePrivate {
		if operation == PageOperationDelete && page.UserId != session.UserId {
			if !a.HasPermissionToChannel(rctx, session.UserId, channel.Id, model.PermissionDeletePage) {
				return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			}
		}
	}

	// Additional ownership checks for existing pages in DM/Group channels
	if channel.Type == model.ChannelTypeGroup || channel.Type == model.ChannelTypeDirect {
		if operation == PageOperationEdit || operation == PageOperationDelete {
			if page.UserId != session.UserId {
				member, memberErr := a.GetChannelMember(rctx, channel.Id, session.UserId)
				if memberErr != nil {
					return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden).Wrap(memberErr)
				}
				if !member.SchemeAdmin {
					return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
				}
			}
		}
	}

	return nil
}

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

	if permErr := a.checkPagePermissionInChannel(rctx, userID, channel, PageOperationCreate, "CreatePage"); permErr != nil {
		return nil, permErr
	}

	if pageParentID != "" {
		parentPost, err := a.GetSinglePost(rctx, pageParentID, false)
		if err != nil {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_parent.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if !IsPagePost(parentPost) {
			return nil, model.NewAppError("CreatePage", "app.page.create.parent_not_page.app_error", nil, "", http.StatusBadRequest)
		}
		if parentPost.ChannelId != channelID {
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

	// VALIDATE OR AUTO-CONVERT CONTENT
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

	if enrichErr := a.EnrichPageWithProperties(rctx, createdPage); enrichErr != nil {
		return nil, enrichErr
	}

	if contentErr := a.loadPageContentForPost(createdPage); contentErr != nil {
		return nil, contentErr
	}

	return createdPage, nil
}

// getPagePost fetches a page post and validates it is of type PostTypePage.
// This is an internal helper that does NOT check permissions or load content.
// Use GetPage for external API calls that need permission checks and full content.
// Note: Uses master DB to avoid read-after-write issues with replica lag in cloud deployments.
func (a *App) getPagePost(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Post().GetSingle(sqlstore.RequestContextWithMaster(rctx), pageID, false)
	if err != nil {
		return nil, model.NewAppError("getPagePost", "app.page.get.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return nil, model.NewAppError("getPagePost", "app.page.get.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	return post, nil
}

// GetPage fetches a page with permission check
func (a *App) GetPage(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("view", time.Since(start).Seconds())
		}
	}()

	post, err := a.getPagePost(rctx, pageID)
	if err != nil {
		return nil, err
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationRead, "GetPage"); err != nil {
		return nil, err
	}

	pageContent, contentErr := a.Srv().Store().Page().GetPageContent(pageID)
	if contentErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(contentErr, &nfErr) {
			post.Message = ""
		} else {
			return nil, model.NewAppError("GetPage", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
		}
	} else {
		contentJSON, jsonErr := pageContent.GetDocumentJSON()
		if jsonErr != nil {
			return nil, model.NewAppError("GetPage", "app.page.get.serialize_content.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		}
		post.Message = contentJSON
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, post); enrichErr != nil {
		return nil, enrichErr
	}

	return post, nil
}

// PageContentLoadOptions specifies what page content to load for a PostList.
type PageContentLoadOptions struct {
	// IncludeDeleted includes content for deleted pages (used for version history)
	IncludeDeleted bool
	// SearchTextOnly loads only search_text into Props instead of full document JSON
	// This is more efficient for search results where full content isn't needed
	SearchTextOnly bool
}

// LoadPageContentForPostList loads page content from the pagecontent table for any pages in the PostList.
// This populates the Message field with the full page content stored in the pagecontent table.
func (a *App) LoadPageContentForPostList(rctx request.CTX, postList *model.PostList) *model.AppError {
	return a.loadPageContentForPostList(rctx, postList, PageContentLoadOptions{})
}

// LoadPageContentForPostListIncludingDeleted loads page content including historical (deleted) versions.
// Use this for version history where posts have DeleteAt > 0.
func (a *App) LoadPageContentForPostListIncludingDeleted(rctx request.CTX, postList *model.PostList) *model.AppError {
	return a.loadPageContentForPostList(rctx, postList, PageContentLoadOptions{IncludeDeleted: true})
}

// EnrichPagesWithSearchText adds search_text to Props for pages in search results.
// This is used for displaying page content in search results without modifying Post.Message.
// Post.Message stays empty for pages; search_text in Props is used only for display.
func (a *App) EnrichPagesWithSearchText(rctx request.CTX, postList *model.PostList) *model.AppError {
	return a.loadPageContentForPostList(rctx, postList, PageContentLoadOptions{SearchTextOnly: true})
}

// loadPageContentForPostList is the unified implementation for loading page content.
// It handles full content loading, search text only, and deleted content based on options.
func (a *App) loadPageContentForPostList(rctx request.CTX, postList *model.PostList, opts PageContentLoadOptions) *model.AppError {
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
		return model.NewAppError("loadPageContentForPostList", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
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
				return model.NewAppError("loadPageContentForPostList", "app.page.get.serialize_content.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
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
func (a *App) loadPageContentForPost(post *model.Post) *model.AppError {
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

// UpdatePage updates a page's title and/or content
func (a *App) UpdatePage(rctx request.CTX, pageID, title, content, searchText string) (*model.Post, *model.AppError) {
	post, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return nil, model.NewAppError("UpdatePage", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return nil, model.NewAppError("UpdatePage", "app.page.update.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationEdit, "UpdatePage"); err != nil {
		return nil, err
	}

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

	if content != "" {
		a.handlePageMentions(rctx, updatedPost, updatedPost.ChannelId, content, session.UserId)
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, updatedPost); enrichErr != nil {
		return nil, enrichErr
	}

	if contentErr := a.loadPageContentForPost(updatedPost); contentErr != nil {
		return nil, contentErr
	}

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId)

	// Broadcast title update if title was changed
	if title != "" {
		wikiId, _ := updatedPost.Props["wiki_id"].(string)
		if wikiId != "" {
			a.BroadcastPageTitleUpdated(pageID, title, wikiId, updatedPost.ChannelId, updatedPost.UpdateAt)
		}
	}

	return updatedPost, nil
}

// UpdatePageWithOptimisticLocking updates a page with first-one-wins concurrency control
// baseEditAt is the EditAt timestamp the client last saw when they started editing
// Returns 409 Conflict if the page content was modified by someone else
// Returns 404 Not Found if the page was deleted
func (a *App) UpdatePageWithOptimisticLocking(rctx request.CTX, pageID, title, content, searchText string, baseEditAt int64, force bool) (*model.Post, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("update", time.Since(start).Seconds())
		}
	}()

	// Use master context to avoid reading stale data from replicas in HA mode
	// This is critical for conflict detection - we need the latest EditAt value
	post, err := a.GetSinglePost(sqlstore.RequestContextWithMaster(rctx), pageID, false)
	if err != nil {
		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationEdit, "UpdatePageWithOptimisticLocking"); err != nil {
		return nil, err
	}

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

	updatedPost, storeErr := a.Srv().Store().Page().Update(post)
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

	if enrichErr := a.EnrichPageWithProperties(rctx, updatedPost); enrichErr != nil {
		return nil, enrichErr
	}

	if contentErr := a.loadPageContentForPost(updatedPost); contentErr != nil {
		return nil, contentErr
	}

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId)

	return updatedPost, nil
}

// DeletePage deletes a page. If wikiId is provided, it will be included in the broadcast event.
func (a *App) DeletePage(rctx request.CTX, pageID string, wikiId ...string) *model.AppError {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("delete", time.Since(start).Seconds())
		}
	}()

	post, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return model.NewAppError("DeletePage", "app.page.delete.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return model.NewAppError("DeletePage", "app.page.delete.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationDelete, "DeletePage"); err != nil {
		return err
	}

	if deleteErr := a.Srv().Store().Page().DeletePage(pageID, session.UserId); deleteErr != nil {
		return model.NewAppError("DeletePage", "app.page.delete.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	// Use provided wikiId or empty string if not provided
	wiki := ""
	if len(wikiId) > 0 {
		wiki = wikiId[0]
	}
	a.broadcastPageDeleted(pageID, wiki, post.ChannelId, rctx.Session().UserId)
	return nil
}

func (a *App) RestorePage(rctx request.CTX, pageID string) *model.AppError {
	post, err := a.GetSinglePost(rctx, pageID, true)
	if err != nil {
		return model.NewAppError("RestorePage",
			"app.page.restore.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return model.NewAppError("RestorePage",
			"app.page.restore.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	if post.DeleteAt == 0 {
		return model.NewAppError("RestorePage",
			"app.page.restore.not_deleted.app_error", nil, "", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationDelete, "RestorePage"); err != nil {
		return err
	}

	if err := a.Srv().Store().Page().RestorePageContent(pageID); err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError("RestorePage",
				"app.page.restore.content_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	restoredPost := post.Clone()
	restoredPost.DeleteAt = 0
	restoredPost.UpdateAt = model.GetMillis()
	_, updateErr := a.Srv().Store().Post().Update(rctx, restoredPost, post)
	if updateErr != nil {
		return model.NewAppError("RestorePage",
			"app.page.restore.post_error.app_error", nil, "", http.StatusInternalServerError).Wrap(updateErr)
	}

	a.invalidateCacheForChannelPosts(restoredPost.ChannelId)

	if enrichErr := a.EnrichPageWithProperties(rctx, restoredPost); enrichErr != nil {
		rctx.Logger().Warn("Failed to enrich restored page", mlog.String("page_id", pageID), mlog.Err(enrichErr))
	}

	wikiId, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr != nil {
		wikiId = ""
	}

	a.BroadcastPagePublished(restoredPost, wikiId, restoredPost.ChannelId, "", session.UserId)
	return nil
}

func (a *App) PermanentDeletePage(rctx request.CTX, pageID string) *model.AppError {
	post, err := a.GetSinglePost(rctx, pageID, true)
	if err != nil {
		return model.NewAppError("PermanentDeletePage",
			"app.page.permanent_delete.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if !IsPagePost(post) {
		return model.NewAppError("PermanentDeletePage",
			"app.page.permanent_delete.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationDelete, "PermanentDeletePage"); err != nil {
		return err
	}

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

func (a *App) GetPageVersionHistory(rctx request.CTX, pageId string) ([]*model.Post, *model.AppError) {
	posts, err := a.Srv().Store().Page().GetPageVersionHistory(pageId)
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

	if loadErr := a.LoadPageContentForPostListIncludingDeleted(rctx, postList); loadErr != nil {
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
		updatedPost, patchErr = a.PatchPost(rctx, pageID, postPatch, patchPostOptions)
		if patchErr != nil {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.update_fileids.app_error", nil, "",
				http.StatusInternalServerError).Wrap(patchErr)
		}
	}

	// Reload the complete page with content for WebSocket event
	freshPage, getErr := a.GetPage(rctx, pageID)
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
		ChannelId: page.ChannelId,
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
