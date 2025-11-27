// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

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

func getPagePermission(channelType model.ChannelType, operation PageOperation) *model.Permission {
	permMap := map[model.ChannelType]map[PageOperation]*model.Permission{
		model.ChannelTypeOpen: {
			PageOperationCreate: model.PermissionCreatePagePublicChannel,
			PageOperationRead:   model.PermissionReadPagePublicChannel,
			PageOperationEdit:   model.PermissionEditPagePublicChannel,
			PageOperationDelete: model.PermissionDeletePagePublicChannel,
		},
		model.ChannelTypePrivate: {
			PageOperationCreate: model.PermissionCreatePagePrivateChannel,
			PageOperationRead:   model.PermissionReadPagePrivateChannel,
			PageOperationEdit:   model.PermissionEditPagePrivateChannel,
			PageOperationDelete: model.PermissionDeletePagePrivateChannel,
		},
	}
	return getEntityPermissionByChannelType(channelType, operation, permMap)
}

func getPagePermissionForEditOthers(channelType model.ChannelType, operation PageOperation) *model.Permission {
	permMap := map[model.ChannelType]map[PageOperation]*model.Permission{
		model.ChannelTypeOpen: {
			PageOperationEdit:   model.PermissionEditOthersPagePublicChannel,
			PageOperationDelete: model.PermissionDeletePagePublicChannel,
		},
		model.ChannelTypePrivate: {
			PageOperationEdit:   model.PermissionEditOthersPagePrivateChannel,
			PageOperationDelete: model.PermissionDeletePagePrivateChannel,
		},
	}
	return getEntityPermissionByChannelType(channelType, operation, permMap)
}

// HasPermissionToModifyPage checks if a user can perform an action on a page.
// It verifies channel membership, channel-level page permission, and ownership.
// This implements the additive permission model: channel permission + ownership check.
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

	rctx.Logger().Debug("HasPermissionToModifyPage called",
		mlog.String("operation", fmt.Sprintf("%d", operation)),
		mlog.String("operation_name", operationName),
		mlog.String("user_id", session.UserId),
		mlog.String("channel_id", channel.Id),
		mlog.String("channel_type", string(channel.Type)),
		mlog.String("page_id", page.Id),
	)

	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		permission := getPagePermission(channel.Type, operation)
		if permission == nil {
			rctx.Logger().Error("Invalid channel type for page permission")
			return model.NewAppError(operationName, "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
		}

		rctx.Logger().Debug("Checking page permission",
			mlog.String("permission", permission.Id),
			mlog.String("user_id", session.UserId),
			mlog.String("channel_id", channel.Id),
		)

		hasPermission := a.SessionHasPermissionToChannel(rctx, *session, channel.Id, permission)
		rctx.Logger().Debug("Permission check result",
			mlog.Bool("has_permission", hasPermission),
			mlog.String("permission", permission.Id),
		)

		if !hasPermission {
			rctx.Logger().Warn("User lacks required page permission",
				mlog.String("user_id", session.UserId),
				mlog.String("permission", permission.Id),
				mlog.String("channel_id", channel.Id),
			)
			return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
		}

		if operation == PageOperationEdit || operation == PageOperationDelete {
			if page.UserId != session.UserId {
				member, err := a.GetChannelMember(rctx, channel.Id, session.UserId)
				if err != nil {
					rctx.Logger().Warn("Failed to get channel member for permission check",
						mlog.String("user_id", session.UserId),
						mlog.String("channel_id", channel.Id),
						mlog.Err(err),
					)
					return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden).Wrap(err)
				}

				if member.SchemeAdmin {
					rctx.Logger().Debug("User is channel admin, allowing edit/delete of others' pages",
						mlog.String("user_id", session.UserId),
						mlog.String("channel_id", channel.Id),
					)
				} else if operation == PageOperationEdit {
					othersPermission := getPagePermissionForEditOthers(channel.Type, operation)
					if othersPermission == nil {
						rctx.Logger().Error("No edit-others permission defined for this operation")
						return model.NewAppError(operationName, "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
					}

					hasOthersPermission := a.SessionHasPermissionToChannel(rctx, *session, channel.Id, othersPermission)
					rctx.Logger().Debug("Checking edit-others permission",
						mlog.Bool("has_others_permission", hasOthersPermission),
						mlog.String("permission", othersPermission.Id),
					)

					if !hasOthersPermission {
						rctx.Logger().Warn("User lacks permission to edit others' pages",
							mlog.String("user_id", session.UserId),
							mlog.String("page_owner", page.UserId),
							mlog.String("permission", othersPermission.Id),
						)
						return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
					}
				} else {
					rctx.Logger().Warn("User cannot delete others' pages without being channel admin",
						mlog.String("user_id", session.UserId),
						mlog.String("page_owner", page.UserId),
						mlog.String("channel_id", channel.Id),
					)
					return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
				}
			}
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, err := a.GetChannelMember(rctx, channel.Id, session.UserId); err != nil {
			return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
		}

		user, err := a.GetUser(session.UserId)
		if err != nil {
			return err
		}
		if user.IsGuest() {
			return model.NewAppError(operationName, "api.page.permission.guest_cannot_modify", nil, "", http.StatusForbidden)
		}

		if operation == PageOperationEdit || operation == PageOperationDelete {
			if page.UserId != session.UserId {
				member, err := a.GetChannelMember(rctx, channel.Id, session.UserId)
				if err != nil {
					return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden).Wrap(err)
				}
				if !member.SchemeAdmin {
					return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
				}
			}
		}

	default:
		return model.NewAppError(operationName, "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
	}

	return nil
}

