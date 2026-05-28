// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
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
	PageOperationRestore
)

// PageCommentOperation represents the type of operation being performed on a page comment.
// Page comments live in wiki backing channels (type 'W') which the public channel API
// excludes; their permission flow evaluates against the wiki's source channels via
// HasLinkedChannelPermission rather than the wiki backing channel itself.
type PageCommentOperation int

const (
	PageCommentOperationEdit PageCommentOperation = iota
	PageCommentOperationDelete
)

const (
	// ActiveEditorTimeoutMs is the time window (in milliseconds) to consider an editor as "active"
	// Editors who haven't made changes within this window are not shown as active
	ActiveEditorTimeoutMs = 5 * 60 * 1000 // 5 minutes
)

// sessionUserID returns the user ID from the request context's session, or ""
// if no session is present. Use this instead of inline nil checks on rctx.Session().
func sessionUserID(rctx request.CTX) string {
	if s := rctx.Session(); s != nil {
		return s.UserId
	}
	return ""
}

// CreatePage creates a new page with title and content.
// If pageID is provided, it will be used as the page's ID (for publishing drafts with unified IDs).
// If pageID is empty, a new ID will be generated.
func (a *App) CreatePage(rctx request.CTX, channelID, title, pageParentID, content, userID, searchText, pageID string) (*model.Post, *model.AppError) {
	// Pages live in wiki backing channels (ChannelTypeWiki), which are hidden from
	// generic GetChannel. Use the wiki-aware store accessor.
	channel, chanErr := a.GetWikiBackingChannel(rctx, channelID)
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
	if utf8.RuneCountInString(title) > model.MaxPageTitleLength {
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

	extractedSearchText := searchText
	if content != "" {
		var contentErr error
		content, extractedSearchText, contentErr = validateAndNormalizePageContent(content, searchText)
		if contentErr != nil {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(contentErr)
		}
	}

	page := &model.Post{
		Id:           pageID, // If empty, PreSave() will generate a new ID
		Type:         model.PostTypePage,
		ChannelId:    channelID,
		UserId:       userID,
		Message:      content,
		PageSearchText: extractedSearchText,
		PageParentId: pageParentID,
		Props: model.StringInterface{
			model.PagePropsTitle: title,
		},
	}

	createdPage, createErr := a.Srv().Store().Page().CreatePage(rctx, page, content)
	if createErr != nil {
		var invErr *store.ErrInvalidInput
		if errors.As(createErr, &invErr) {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(createErr)
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(createErr)
	}

	// Attach files referenced in the content to this page
	if content != "" {
		fileIds := extractFileIdsFromContent(content)
		if len(fileIds) > 0 {
			createdPage.FileIds = a.attachFileIDsToPost(rctx, createdPage.Id, channelID, userID, fileIds)
		}
	}

	a.EnrichPageWithProperties(rctx, createdPage, true)

	// Invalidate cache across cluster so other nodes see the new page
	a.invalidateCacheForChannelPosts(createdPage.ChannelId)

	return createdPage, nil
}

// GetPage fetches a page by ID and returns the Post.
// Returns error if not found or if the post is not a page type.
// Note: Uses master DB to avoid read-after-write issues with replica lag in cloud deployments.
func (a *App) GetPage(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Page().GetPage(RequestContextWithMaster(rctx), pageID, false)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetPage", "app.page.get.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetPage", "app.page.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return post, nil
}

// GetPageWithDeleted fetches a page including soft-deleted pages.
// Use for restore operations.
func (a *App) GetPageWithDeleted(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Page().GetPage(RequestContextWithMaster(rctx), pageID, true)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetPageWithDeleted", "app.page.get.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetPageWithDeleted", "app.page.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return post, nil
}

// GetPageWithContent fetches a page with its content.
// Content is stored directly in Post.Message, so this is equivalent to GetPage + EnrichPageWithProperties.
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

	a.EnrichPageWithProperties(rctx, page)

	return page, nil
}

// UpdatePage updates a page's title and/or content.
// channel is optional - if provided, avoids a DB fetch for mention handling.
func (a *App) UpdatePage(rctx request.CTX, page *model.Post, title, content, searchText string, channel *model.Channel) (*model.Post, *model.AppError) {
	pageID := page.Id

	if title != "" {
		title = strings.TrimSpace(title)
		title = model.SanitizeUnicode(title)
		if title == "" {
			return nil, model.NewAppError("UpdatePage", "app.page.update.missing_title.app_error", nil, "", http.StatusBadRequest)
		}
		if utf8.RuneCountInString(title) > model.MaxPageTitleLength {
			return nil, model.NewAppError("UpdatePage", "app.page.update.title_too_long.app_error", map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		}
	}

	// Validate and normalize content
	if content != "" {
		var contentErr error
		content, _, contentErr = validateAndNormalizePageContent(content, searchText)
		if contentErr != nil {
			return nil, model.NewAppError("UpdatePage", "app.page.update.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(contentErr)
		}
	}

	updatedPost, storeErr := a.Srv().Store().Page().UpdatePageWithContent(rctx, pageID, title, content)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(storeErr, &nfErr) {
			return nil, model.NewAppError("UpdatePage", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(storeErr)
		}
		var invErr *store.ErrInvalidInput
		if errors.As(storeErr, &invErr) {
			return nil, model.NewAppError("UpdatePage", "app.page.update.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(storeErr)
		}
		return nil, model.NewAppError("UpdatePage", "app.page.update.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	return a.finalizePageUpdate(rctx, updatedPost, title, content, channel)
}

// AttachFilesToPage associates uploaded files with a page and merges them into
// the page's FileIds. Files are attached using the session user as the
// uploader: page editors who aren't the original author can still attach their
// own uploads (the underlying SQL match requires the file's CreatorId to equal
// the supplied uploaderID).
//
// Existing FileIds are preserved — newly-attached IDs are appended (deduped).
// If no new files attach (e.g. all IDs failed the ownership check), the page
// is returned unchanged without a write.
func (a *App) AttachFilesToPage(rctx request.CTX, page *model.Post, fileIds []string) (*model.Post, *model.AppError) {
	uploaderID := page.UserId
	if session := rctx.Session(); session != nil && session.UserId != "" {
		uploaderID = session.UserId
	}

	newlyAttached := a.attachFileIDsToPost(rctx, page.Id, page.ChannelId, uploaderID, fileIds)
	if len(newlyAttached) == 0 {
		return page, nil
	}

	updatedPage := page.Clone()
	updatedPage.FileIds = utils.RemoveDuplicatesFromStringArray(append(page.FileIds, newlyAttached...))

	if _, err := a.Srv().Store().Post().Overwrite(rctx, updatedPage); err != nil {
		return nil, model.NewAppError("AttachFilesToPage", "app.page.attach_files.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Invalidate cache so HA nodes don't serve stale page content after file attachment.
	a.invalidateCacheForChannelPosts(updatedPage.ChannelId)

	return updatedPage, nil
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

	// GetPage always reads from master — see its implementation.
	post, err := a.GetPage(rctx, pageID)
	if err != nil {
		return nil, model.NewAppError("UpdatePageWithOptimisticLocking",
			"app.page.update.not_found.app_error", nil, "", err.StatusCode).Wrap(err)
	}

	userID := sessionUserID(rctx)

	if title != "" {
		title = strings.TrimSpace(title)
		title = model.SanitizeUnicode(title)
		if title == "" {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.missing_title.app_error", nil, "", http.StatusBadRequest)
		}
		if utf8.RuneCountInString(title) > model.MaxPageTitleLength {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.title_too_long.app_error", map[string]any{"MaxLength": model.MaxPageTitleLength}, "", http.StatusBadRequest)
		}
	}

	// Validate and normalize content
	var extractedSearchText string
	if content != "" {
		var contentErr error
		content, extractedSearchText, contentErr = validateAndNormalizePageContent(content, searchText)
		if contentErr != nil {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(contentErr)
		}
	}

	// Check for conflicts only when content is being updated.
	// Title-only updates (rename) skip conflict detection because:
	// 1. Title changes are atomic and don't risk losing content
	// 2. Users expect consecutive renames to work without conflict errors
	// 3. Conflict detection is meant to protect content edits, not metadata changes
	rctx.Logger().Debug("UpdatePageWithOptimisticLocking conflict check",
		mlog.String("page_id", pageID),
		mlog.String("user_id", userID),
		mlog.Int("db_edit_at", post.EditAt),
		mlog.Int("base_edit_at", baseEditAt),
		mlog.Bool("force", force),
		mlog.Bool("has_content", content != ""),
	)
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
		if post.Props == nil {
			post.Props = make(model.StringInterface)
		}
		post.Props[model.PagePropsTitle] = title
	}

	if content != "" {
		post.Message = content
		post.PageSearchText = extractedSearchText
	}

	if post.Props == nil {
		post.Props = make(model.StringInterface)
	}
	post.Props[model.PagePropsLastModifiedBy] = userID

	updatedPost, storeErr := a.Srv().Store().Page().Update(rctx, post)
	if storeErr != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(storeErr, &notFoundErr) {
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(storeErr)
		}

		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	return a.finalizePageUpdate(rctx, updatedPost, title, content, channel)
}

// finalizePageUpdate handles post-store-update side effects shared by UpdatePage and UpdatePageWithOptimisticLocking:
// file attachment, mention handling, property enrichment, cache invalidation, and WebSocket broadcasts.
func (a *App) finalizePageUpdate(rctx request.CTX, updatedPost *model.Post, title, content string, channel *model.Channel) (*model.Post, *model.AppError) {
	userID := sessionUserID(rctx)

	// Attach files referenced in the content to this page
	if content != "" {
		fileIds := extractFileIdsFromContent(content)
		if len(fileIds) > 0 {
			updatedPost.FileIds = a.attachFileIDsToPost(rctx, updatedPost.Id, updatedPost.ChannelId, userID, fileIds)
		}
	}

	if content != "" {
		if channel == nil {
			var chanErr *model.AppError
			channel, chanErr = a.GetWikiBackingChannel(rctx, updatedPost.ChannelId)
			if chanErr != nil {
				rctx.Logger().Warn("Failed to get channel for mention handling",
					mlog.String("page_id", updatedPost.Id),
					mlog.String("channel_id", updatedPost.ChannelId),
					mlog.Err(chanErr))
			}
		}
		if channel != nil {
			a.handlePageMentions(rctx, updatedPost, channel, content, userID)
		}
	}

	a.EnrichPageWithProperties(rctx, updatedPost, true)

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
	// In HA clusters, clients on other nodes may request data immediately after
	// receiving the WebSocket event. Cache must be invalidated first to prevent
	// serving stale data.
	a.invalidateCacheForChannelPosts(updatedPost.ChannelId)

	// Broadcast page_edited event so clients update the page
	a.sendPageEditedEvent(rctx, updatedPost)

	a.handlePageUpdateNotification(rctx, updatedPost, userID, nil, nil)

	// Broadcast title update if title was changed
	if title != "" {
		wikiId, wikiErr := a.GetWikiIdForPage(rctx, updatedPost.Id)
		if wikiErr != nil {
			rctx.Logger().Warn("Failed to get wiki ID for page, title broadcast skipped",
				mlog.String("post_id", updatedPost.Id), mlog.Err(wikiErr))
		} else if wikiId != "" {
			a.BroadcastPageTitleUpdated(updatedPost.Id, title, wikiId, updatedPost.UpdateAt)
		}
	}

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
	userID := sessionUserID(rctx)

	// Atomic deletion with reparenting: reparents children to the deleted page's parent,
	// then deletes content, comments, and page post - all in a single transaction.
	// This prevents race conditions where a new child could be added between reparenting and deletion.
	if err := a.Srv().Store().Page().DeletePage(pageID, userID, page.PageParentId); err != nil {
		return model.NewAppError("DeletePage", "app.page.delete.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
	// In HA clusters, clients on other nodes may request data immediately after
	// receiving the WebSocket event.
	a.invalidateCacheForChannelPosts(page.ChannelId)

	a.broadcastPageDeleted(pageID, wikiId, userID, page.PageParentId)
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

	userID := sessionUserID(rctx)

	// Atomic restoration of content and page post in a single transaction
	if err := a.Srv().Store().Page().RestorePage(pageID); err != nil {
		return model.NewAppError("RestorePage",
			"app.page.restore.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Re-fetch from master to get DB-authoritative timestamps
	restoredPost, readErr := a.GetPage(RequestContextWithMaster(rctx), pageID)
	if readErr != nil {
		// Fallback: construct from clone
		restoredPost = post.Clone()
		restoredPost.DeleteAt = 0
		restoredPost.UpdateAt = model.GetMillis()
	}

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
	a.invalidateCacheForChannelPosts(restoredPost.ChannelId)

	a.EnrichPageWithProperties(rctx, restoredPost, true)

	wikiId, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr != nil {
		rctx.Logger().Warn("Failed to get wiki ID for restored page; broadcasting without wiki context",
			mlog.String("page_id", pageID), mlog.Err(wikiErr))
		wikiId = ""
	}

	a.BroadcastPagePublished(restoredPost, wikiId, "", userID)
	return nil
}

// PermanentDeletePage permanently deletes a page and its associated file blobs.
func (a *App) PermanentDeletePage(rctx request.CTX, page *model.Post) *model.AppError {
	if len(page.FileIds) > 0 {
		if err := a.PermanentDeleteFilesByPost(rctx, page.Id, nil); err != nil {
			return err
		}
	}
	if group, err := a.GetPagePropertyGroup(); err == nil {
		if appErr := a.DeletePropertyValuesForTarget(rctx, group.ID, model.PropertyValueTargetTypePage, page.Id); appErr != nil {
			rctx.Logger().Warn("PermanentDeletePage: failed to clean up property values", mlog.String("page_id", page.Id), mlog.Err(appErr))
		}
	} else {
		rctx.Logger().Warn("PermanentDeletePage: failed to get page property group, skipping property value cleanup", mlog.String("page_id", page.Id), mlog.Err(err))
	}
	if err := a.Srv().Store().Page().PermanentDeletePage(page.Id); err != nil {
		return model.NewAppError("PermanentDeletePage", "app.page.permanent_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	a.invalidateCacheForChannelPosts(page.ChannelId)
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
	if _, appErr := a.GetPage(rctx, pageId); appErr != nil {
		return nil, model.NewAppError("App.GetPageVersionHistory", "app.page.get_version_history.not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	}

	posts, err := a.Srv().Store().Page().GetPageVersionHistory(pageId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("App.GetPageVersionHistory", "app.page.get_version_history.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return posts, nil
}

// RestorePageVersion restores a page to a previous version from its history
func (a *App) RestorePageVersion(
	rctx request.CTX,
	userID, pageID, restoreVersionID string,
	toRestorePostVersion *model.Post,
) (*model.Post, *model.AppError) {
	// Extract title from historical post
	var title string
	if toRestorePostVersion.Props != nil {
		if titleValue, ok := toRestorePostVersion.Props[model.PagePropsTitle]; ok {
			if titleStr, isString := titleValue.(string); isString {
				title = titleStr
			}
		}
	}

	// Content is stored directly in Post.Message
	content := toRestorePostVersion.Message

	// Restore content and title together using UpdatePageWithContent
	updatedPost, storeErr := a.Srv().Store().Page().UpdatePageWithContent(
		rctx, pageID, title, content)
	if storeErr != nil {
		return nil, model.NewAppError("RestorePageVersion",
			"app.page.restore.update_content.app_error", nil, "",
			http.StatusInternalServerError).Wrap(storeErr)
	}

	// Restore FileIds if they differ (UpdatePageWithContent doesn't handle FileIds)
	if !toRestorePostVersion.FileIds.Equals(updatedPost.FileIds) {
		var fileIdsErr error
		updatedPost, fileIdsErr = a.Srv().Store().Page().UpdatePageFileIds(pageID, toRestorePostVersion.Id, toRestorePostVersion.FileIds)
		if fileIdsErr != nil {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.update_fileids.app_error", nil, "",
				http.StatusInternalServerError).Wrap(fileIdsErr)
		}
	}

	// Reload the complete page for WebSocket event.
	// RequestContextWithMaster ensures we read from the primary in HA deployments
	// to avoid replica lag after the preceding writes.
	freshPage, getErr := a.GetPageWithContent(RequestContextWithMaster(rctx), pageID)
	if getErr != nil {
		freshPage = updatedPost
	}

	// CRITICAL: Invalidate cache across cluster BEFORE WebSocket broadcast.
	// In HA clusters, clients on other nodes may request data immediately after
	// receiving the WebSocket event. Cache must be invalidated first to prevent
	// serving stale data.
	a.invalidateCacheForChannelPosts(freshPage.ChannelId)

	// Send WebSocket POST_EDITED event so clients update the page
	a.sendPageEditedEvent(rctx, freshPage)

	return updatedPost, nil
}

// SendPageEditedBroadcast broadcasts a page_edited WS event. Use when file IDs or other
// metadata are updated after the primary UpdatePage call already emitted a broadcast.
func (a *App) SendPageEditedBroadcast(rctx request.CTX, page *model.Post) {
	a.sendPageEditedEvent(rctx, page)
}

// sendPageEditedEvent sends a WebSocket page_edited event for a page.
// Uses a dedicated page event type (not post_edited) to avoid contaminating post Redux state.
func (a *App) sendPageEditedEvent(rctx request.CTX, page *model.Post) {
	pageJSON, jsonErr := page.ToJSON()
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to encode page to JSON for WebSocket event",
			mlog.String("page_id", page.Id),
			mlog.Err(jsonErr))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPageEdited, "", "", "", nil, "")
	message.Add("post", pageJSON)
	wikiId, _ := page.GetProps()[model.PagePropsWikiID].(string)
	if wikiId == "" {
		// Without a wiki id we have no audience: backing-channel members never
		// receive these events (channel type is excluded), and the helper resolves
		// recipients from WikiLinks keyed on the wiki. Drop the broadcast rather
		// than emit to an empty audience.
		rctx.Logger().Debug("Skipping page_edited broadcast: page has no wiki_id prop",
			mlog.String("page_id", page.Id))
		return
	}
	message.Add("wiki_id", wikiId)

	a.publishToLinkedSourceChannels(wikiId, message)
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

	// If content looks like JSON (starts with {), parse and sanitize it as TipTap.
	// ParseTipTapDocument validates structure AND sanitizes URLs (blocking javascript: etc.).
	if strings.HasPrefix(trimmedContent, "{") {
		doc, err := model.ParseTipTapDocument(content)
		if err != nil {
			return "", "", err
		}
		sanitized, err := json.Marshal(doc)
		if err != nil {
			return "", "", err
		}
		return string(sanitized), model.BuildSearchText(doc), nil
	}

	// Markdown content → convert to TipTap
	if utils.LooksLikeMarkdown(content) {
		tiptap, err := utils.MarkdownToTipTapJSON(content)
		if err != nil {
			// Fallback to plain text if markdown conversion fails
			tiptap = convertPlainTextToTipTapJSON(content)
		}
		var mdSearchText string
		if doc, parseErr := model.ParseTipTapDocument(tiptap); parseErr == nil {
			if sanitized, marshalErr := json.Marshal(doc); marshalErr == nil {
				tiptap = string(sanitized)
			}
			mdSearchText = model.BuildSearchText(doc)
		}
		return tiptap, mdSearchText, nil
	}

	// Plain text → wrap in paragraphs
	normalizedContent := convertPlainTextToTipTapJSON(content)

	if doc, parseErr := model.ParseTipTapDocument(normalizedContent); parseErr == nil {
		searchText = model.BuildSearchText(doc)
	} else if searchText == "" {
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

// CreateWikiPage creates a new page in a wiki.
// If pageID is provided, it will be used as the page's ID (for publishing drafts with unified IDs).
// If pageID is empty, a new ID will be generated.
//
// Atomicity note: this performs two separate store writes — Posts (CreatePageWithChannel)
// and PropertyValues (AddPageToWiki). A forward error from AddPageToWiki triggers a
// store-level rollback (DeletePage below). A process crash between the two writes
// would leave an orphaned page row with no wiki association; that hazard is accepted
// here in favor of keeping the store API surface small. Full crash-atomicity would
// require extending SqlPageStore.CreatePage to accept the wiki property IDs and
// perform both inserts inside a single transaction.
func (a *App) CreateWikiPage(rctx request.CTX, wikiId, parentId, title, content, userId, searchText, pageID string) (*model.Post, *model.AppError) {
	isChild := parentId != ""
	rctx.Logger().Debug("CreateWikiPage entry",
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId),
		mlog.String("title", title),
		mlog.String("page_id", pageID),
		mlog.Bool("is_child_page", isChild))

	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, err
	}

	if wiki.ChannelId == "" {
		return nil, model.NewAppError("CreateWikiPage", "app.wiki.create_page.no_channel.app_error", nil, "", http.StatusBadRequest)
	}

	// Fetch channel once and reuse for page creation, notification, and mentions.
	// Wiki backing channels are ChannelTypeWiki and hidden from generic GetChannel —
	// use the wiki-aware store accessor.
	channel, chanErr := a.GetWikiBackingChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("CreateWikiPage", "app.wiki.create_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	createdPage, createErr := a.CreatePageWithChannel(rctx, channel, title, parentId, content, userId, searchText, pageID)
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page created, now linking to wiki",
		mlog.String("page_id", createdPage.Id),
		mlog.String("wiki_id", wikiId),
		mlog.Bool("is_child_page", isChild))

	if linkErr := a.AddPageToWiki(rctx, createdPage.Id, wikiId); linkErr != nil {
		rctx.Logger().Warn("Failed to link page to wiki, rolling back page creation",
			mlog.String("page_id", createdPage.Id),
			mlog.String("wiki_id", wikiId),
			mlog.Bool("is_child_page", isChild),
			mlog.Err(linkErr))
		// Use permanent delete for rollback so the failed page leaves no trace.
		// Store-only (no WS broadcast) since clients never received a creation event.
		if deleteErr := a.Srv().Store().Page().PermanentDeletePage(createdPage.Id); deleteErr != nil {
			rctx.Logger().Warn("Failed to delete page after wiki link failure", mlog.String("page_id", createdPage.Id), mlog.Err(deleteErr))
		} else {
			a.invalidateCacheForChannelPosts(createdPage.ChannelId)
		}
		return nil, linkErr
	}

	// Add wiki_id to the in-memory post so subsequent updates don't lose it
	createdPage.AddProp(model.PagePropsWikiID, wikiId)

	rctx.Logger().Debug("Wiki page created and linked successfully",
		mlog.String("page_id", createdPage.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId),
		mlog.String("title", title),
		mlog.Bool("is_child_page", isChild))

	a.sendPageAddedNotification(rctx, createdPage, wiki, channel, userId, title)

	if content != "" {
		a.handlePageMentions(rctx, createdPage, channel, content, userId)
	}

	return createdPage, nil
}

// ValidateURLForSSRF checks whether rawURL resolves to a private or reserved IP address.
// It is intended to be called before making outbound HTTP requests on behalf of a user.
func (a *App) ValidateURLForSSRF(ctx context.Context, rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return err
	}
	host := u.Hostname()

	if ip := net.ParseIP(host); ip != nil {
		if httpservice.IsReservedIP(ip) {
			return errors.New("URL resolves to a private or reserved address")
		}
		return nil
	}

	dnsCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	ips, err := net.DefaultResolver.LookupHost(dnsCtx, host)
	if err != nil {
		// Fail open on transient DNS errors: the transport-layer SSRF guard
		// (httpservice) will block reserved IPs even if we can't resolve here.
		return nil
	}
	for _, ipStr := range ips {
		ip := net.ParseIP(ipStr)
		if ip == nil {
			continue
		}
		if httpservice.IsReservedIP(ip) {
			return errors.New("URL resolves to a private or reserved address")
		}
	}
	return nil
}
