// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

	createdPage, createErr := a.CreatePost(rctx, page, channel, model.CreatePostFlags{})
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page Post created successfully, proceeding to create PageContent",
		mlog.String("page_id", createdPage.Id),
		mlog.String("channel_id", channelID))

	pageContent := &model.PageContent{
		PageId: createdPage.Id,
	}
	if err := pageContent.SetDocumentJSON(content); err != nil {
		rctx.Logger().Warn("PageContent validation failed after Post creation - attempting cleanup to prevent orphaned Post",
			mlog.String("page_id", createdPage.Id),
			mlog.Err(err))
		if _, delErr := a.DeletePost(rctx, createdPage.Id, userID); delErr != nil {
			rctx.Logger().Error("ORPHAN PREVENTION FAILED: Could not delete Post after PageContent validation failed - orphaned Post may exist",
				mlog.String("page_id", createdPage.Id),
				mlog.Err(delErr))
		} else {
			rctx.Logger().Debug("Successfully cleaned up Post after PageContent validation failed",
				mlog.String("page_id", createdPage.Id))
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if searchText != "" {
		pageContent.SearchText = searchText
	}

	_, contentErr := a.Srv().Store().PageContent().Save(pageContent)
	if contentErr != nil {
		rctx.Logger().Warn("PageContent save failed after Post creation - attempting cleanup to prevent orphaned Post",
			mlog.String("page_id", createdPage.Id),
			mlog.Err(contentErr))
		if _, delErr := a.DeletePost(rctx, createdPage.Id, userID); delErr != nil {
			rctx.Logger().Error("ORPHAN PREVENTION FAILED: Could not delete Post after PageContent save failed - orphaned Post may exist",
				mlog.String("page_id", createdPage.Id),
				mlog.Err(delErr))
		} else {
			rctx.Logger().Debug("Successfully cleaned up Post after PageContent save failed",
				mlog.String("page_id", createdPage.Id))
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.save_content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	rctx.Logger().Info("Page created successfully",
		mlog.String("page_id", createdPage.Id),
		mlog.String("channel_id", channelID),
		mlog.String("parent_id", pageParentID))

	if enrichErr := a.EnrichPageWithProperties(rctx, createdPage); enrichErr != nil {
		return nil, enrichErr
	}

	a.handlePageMentions(rctx, createdPage, channelID, content, userID)

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

	rctx.Logger().Debug("GetPage: post retrieved", mlog.String("page_id", pageID), mlog.String("type", post.Type))

	if post.Type != model.PostTypePage {
		rctx.Logger().Error("GetPage: not a page", mlog.String("page_id", pageID), mlog.String("type", post.Type))
		return nil, model.NewAppError("GetPage", "app.page.get.not_a_page.app_error", nil, "post is not a page", http.StatusBadRequest)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationRead, "GetPage"); err != nil {
		rctx.Logger().Error("GetPage: permission denied", mlog.String("page_id", pageID))
		return nil, err
	}

	rctx.Logger().Debug("GetPage: fetching content", mlog.String("page_id", pageID))
	pageContent, contentErr := a.Srv().Store().PageContent().Get(pageID)
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

	pageContents, contentErr := a.Srv().Store().PageContent().GetMany(pageIDs)
	if contentErr != nil {
		rctx.Logger().Error("LoadPageContentForPostList: error fetching PageContents", mlog.Int("count", len(pageIDs)), mlog.Err(contentErr))
		return model.NewAppError("LoadPageContentForPostList", "app.page.get.content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	contentMap := make(map[string]*model.PageContent, len(pageContents))
	for _, content := range pageContents {
		contentMap[content.PageId] = content
	}

	for _, post := range postList.Posts {
		if post.Type == model.PostTypePage {
			pageContent, found := contentMap[post.Id]
			if !found {
				rctx.Logger().Warn("LoadPageContentForPostList: PageContent not found for page", mlog.String("page_id", post.Id))
				post.Message = ""
				continue
			}

			contentJSON, jsonErr := pageContent.GetDocumentJSON()
			if jsonErr != nil {
				rctx.Logger().Error("LoadPageContentForPostList: error serializing page content", mlog.String("page_id", post.Id), mlog.Err(jsonErr))
				return model.NewAppError("LoadPageContentForPostList", "app.page.get.serialize_content.app_error", nil, jsonErr.Error(), http.StatusInternalServerError)
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

	return updatedPost, nil
}

// DeletePage deletes a page
func (a *App) DeletePage(rctx request.CTX, pageID string) *model.AppError {
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

	if contentErr := a.Srv().Store().PageContent().Delete(pageID); contentErr != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(contentErr, &nfErr) {
			rctx.Logger().Warn("Failed to delete PageContent during page deletion - orphaned content may remain",
				mlog.String("page_id", pageID),
				mlog.Err(contentErr))
		}
	} else {
		rctx.Logger().Debug("Successfully deleted PageContent before Post soft-delete",
			mlog.String("page_id", pageID))
	}

	_, deleteErr := a.DeletePost(rctx, pageID, rctx.Session().UserId)
	return deleteErr
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

	if err := a.Srv().Store().PageContent().Restore(pageID); err != nil {
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

	if err := a.Srv().Store().PageContent().PermanentDelete(pageID); err != nil {
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

	drafts, err := a.Srv().Store().PageDraftContent().GetActiveEditorsForPage(pageId, fiveMinutesAgo)
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

	return posts, nil
}