// CreatePage creates a new page with title and content
func (a *App) CreatePage(rctx request.CTX, channelID, title, pageParentID, content, userID, searchText string) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Creating page",
		mlog.String("channel_id", channelID),
		mlog.String("title", title),
		mlog.String("parent_id", pageParentID))

	if title == "" {
		return nil, model.NewAppError("CreatePage", "app.page.create.missing_title.app_error", nil, "title is required for pages", http.StatusBadRequest)
	}
	if len(title) > model.MaxPageTitleLength {
		return nil, model.NewAppError("CreatePage", "app.page.create.title_too_long.app_error", nil, fmt.Sprintf("title must be %d characters or less", model.MaxPageTitleLength), http.StatusBadRequest)
	}

	channel, chanErr := a.GetChannel(rctx, channelID)
	if chanErr != nil {
		return nil, chanErr
	}

	var permission *model.Permission
	switch channel.Type {
	case model.ChannelTypeOpen:
		permission = model.PermissionCreatePagePublicChannel
	case model.ChannelTypePrivate:
		permission = model.PermissionCreatePagePrivateChannel
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, err := a.GetChannelMember(rctx, channel.Id, userID); err != nil {
			return nil, model.NewAppError("CreatePage", "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
		}
		user, err := a.GetUser(userID)
		if err != nil {
			return nil, err
		}
		if user.IsGuest() {
			return nil, model.NewAppError("CreatePage", "api.page.permission.guest_cannot_modify", nil, "", http.StatusForbidden)
		}
	default:
		return nil, model.NewAppError("CreatePage", "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
	}

	if permission != nil && !a.HasPermissionToChannel(rctx, userID, channelID, permission) {
		return nil, model.NewAppError("CreatePage", "app.page.create.permissions.app_error", nil, "", http.StatusForbidden)
	}

	if pageParentID != "" {
		parentPost, err := a.GetSinglePost(rctx, pageParentID, false)
		if err != nil {
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_parent.app_error", nil, "parent page not found", http.StatusBadRequest).Wrap(err)
		}
		if parentPost.Type != model.PostTypePage {
			return nil, model.NewAppError("CreatePage", "app.page.create.parent_not_page.app_error", nil, "parent must be a page", http.StatusBadRequest)
		}
		if parentPost.ChannelId != channelID {
			return nil, model.NewAppError("CreatePage", "app.page.create.parent_different_channel.app_error", nil, "parent must be in same channel", http.StatusBadRequest)
		}

		parentDepth, depthErr := a.calculatePageDepth(rctx, pageParentID)
		if depthErr != nil {
			return nil, depthErr
		}
		newPageDepth := parentDepth + 1
		if newPageDepth > model.PostPageMaxDepth {
			return nil, model.NewAppError("CreatePage", "app.page.create.max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth},
				"page hierarchy cannot exceed maximum depth", http.StatusBadRequest)
		}
	}

	// VALIDATE OR AUTO-CONVERT CONTENT
	if content != "" {
		trimmedContent := strings.TrimSpace(content)

		// If content looks like JSON (starts with {), validate it
		if strings.HasPrefix(trimmedContent, "{") {
			var testJSON map[string]any
			if err := json.Unmarshal([]byte(content), &testJSON); err != nil {
				return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "content must be valid JSON", http.StatusBadRequest).Wrap(err)
			}

			// Valid JSON but not TipTap format - reject it
			// TipTap documents must have type:"doc"
			docType, ok := testJSON["type"].(string)
			if !ok || docType != "doc" {
				return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "content must be valid TipTap JSON with type: doc", http.StatusBadRequest)
			}
		} else {
			// Not JSON - treat as plain text and auto-convert to TipTap JSON
			rctx.Logger().Info("Auto-converting plain text content to TipTap JSON",
				mlog.String("user_id", userID),
				mlog.String("channel_id", channelID),
				mlog.Int("content_length", len(content)))

			content = convertPlainTextToTipTapJSON(content)

			// Extract search text from plain content if not provided
			if searchText == "" {
				searchText = content
			}
		}
	}

	page := &model.Post{
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
			return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, createErr.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(createErr)
	}

	rctx.Logger().Info("Page created successfully",
		mlog.String("page_id", createdPage.Id),
		mlog.String("channel_id", channelID),
		mlog.String("parent_id", pageParentID))

	if enrichErr := a.EnrichPageWithProperties(rctx, createdPage); enrichErr != nil {
		return nil, enrichErr
	}

	return createdPage, nil
}

// GetPage fetches a page with permission check
func (a *App) GetPage(rctx request.CTX, pageID string) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("GetPage called", mlog.String("page_id", pageID))

	post, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		rctx.Logger().Error("GetPage: GetSinglePost failed", mlog.String("page_id", pageID), mlog.Err(err))
		return nil, model.NewAppError("GetPage", "app.page.get.not_found.app_error", nil, "page not found", http.StatusNotFound).Wrap(err)
	}

	if post.Type != model.PostTypePage {
		rctx.Logger().Error("GetPage: post is not a page", mlog.String("page_id", pageID), mlog.String("type", post.Type))
		return nil, model.NewAppError("GetPage", "app.page.get.not_a_page.app_error", nil, "post is not a page", http.StatusBadRequest)
	}

	rctx.Logger().Debug("GetPage: page retrieved", mlog.String("page_id", pageID))

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationRead, "GetPage"); err != nil {
		rctx.Logger().Error("GetPage: permission denied", mlog.String("page_id", pageID))
		return nil, err
	}

	rctx.Logger().Debug("GetPage: fetching content", mlog.String("page_id", pageID))
	pageContent, contentErr := a.Srv().Store().Page().GetPageContent(pageID)
	if contentErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(contentErr, &nfErr) {
			rctx.Logger().Warn("GetPage: PageContent not found", mlog.String("page_id", pageID))
			post.Message = ""
		} else {
			rctx.Logger().Error("GetPage: error fetching PageContent", mlog.String("page_id", pageID), mlog.Err(contentErr))
			return nil, model.NewAppError("GetPage", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
		}
	} else {
		contentJSON, jsonErr := pageContent.GetDocumentJSON()
		if jsonErr != nil {
			rctx.Logger().Error("GetPage: error serializing content", mlog.String("page_id", pageID), mlog.Err(jsonErr))
			return nil, model.NewAppError("GetPage", "app.page.get.serialize_content.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		}
		rctx.Logger().Debug("GetPage: content retrieved", mlog.String("page_id", pageID), mlog.Int("content_length", len(contentJSON)))
		post.Message = contentJSON
	}

	if enrichErr := a.EnrichPageWithProperties(rctx, post); enrichErr != nil {
		return nil, enrichErr
	}

	rctx.Logger().Debug("GetPage: returning post", mlog.String("page_id", pageID), mlog.Int("message_length", len(post.Message)))
	return post, nil
}

// LoadPageContentForPostList loads page content from the pagecontent table for any pages in the PostList.
// This populates the Message field with the full page content stored in the pagecontent table.
func (a *App) LoadPageContentForPostList(rctx request.CTX, postList *model.PostList) *model.AppError {
	return a.loadPageContentForPostList(rctx, postList, false)
}

// LoadPageContentForPostListIncludingDeleted loads page content including historical (deleted) versions.
// Use this for version history where posts have DeleteAt > 0.
func (a *App) LoadPageContentForPostListIncludingDeleted(rctx request.CTX, postList *model.PostList) *model.AppError {
	return a.loadPageContentForPostList(rctx, postList, true)
}

func (a *App) loadPageContentForPostList(rctx request.CTX, postList *model.PostList, includeDeleted bool) *model.AppError {
	if postList == nil || postList.Posts == nil {
		return nil
	}

	pageIDs := []string{}
	for _, post := range postList.Posts {
		if post.Type == model.PostTypePage {
			pageIDs = append(pageIDs, post.Id)
		}
	}

	if len(pageIDs) == 0 {
		return nil
	}

	var pageContents []*model.PageContent
	var contentErr error

	if includeDeleted {
		pageContents, contentErr = a.Srv().Store().Page().GetManyPageContentsWithDeleted(pageIDs)
	} else {
		pageContents, contentErr = a.Srv().Store().Page().GetManyPageContents(pageIDs)
	}
	if contentErr != nil {
		rctx.Logger().Error("loadPageContentForPostList: error fetching PageContents", mlog.Int("count", len(pageIDs)), mlog.Bool("include_deleted", includeDeleted), mlog.Err(contentErr))
		return model.NewAppError("loadPageContentForPostList", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	contentMap := make(map[string]*model.PageContent, len(pageContents))
	for _, content := range pageContents {
		contentMap[content.PageId] = content
	}

	for _, post := range postList.Posts {
		if post.Type == model.PostTypePage {
			pageContent, found := contentMap[post.Id]
			if !found {
				rctx.Logger().Warn("loadPageContentForPostList: PageContent not found for page", mlog.String("page_id", post.Id))
				post.Message = ""
				continue
			}

			contentJSON, jsonErr := pageContent.GetDocumentJSON()
			if jsonErr != nil {
				rctx.Logger().Error("loadPageContentForPostList: error serializing page content", mlog.String("page_id", post.Id), mlog.Err(jsonErr))
				return model.NewAppError("loadPageContentForPostList", "app.page.get.serialize_content.app_error", nil, jsonErr.Error(), http.StatusInternalServerError)
			}
			post.Message = contentJSON
		}
	}

	return nil
}

// UpdatePage updates a page's title and/or content
func (a *App) UpdatePage(rctx request.CTX, pageID, title, content, searchText string) (*model.Post, *model.AppError) {
	post, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return nil, model.NewAppError("UpdatePage", "app.page.update.not_found.app_error", nil, "page not found", http.StatusNotFound).Wrap(err)
	}

	if post.Type != model.PostTypePage {
		return nil, model.NewAppError("UpdatePage", "app.page.update.not_a_page.app_error", nil, "post is not a page", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationEdit, "UpdatePage"); err != nil {
		return nil, err
	}

	if title != "" && len(title) > model.MaxPageTitleLength {
		return nil, model.NewAppError("UpdatePage", "app.page.update.title_too_long.app_error", nil, fmt.Sprintf("title must be %d characters or less", model.MaxPageTitleLength), http.StatusBadRequest)
	}

	updatedPost, storeErr := a.Srv().Store().Page().UpdatePageWithContent(rctx, pageID, title, content, searchText)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(storeErr, &nfErr) {
			return nil, model.NewAppError("UpdatePage", "app.page.update.not_found.app_error", nil, "page not found", http.StatusNotFound).Wrap(storeErr)
		}
		if strings.Contains(storeErr.Error(), "invalid_content") {
			return nil, model.NewAppError("UpdatePage", "app.page.update.invalid_content.app_error", nil, storeErr.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("UpdatePage", "app.page.update.store_error.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	if content != "" {
		a.handlePageMentions(rctx, updatedPost, updatedPost.ChannelId, content, session.UserId)
	}

	rctx.Logger().Info("Page updated successfully",
		mlog.String("page_id", pageID),
		mlog.Bool("title_updated", title != ""),
		mlog.Bool("content_updated", content != ""))

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId)

	if enrichErr := a.EnrichPageWithProperties(rctx, updatedPost); enrichErr != nil {
		return nil, enrichErr
	}

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
// baseUpdateAt is the UpdateAt timestamp the client last saw when they started editing
// Returns 409 Conflict if the page was modified by someone else
// Returns 404 Not Found if the page was deleted
func (a *App) UpdatePageWithOptimisticLocking(rctx request.CTX, pageID, title, content, searchText string, baseUpdateAt int64, force bool) (*model.Post, *model.AppError) {
	post, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_found.app_error", nil, "page not found", http.StatusNotFound).Wrap(err)
	}

	if post.Type != model.PostTypePage {
		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_a_page.app_error", nil, "post is not a page", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationEdit, "UpdatePageWithOptimisticLocking"); err != nil {
		return nil, err
	}

	if title != "" && len(title) > model.MaxPageTitleLength {
		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.title_too_long.app_error", nil, fmt.Sprintf("title must be %d characters or less", model.MaxPageTitleLength), http.StatusBadRequest)
	}

	// Check for conflicts (business logic - following MM pattern)
	if !force && baseUpdateAt != 0 && post.UpdateAt != baseUpdateAt {
		modifiedBy := post.UserId
		if lastModifiedBy, ok := post.Props["last_modified_by"].(string); ok && lastModifiedBy != "" {
			modifiedBy = lastModifiedBy
		}
		modifiedAt := post.UpdateAt

		rctx.Logger().Info("Page update conflict detected",
			mlog.String("page_id", pageID),
			mlog.String("modified_by", modifiedBy),
			mlog.Int("modified_at", modifiedAt),
			mlog.Int("base_update_at", baseUpdateAt))

		appErr := model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.conflict.app_error",
			nil, "page was modified by another user", http.StatusConflict)
		appErr.DetailedError = fmt.Sprintf("modified_by=%s,modified_at=%d", modifiedBy, modifiedAt)
		return nil, appErr
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
			return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.not_found.app_error",
				nil, "page not found or was deleted", http.StatusNotFound)
		}

		return nil, model.NewAppError("UpdatePageWithOptimisticLocking", "app.page.update.store_error.app_error",
			nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	if content != "" {
		a.handlePageMentions(rctx, updatedPost, updatedPost.ChannelId, content, session.UserId)
	}

	rctx.Logger().Info("Page updated successfully with optimistic locking",
		mlog.String("page_id", pageID),
		mlog.Bool("title_updated", title != ""),
		mlog.Bool("content_updated", content != ""),
		mlog.Int("base_update_at", baseUpdateAt))

	a.handlePageUpdateNotification(rctx, updatedPost, session.UserId)

	if enrichErr := a.EnrichPageWithProperties(rctx, updatedPost); enrichErr != nil {
		return nil, enrichErr
	}

	return updatedPost, nil
}

// DeletePage deletes a page. If wikiId is provided, it will be included in the broadcast event.
func (a *App) DeletePage(rctx request.CTX, pageID string, wikiId ...string) *model.AppError {
	post, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return model.NewAppError("DeletePage", "app.page.delete.not_found.app_error", nil, "page not found", http.StatusNotFound).Wrap(err)
	}

	if post.Type != model.PostTypePage {
		return model.NewAppError("DeletePage", "app.page.delete.not_a_page.app_error", nil, "post is not a page", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationDelete, "DeletePage"); err != nil {
		return err
	}

	rctx.Logger().Info("Deleting page", mlog.String("page_id", pageID))

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

	if post.Type != model.PostTypePage {
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
		rctx.Logger().Warn("PageContent not found during restore", mlog.String("page_id", pageID))
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
		rctx.Logger().Warn("Failed to enrich restored page",
			mlog.String("page_id", pageID),
			mlog.Err(enrichErr))
	}

	wikiId, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr != nil {
		rctx.Logger().Warn("Could not get wiki ID for restored page, broadcasting with empty wiki ID",
			mlog.String("page_id", pageID),
			mlog.Err(wikiErr))
		wikiId = ""
	}

	a.BroadcastPagePublished(restoredPost, wikiId, restoredPost.ChannelId, "", session.UserId)

	rctx.Logger().Info("Restored page", mlog.String("page_id", pageID))
	return nil
}

func (a *App) PermanentDeletePage(rctx request.CTX, pageID string) *model.AppError {
	post, err := a.GetSinglePost(rctx, pageID, true)
	if err != nil {
		return model.NewAppError("PermanentDeletePage",
			"app.page.permanent_delete.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if post.Type != model.PostTypePage {
		return model.NewAppError("PermanentDeletePage",
			"app.page.permanent_delete.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationDelete, "PermanentDeletePage"); err != nil {
		return err
	}

	rctx.Logger().Info("Permanently deleting page", mlog.String("page_id", pageID))

	if err := a.Srv().Store().Page().PermanentDeletePageContent(pageID); err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			rctx.Logger().Warn("Failed to permanently delete PageContent",
				mlog.String("page_id", pageID), mlog.Err(err))
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
	rctx.Logger().Info("Fetching active editors for page", mlog.String("page_id", pageId))

	fiveMinutesAgo := model.GetMillis() - (5 * 60 * 1000)
	rctx.Logger().Info("Active editors query params",
		mlog.String("page_id", pageId),
		mlog.Int("five_minutes_ago", fiveMinutesAgo),
		mlog.Int("current_time", model.GetMillis()))

	drafts, err := a.Srv().Store().Draft().GetActiveEditorsForPage(pageId, fiveMinutesAgo)
	if err != nil {
		rctx.Logger().Error("Failed to get active editors", mlog.Err(err))
		return nil, model.NewAppError("App.GetPageActiveEditors", "app.page.get_active_editors.get_drafts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("Retrieved drafts from database",
		mlog.Int("draft_count", len(drafts)),
		mlog.String("page_id", pageId),
		mlog.Int("min_update_at", int(fiveMinutesAgo)))

	userIds := []string{}
	lastActivities := make(map[string]int64)

	for _, draft := range drafts {
		rctx.Logger().Debug("Processing draft",
			mlog.String("user_id", draft.UserId),
			mlog.String("draft_id", draft.DraftId),
			mlog.Int("update_at", draft.UpdateAt))
		userIds = append(userIds, draft.UserId)
		lastActivities[draft.UserId] = draft.UpdateAt
	}

	rctx.Logger().Debug("Found active editors", mlog.Int("count", len(userIds)), mlog.String("page_id", pageId))

	return &PageActiveEditors{
		UserIds:        userIds,
		LastActivities: lastActivities,
	}, nil
}

func (a *App) GetPageVersionHistory(rctx request.CTX, pageId string) ([]*model.Post, *model.AppError) {
	rctx.Logger().Debug("Fetching version history for page", mlog.String("page_id", pageId))

	posts, err := a.Srv().Store().Page().GetPageVersionHistory(pageId)
	if err != nil {
		return nil, model.NewAppError("App.GetPageVersionHistory", "app.page.get_version_history.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("Found page version history", mlog.Int("count", len(posts)), mlog.String("page_id", pageId))

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
		if errors.As(storeErr, &notFoundErr) {
			rctx.Logger().Warn("No historical page content found - will restore metadata only",
				mlog.String("page_id", pageID),
				mlog.String("restore_version_id", restoreVersionID))
		} else {
			return nil, model.NewAppError("RestorePageVersion",
				"app.page.restore.get_content.app_error", nil, "",
				http.StatusInternalServerError).Wrap(storeErr)
		}
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

	// Step 5: Reload the complete page with content to get fresh data for WebSocket
	freshPage, getErr := a.GetPage(rctx, pageID)
	if getErr != nil {
		rctx.Logger().Warn("Failed to reload page after restore - WebSocket event will use potentially stale data",
			mlog.String("page_id", pageID),
			mlog.Err(getErr))
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

	rctx.Logger().Debug("Publishing POST_EDITED event for page",
		mlog.String("page_id", page.Id),
		mlog.String("channel_id", page.ChannelId))

	a.Publish(message)
}

// isValidTipTapJSON checks if the given content is valid TipTap JSON format
func isValidTipTapJSON(content string) bool {
	// Quick check: TipTap JSON always starts with {"type":"doc"
	if !strings.HasPrefix(strings.TrimSpace(content), "{") {
		return false
	}

	// Parse as JSON to verify structure
	var doc map[string]any
	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		return false
	}

	// TipTap documents must have type:"doc"
	docType, ok := doc["type"].(string)
	return ok && docType == "doc"
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
		"type":    "doc",
		"content": contentNodes,
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(doc)
	if err != nil {
		// Fallback: return empty document
		return `{"type":"doc","content":[]}`
	}

	return string(jsonBytes)
}
