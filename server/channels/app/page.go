// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var pageHierarchyLock sync.Mutex

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
	if ops, ok := permMap[channelType]; ok {
		return ops[operation]
	}
	return nil
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

	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		permission := getPagePermission(channel.Type, operation)
		if permission == nil {
			return model.NewAppError(operationName, "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
		}
		if !a.SessionHasPermissionToChannel(rctx, *session, channel.Id, permission) {
			return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
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
		if newPageDepth >= model.PostPageMaxDepth {
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
		return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, err.Error(), http.StatusBadRequest)
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

	// Enrich page with property values (status, etc.)
	if enrichErr := a.EnrichPageWithProperties(rctx, createdPage); enrichErr != nil {
		return nil, enrichErr
	}

	// Handle mentions in the page content
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
			return nil, model.NewAppError("GetPage", "app.page.get.serialize_content.app_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		}
		rctx.Logger().Debug("GetPage: content retrieved", mlog.String("page_id", pageID), mlog.Int("content_length", len(contentJSON)))
		post.Message = contentJSON
	}

	// Enrich page with property values (status, etc.)
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

// GetPageChildren fetches direct children of a page
func (a *App) GetPageChildren(rctx request.CTX, postID string, options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	parentPost, appErr := a.GetSinglePost(rctx, postID, false)
	if appErr != nil {
		return nil, model.NewAppError("GetPageChildren", "app.post.get_page_children.parent.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	}

	if !a.HasPermissionToChannel(rctx, rctx.Session().UserId, parentPost.ChannelId, model.PermissionReadChannel) {
		return nil, model.NewAppError("GetPageChildren", "api.post.get_page_children.permissions.app_error", nil, "", http.StatusForbidden)
	}

	postList, err := a.Srv().Store().Page().GetPageChildren(postID, options)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPageChildren", "app.post.get_page_children.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageChildren", "app.post.get_page_children.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Enrich pages with property values (status, etc.)
	if enrichErr := a.EnrichPagesWithProperties(rctx, postList); enrichErr != nil {
		return nil, enrichErr
	}

	a.applyPostsWillBeConsumedHook(postList.Posts)

	return postList, nil
}

// GetPageAncestors fetches all ancestors of a page up to the root
func (a *App) GetPageAncestors(rctx request.CTX, postID string) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Page().GetPageAncestors(postID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetPageAncestors", "app.post.get_page_ancestors.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageAncestors", "app.post.get_page_ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Enrich pages with property values (status, etc.)
	if enrichErr := a.EnrichPagesWithProperties(rctx, postList); enrichErr != nil {
		return nil, enrichErr
	}

	a.applyPostsWillBeConsumedHook(postList.Posts)

	return postList, nil
}

// GetPageDescendants fetches all descendants of a page (entire subtree)
func (a *App) GetPageDescendants(rctx request.CTX, postID string) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Page().GetPageDescendants(postID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetPageDescendants", "app.post.get_page_descendants.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageDescendants", "app.post.get_page_descendants.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Enrich pages with property values (status, etc.)
	if enrichErr := a.EnrichPagesWithProperties(rctx, postList); enrichErr != nil {
		return nil, enrichErr
	}

	a.applyPostsWillBeConsumedHook(postList.Posts)

	return postList, nil
}

// GetChannelPages fetches all pages in a channel
func (a *App) GetChannelPages(rctx request.CTX, channelID string) (*model.PostList, *model.AppError) {
	if !a.HasPermissionToChannel(rctx, rctx.Session().UserId, channelID, model.PermissionReadChannel) {
		return nil, model.MakePermissionError(rctx.Session(), []*model.Permission{model.PermissionReadChannel})
	}

	postList, err := a.Srv().Store().Page().GetChannelPages(channelID)
	if err != nil {
		return nil, model.NewAppError("GetChannelPages", "app.post.get_channel_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Enrich pages with property values (status, etc.)
	if enrichErr := a.EnrichPagesWithProperties(rctx, postList); enrichErr != nil {
		return nil, enrichErr
	}

	a.applyPostsWillBeConsumedHook(postList.Posts)

	return postList, nil
}

// ChangePageParent updates the parent of a page
func (a *App) ChangePageParent(rctx request.CTX, postID string, newParentID string) *model.AppError {
	post, err := a.GetSinglePost(rctx, postID, false)
	if err != nil || post.Type != model.PostTypePage {
		return model.NewAppError("ChangePageParent", "app.page.change_parent.not_found.app_error", nil, "page not found", http.StatusNotFound)
	}

	session := rctx.Session()
	if err := a.HasPermissionToModifyPage(rctx, session, post, PageOperationEdit, "ChangePageParent"); err != nil {
		return err
	}

	// Acquire lock for page hierarchy to prevent race conditions
	// This ensures that concurrent parent changes cannot create circular references
	pageHierarchyLock.Lock()
	defer pageHierarchyLock.Unlock()

	if newParentID != "" {
		if newParentID == postID {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.circular_reference.app_error", nil, "cannot set page as its own parent", http.StatusBadRequest)
		}

		parentPost, parentErr := a.GetSinglePost(rctx, newParentID, false)
		if parentErr != nil {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.invalid_parent.app_error", nil, "parent page not found", http.StatusBadRequest).Wrap(parentErr)
		}
		if parentPost.Type != model.PostTypePage || parentPost.ChannelId != post.ChannelId {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.invalid_parent.app_error", nil, "parent must be a page in the same channel", http.StatusBadRequest)
		}

		ancestors, ancestorErr := a.Srv().Store().Page().GetPageAncestors(newParentID)
		if ancestorErr != nil {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.get_ancestors.app_error", nil, "failed to validate page hierarchy", http.StatusInternalServerError).Wrap(ancestorErr)
		}

		for _, ancestor := range ancestors.Posts {
			if ancestor.Id == postID {
				return model.NewAppError("ChangePageParent", "app.page.change_parent.circular_reference.app_error", nil, "cannot move page to its own descendant", http.StatusBadRequest)
			}
		}

		parentDepth, depthErr := a.calculatePageDepth(rctx, newParentID)
		if depthErr != nil {
			return depthErr
		}
		newPageDepth := parentDepth + 1
		if newPageDepth >= model.PostPageMaxDepth {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth},
				"page hierarchy cannot exceed maximum depth", http.StatusBadRequest)
		}
	}

	if storeErr := a.Srv().Store().Page().ChangePageParent(postID, newParentID); storeErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(storeErr, &nfErr):
			return model.NewAppError("ChangePageParent", "app.post.change_page_parent.not_found", nil, "", http.StatusNotFound).Wrap(storeErr)
		default:
			return model.NewAppError("ChangePageParent", "app.post.change_page_parent.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	a.invalidateCacheForChannelPosts(post.ChannelId)

	rctx.Logger().Info("Page parent changed",
		mlog.String("page_id", postID),
		mlog.String("new_parent_id", newParentID))

	return nil
}

// calculatePageDepth calculates the depth of a page in the hierarchy
// Returns the depth (0 for root pages) and any error encountered
func (a *App) calculatePageDepth(rctx request.CTX, pageID string) (int, *model.AppError) {
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.not_found", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if page.PageParentId == "" {
		return 0, nil
	}

	ancestors, ancestorErr := a.Srv().Store().Page().GetPageAncestors(pageID)
	if ancestorErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(ancestorErr, &nfErr) {
			return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.get_ancestors_error", nil, "", http.StatusBadRequest).Wrap(ancestorErr)
		}
		return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.get_ancestors_error", nil, "", http.StatusInternalServerError).Wrap(ancestorErr)
	}

	depth := len(ancestors.Posts)
	return depth, nil
}

// BuildBreadcrumbPath builds the breadcrumb navigation path for a page
func (a *App) BuildBreadcrumbPath(rctx request.CTX, page *model.Post) (*model.BreadcrumbPath, *model.AppError) {
	var breadcrumbItems []*model.BreadcrumbItem

	// Get page ancestors (walk up hierarchy)
	ancestors, err := a.GetPageAncestors(rctx, page.Id)
	if err != nil {
		return nil, err
	}

	// Get channel to get the team
	channel, err := a.GetChannel(rctx, page.ChannelId)
	if err != nil {
		return nil, err
	}

	// Get team name for URL construction
	team, err := a.GetTeam(channel.TeamId)
	if err != nil {
		return nil, err
	}

	// Get wiki to use its title as root
	wikiId, err := a.GetWikiIdForPage(rctx, page.Id)
	if err != nil {
		return nil, err
	}

	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, err
	}

	// Add wiki root (use wiki title instead of generic "Pages")
	wikiRoot := &model.BreadcrumbItem{
		Id:        wikiId,
		Title:     wiki.Title,
		Type:      "wiki",
		Path:      "/" + team.Name + "/channels/" + page.ChannelId + "?wikiId=" + wikiId,
		ChannelId: page.ChannelId,
	}
	breadcrumbItems = append(breadcrumbItems, wikiRoot)

	// Add ancestors (parents in hierarchy) - ancestors.Order has correct order
	if ancestors != nil && len(ancestors.Order) > 0 {
		for _, ancestorId := range ancestors.Order {
			if ancestor, ok := ancestors.Posts[ancestorId]; ok {
				item := &model.BreadcrumbItem{
					Id:        ancestor.Id,
					Title:     a.getPageTitle(ancestor),
					Type:      "page",
					Path:      "/" + team.Name + "/channels/" + page.ChannelId + "/" + ancestor.Id + "?wikiId=" + wikiId,
					ChannelId: ancestor.ChannelId,
				}
				breadcrumbItems = append(breadcrumbItems, item)
			}
		}
	}

	// Current page
	currentPage := &model.BreadcrumbItem{
		Id:        page.Id,
		Title:     a.getPageTitle(page),
		Type:      "page",
		Path:      "/" + team.Name + "/channels/" + page.ChannelId + "/" + page.Id + "?wikiId=" + wikiId,
		ChannelId: page.ChannelId,
	}

	return &model.BreadcrumbPath{
		Items:       breadcrumbItems,
		CurrentPage: currentPage,
	}, nil
}

// getPageTitle extracts the title from a page (pages must have titles)
func (a *App) getPageTitle(page *model.Post) string {
	if title, ok := page.GetProps()["title"].(string); ok && title != "" {
		return title
	}
	return "Untitled page"
}

// ExtractMentionsFromTipTapContent parses TipTap JSON and extracts user IDs from mention nodes.
// TipTap stores mentions as nodes with type="mention" and attrs.id containing the user ID.
// This is simpler than markdown parsing since IDs are explicit in the structure.
func (a *App) ExtractMentionsFromTipTapContent(content string) ([]string, error) {
	mlog.Trace("extractMentions.parsing", mlog.Int("content_length", len(content)))

	var doc struct {
		Type    string            `json:"type"`
		Content []json.RawMessage `json:"content"`
	}

	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		mlog.Debug("extractMentions.parse_error", mlog.Err(err))
		return nil, err
	}

	mlog.Trace("extractMentions.parsed", mlog.String("doc_type", doc.Type), mlog.Int("content_nodes", len(doc.Content)))

	mentionIDs := make(map[string]bool)
	a.extractMentionsFromNodes(doc.Content, mentionIDs)

	result := make([]string, 0, len(mentionIDs))
	for id := range mentionIDs {
		result = append(result, id)
	}

	mlog.Debug("extractMentions.complete", mlog.Int("mention_count", len(result)))
	return result, nil
}

// extractMentionsFromNodes recursively walks TipTap JSON nodes to find mentions
func (a *App) extractMentionsFromNodes(nodes []json.RawMessage, mentionIDs map[string]bool) {
	for _, nodeRaw := range nodes {
		var node struct {
			Type  string `json:"type"`
			Attrs *struct {
				ID string `json:"id"`
			} `json:"attrs,omitempty"`
			Content []json.RawMessage `json:"content,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			mlog.Trace("extractMentions.node_parse_error", mlog.Err(err))
			continue
		}

		mlog.Trace("extractMentions.processing_node", mlog.String("node_type", node.Type))

		if node.Type == "mention" && node.Attrs != nil && node.Attrs.ID != "" {
			mlog.Trace("extractMentions.found_mention", mlog.String("user_id", node.Attrs.ID))
			mentionIDs[node.Attrs.ID] = true
		}

		if len(node.Content) > 0 {
			a.extractMentionsFromNodes(node.Content, mentionIDs)
		}
	}
}

func (a *App) validatePageDraftForPublish(rctx request.CTX, userId, wikiId, draftId, parentId, message string) (*model.PageDraft, *model.Wiki, *model.Channel, *model.AppError) {
	draft, err := a.Srv().Store().PageDraft().Get(userId, wikiId, draftId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, nil, nil, model.NewAppError("validatePageDraftForPublish", "app.draft.publish_page.not_found",
				nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, nil, nil, model.NewAppError("validatePageDraftForPublish", "app.draft.publish_page.get_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Use provided message if available (from editor), otherwise use draft content from DB
	contentToValidate := message
	if contentToValidate == "" {
		var contentErr error
		contentToValidate, contentErr = draft.GetDocumentJSON()
		if contentErr != nil {
			return nil, nil, nil, model.NewAppError("validatePageDraftForPublish", "app.draft.publish_page.content_error",
				nil, "", http.StatusInternalServerError).Wrap(contentErr)
		}
	}

	rctx.Logger().Debug("Draft content before validation",
		mlog.String("provided_message", message),
		mlog.Int("provided_length", len(message)),
		mlog.Int("db_content_length", len(contentToValidate)),
		mlog.Int("trimmed_length", len(strings.TrimSpace(contentToValidate))),
		mlog.Int("file_ids_count", len(draft.FileIds)),
		mlog.Any("props", draft.Props))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, nil, nil, wikiErr
	}

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, nil, nil, chanErr
	}

	session := rctx.Session()
	if permErr := a.HasPermissionToModifyWiki(rctx, session, channel, WikiOperationEdit, "validatePageDraftForPublish"); permErr != nil {
		return nil, nil, nil, permErr
	}

	if parentId != "" {
		parentPage, parentErr := a.GetSinglePost(rctx, parentId, false)
		if parentErr != nil {
			return nil, nil, nil, model.NewAppError("validatePageDraftForPublish", "api.page.publish.parent_not_found.app_error", nil, "", http.StatusNotFound).Wrap(parentErr)
		}

		if parentPage.Type != model.PostTypePage {
			return nil, nil, nil, model.NewAppError("validatePageDraftForPublish", "api.page.publish.parent_not_page.app_error", nil, "", http.StatusBadRequest)
		}

		if parentPage.ChannelId != wiki.ChannelId {
			return nil, nil, nil, model.NewAppError("validatePageDraftForPublish", "api.page.publish.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return draft, wiki, channel, nil
}

func (a *App) applyDraftToPage(rctx request.CTX, draft *model.PageDraft, wikiId, parentId, title, searchText, message, userId string) (*model.Post, *model.AppError) {
	pageId, isUpdate := draft.GetProps()["page_id"].(string)

	// Use provided message if available (latest from editor), otherwise get from draft
	contentToUse := message
	if contentToUse == "" {
		var contentErr error
		contentToUse, contentErr = draft.GetDocumentJSON()
		if contentErr != nil {
			return nil, model.NewAppError("applyDraftToPage", "app.draft.publish_page.content_error",
				nil, "", http.StatusInternalServerError).Wrap(contentErr)
		}
	}

	if isUpdate && pageId != "" {
		rctx.Logger().Debug("Updating existing page from draft",
			mlog.String("page_id", pageId),
			mlog.String("wiki_id", wikiId))

		existingPost, getErr := a.GetSinglePost(rctx, pageId, false)
		if getErr != nil {
			return nil, model.NewAppError("applyDraftToPage", "app.draft.publish_page.get_existing_error",
				nil, "", http.StatusInternalServerError).Wrap(getErr)
		}

		if parentId != "" {
			ancestors, ancestorsErr := a.GetPageAncestors(rctx, parentId)
			if ancestorsErr != nil {
				return nil, ancestorsErr
			}

			if _, exists := ancestors.Posts[pageId]; exists {
				return nil, model.NewAppError("applyDraftToPage", "api.page.publish.circular_reference.app_error",
					nil, "pageId="+pageId+", parentId="+parentId, http.StatusBadRequest)
			}
		}

		updatedPost, updateErr := a.UpdatePage(rctx, pageId, title, contentToUse, searchText)
		if updateErr != nil {
			return nil, updateErr
		}

		if parentId != existingPost.PageParentId {
			if changeParentErr := a.ChangePageParent(rctx, pageId, parentId); changeParentErr != nil {
				return nil, changeParentErr
			}
			updatedPost, updateErr = a.GetSinglePost(rctx, pageId, false)
			if updateErr != nil {
				return nil, updateErr
			}
		}

		rctx.Logger().Info("Page updated from draft",
			mlog.String("page_id", updatedPost.Id),
			mlog.String("wiki_id", wikiId),
			mlog.String("parent_id", parentId))

		// Apply page status from draft props if present
		if statusValue, hasStatus := draft.GetProps()["page_status"].(string); hasStatus && statusValue != "" {
			if statusErr := a.SetPageStatus(rctx, updatedPost.Id, statusValue); statusErr != nil {
				rctx.Logger().Error("Failed to set page status from draft props",
					mlog.String("page_id", updatedPost.Id),
					mlog.String("status", statusValue),
					mlog.Err(statusErr))
			}
		}

		return updatedPost, nil
	}

	rctx.Logger().Debug("Creating new page from draft",
		mlog.String("wiki_id", wikiId))

	createdPost, createErr := a.CreateWikiPage(rctx, wikiId, parentId, title, contentToUse, userId, searchText)
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Info("Page created from draft",
		mlog.String("page_id", createdPost.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId))

	// Apply page status from draft props if present
	if statusValue, hasStatus := draft.GetProps()["page_status"].(string); hasStatus && statusValue != "" {
		if statusErr := a.SetPageStatus(rctx, createdPost.Id, statusValue); statusErr != nil {
			rctx.Logger().Warn("Failed to set page status from draft props",
				mlog.String("page_id", createdPost.Id),
				mlog.String("status", statusValue),
				mlog.Err(statusErr))
		}
	}

	return createdPost, nil
}

func (a *App) broadcastPagePublished(page *model.Post, wikiId, channelId, draftId, userId string) {
	mlog.Info("Broadcasting page published event",
		mlog.String("page_id", page.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("channel_id", channelId),
		mlog.String("draft_id", draftId),
		mlog.String("user_id", userId))

	pageJSON, jsonErr := page.ToJSON()
	if jsonErr != nil {
		mlog.Warn("Failed to encode page to JSON", mlog.Err(jsonErr))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPagePublished, "", channelId, "", nil, "")
	message.Add("page_id", page.Id)
	message.Add("wiki_id", wikiId)
	message.Add("draft_id", draftId)
	message.Add("user_id", userId)
	message.Add("page", pageJSON)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId: channelId,
	})

	mlog.Info("Publishing message to websocket", mlog.String("event_type", string(model.WebsocketEventPagePublished)))
	a.Publish(message)
	mlog.Info("Message published to websocket")
}

// PublishPageDraft publishes a draft as a page
func (a *App) PublishPageDraft(rctx request.CTX, userId, wikiId, draftId, parentId, title, searchText, message, pageStatus string) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Publishing page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId),
		mlog.Int("message_length", len(message)))

	draft, wiki, _, err := a.validatePageDraftForPublish(rctx, userId, wikiId, draftId, parentId, message)
	if err != nil {
		return nil, err
	}

	// If page_status is provided, merge it into draft.Props to ensure it's applied
	if pageStatus != "" {
		props := draft.GetProps()
		if props == nil {
			props = make(map[string]any)
		}
		props["page_status"] = pageStatus
		draft.SetProps(props)
	}

	savedPost, err := a.applyDraftToPage(rctx, draft, wikiId, parentId, title, searchText, message, userId)
	if err != nil {
		return nil, err
	}

	if deleteErr := a.Srv().Store().PageDraft().Delete(userId, wikiId, draftId); deleteErr != nil {
		rctx.Logger().Warn("Failed to delete draft after successful publish - orphaned draft will remain",
			mlog.String("user_id", userId),
			mlog.String("wiki_id", wikiId),
			mlog.String("draft_id", draftId),
			mlog.String("page_id", savedPost.Id),
			mlog.Err(deleteErr))
	} else {
		rctx.Logger().Info("Draft deleted successfully, now updating child draft references",
			mlog.String("deleted_draft_id", draftId),
			mlog.String("published_page_id", savedPost.Id))
	}

	if updateErr := a.updateChildDraftParentReferences(rctx, userId, wikiId, draftId, savedPost.Id); updateErr != nil {
		rctx.Logger().Error("Failed to update child draft parent references after publish",
			mlog.String("wiki_id", wikiId),
			mlog.String("published_draft_id", draftId),
			mlog.String("new_page_id", savedPost.Id),
			mlog.Err(updateErr))
	}

	// Fetch the published page with content from PageContents table
	pageWithContent, getErr := a.GetPage(rctx, savedPost.Id)
	if getErr != nil {
		rctx.Logger().Warn("Failed to fetch published page with content", mlog.String("page_id", savedPost.Id), mlog.Err(getErr))
		// Fallback to savedPost without content if GetPage fails
		a.broadcastPagePublished(savedPost, wikiId, wiki.ChannelId, draftId, userId)
		return savedPost, nil
	}

	a.broadcastPagePublished(pageWithContent, wikiId, wiki.ChannelId, draftId, userId)

	return pageWithContent, nil
}

func (a *App) updateChildDraftParentReferences(rctx request.CTX, userId, wikiId, oldDraftId, newPageId string) *model.AppError {
	rctx.Logger().Info("=== updateChildDraftParentReferences CALLED ===",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("old_draft_id", oldDraftId),
		mlog.String("new_page_id", newPageId))

	drafts, err := a.Srv().Store().PageDraft().GetForWiki(userId, wikiId)
	if err != nil {
		rctx.Logger().Error("Failed to get drafts for wiki", mlog.Err(err))
		return model.NewAppError("updateChildDraftParentReferences", "app.draft.get_drafts.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("Found drafts in wiki", mlog.Int("draft_count", len(drafts)))

	for _, childDraft := range drafts {
		draftId := childDraft.DraftId
		rctx.Logger().Info("Checking draft",
			mlog.String("draft_id", draftId),
			mlog.Any("props", childDraft.GetProps()))

		parentIdProp, hasParent := childDraft.GetProps()["page_parent_id"]
		if !hasParent {
			rctx.Logger().Info("Draft has NO page_parent_id prop", mlog.String("draft_id", draftId))
			continue
		}

		rctx.Logger().Info("Draft HAS page_parent_id prop",
			mlog.String("draft_id", draftId),
			mlog.Any("parent_id_prop", parentIdProp),
			mlog.String("parent_id_type", fmt.Sprintf("%T", parentIdProp)))

		parentId, ok := parentIdProp.(string)
		if !ok {
			rctx.Logger().Info("page_parent_id is NOT a string",
				mlog.String("draft_id", draftId),
				mlog.Any("parent_id_prop", parentIdProp))
			continue
		}

		rctx.Logger().Info("Comparing parent IDs",
			mlog.String("draft_id", draftId),
			mlog.String("draft_parent_id", parentId),
			mlog.String("looking_for_draft_id", oldDraftId),
			mlog.Bool("match", parentId == oldDraftId))

		if parentId != oldDraftId {
			continue
		}

		rctx.Logger().Info("=== FOUND CHILD DRAFT TO UPDATE ===",
			mlog.String("child_draft_id", draftId),
			mlog.String("old_parent_draft_id", oldDraftId),
			mlog.String("new_parent_page_id", newPageId))

		updatedProps := maps.Clone(childDraft.GetProps())
		updatedProps["page_parent_id"] = newPageId

		childDraftId := childDraft.DraftId
		pageId, _ := childDraft.GetProps()["page_id"].(string)

		rctx.Logger().Info("About to update draft",
			mlog.String("child_draft_id", childDraftId),
			mlog.String("title", childDraft.Title),
			mlog.String("page_id", pageId),
			mlog.Any("updated_props", updatedProps))

		updatedDraft := &model.PageDraft{
			UserId:   userId,
			WikiId:   wikiId,
			DraftId:  childDraftId,
			Title:    childDraft.Title,
			Content:  childDraft.Content,
			CreateAt: childDraft.CreateAt,
			UpdateAt: childDraft.UpdateAt,
		}
		updatedDraft.SetProps(updatedProps)

		updatedDraft, updateErr := a.Srv().Store().PageDraft().Upsert(updatedDraft)
		if updateErr != nil {
			rctx.Logger().Error("Failed to update child draft parent reference",
				mlog.String("child_draft_id", childDraftId),
				mlog.Err(updateErr))
		} else {
			rctx.Logger().Info("=== SUCCESSFULLY UPDATED CHILD DRAFT ===",
				mlog.String("child_draft_id", childDraftId),
				mlog.String("new_parent_id", newPageId))

			wiki, wikiErr := a.GetWiki(rctx, wikiId)
			if wikiErr == nil {
				message := model.NewWebSocketEvent(model.WebsocketEventDraftUpdated, "", wiki.ChannelId, userId, nil, "")
				draftJSON, jsonErr := json.Marshal(updatedDraft)
				if jsonErr != nil {
					rctx.Logger().Warn("Failed to encode updated draft to JSON", mlog.Err(jsonErr))
				} else {
					message.Add("draft", string(draftJSON))
					a.Publish(message)
					rctx.Logger().Info("Sent websocket event for updated child draft", mlog.String("child_draft_id", childDraftId))
				}
			}
		}
	}

	rctx.Logger().Info("=== updateChildDraftParentReferences COMPLETED ===")
	return nil
}

// handlePageMentions extracts mentions from page content and sends notifications
func (a *App) handlePageMentions(rctx request.CTX, page *model.Post, channelId, content, authorUserID string) {
	rctx.Logger().Debug("handlePageMentions called",
		mlog.String("page_id", page.Id),
		mlog.String("channel_id", channelId),
		mlog.Int("content_length", len(content)))

	if content == "" {
		rctx.Logger().Debug("handlePageMentions: empty content", mlog.String("page_id", page.Id))
		return
	}

	mentionedUserIDs, extractErr := a.ExtractMentionsFromTipTapContent(content)
	if extractErr != nil {
		rctx.Logger().Warn("Failed to extract mentions from page content", mlog.String("page_id", page.Id), mlog.Err(extractErr))
		return
	}

	rctx.Logger().Debug("handlePageMentions: extracted mentions",
		mlog.String("page_id", page.Id),
		mlog.Int("mention_count", len(mentionedUserIDs)))

	if len(mentionedUserIDs) == 0 {
		return
	}

	channel, chanErr := a.GetChannel(rctx, channelId)
	if chanErr != nil {
		rctx.Logger().Warn("Failed to get channel for mention notifications", mlog.String("channel_id", channelId), mlog.Err(chanErr))
		return
	}

	a.sendPageMentionNotifications(rctx, page, channel, authorUserID, mentionedUserIDs, content)
}

func (a *App) sendPageMentionNotifications(rctx request.CTX, page *model.Post, channel *model.Channel, authorUserID string, mentionedUserIDs []string, content string) {
	if len(mentionedUserIDs) == 0 {
		rctx.Logger().Debug("No mentions in page", mlog.String("page_id", page.Id))
		return
	}

	user, err := a.GetUser(authorUserID)
	if err != nil {
		rctx.Logger().Warn("Failed to get user for mention notifications",
			mlog.String("user_id", authorUserID),
			mlog.Err(err))
		return
	}

	team, err := a.GetTeam(channel.TeamId)
	if err != nil {
		rctx.Logger().Warn("Failed to get team for mention notifications",
			mlog.String("team_id", channel.TeamId),
			mlog.Err(err))
		return
	}

	if _, err := a.SendNotifications(rctx, page, team, channel, user, nil, true, mentionedUserIDs); err != nil {
		rctx.Logger().Warn("Failed to send mention notifications for page",
			mlog.String("page_id", page.Id),
			mlog.Err(err))
	} else {
		rctx.Logger().Debug("Successfully sent mention notifications for page",
			mlog.String("page_id", page.Id),
			mlog.Int("mention_count", len(mentionedUserIDs)))
	}

	rctx.Logger().Debug("Starting channel post creation for page mentions",
		mlog.String("page_id", page.Id),
		mlog.Int("mention_count", len(mentionedUserIDs)))

	// Get wiki to check if mentions should appear in channel feed
	wikiId, wikiErr := a.GetWikiIdForPage(rctx, page.Id)
	if wikiErr != nil {
		rctx.Logger().Warn("Failed to get wiki for page mention channel posts",
			mlog.String("page_id", page.Id),
			mlog.Err(wikiErr))
		return
	}

	rctx.Logger().Debug("Got wiki ID for page mention posts", mlog.String("wiki_id", wikiId))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		rctx.Logger().Warn("Failed to get wiki for page mention channel posts",
			mlog.String("wiki_id", wikiId),
			mlog.Err(wikiErr))
		return
	}

	rctx.Logger().Debug("Checking ShowMentionsInChannelFeed",
		mlog.String("wiki_id", wikiId),
		mlog.Bool("show_mentions", wiki.ShowMentionsInChannelFeed()))

	if !wiki.ShowMentionsInChannelFeed() {
		rctx.Logger().Debug("Wiki has channel feed mentions disabled",
			mlog.String("wiki_id", wikiId))
		return
	}

	rctx.Logger().Debug("Wiki has channel feed mentions enabled, proceeding with post creation",
		mlog.String("wiki_id", wikiId))

	pageTitle := page.GetProp("title")
	if pageTitle == "" {
		pageTitle = "Untitled"
	}

	rctx.Logger().Debug("Extracting mention context",
		mlog.String("page_id", page.Id),
		mlog.Int("content_length", len(content)))

	// Create a channel post for each mentioned user
	for _, mentionedUserID := range mentionedUserIDs {
		mentionedUser, mentionErr := a.GetUser(mentionedUserID)
		if mentionErr != nil {
			rctx.Logger().Warn("Failed to get mentioned user for channel post",
				mlog.String("user_id", mentionedUserID),
				mlog.Err(mentionErr))
			continue
		}

		// Extract the context (paragraph) containing this mention
		mentionContext := a.extractMentionContext(rctx, content, mentionedUserID)

		rctx.Logger().Debug("Extracted mention context",
			mlog.String("mentioned_user_id", mentionedUserID),
			mlog.String("context", mentionContext),
			mlog.Int("context_length", len(mentionContext)))

		// Build the post message header
		teamURL := fmt.Sprintf("/%s", team.Name)
		pageURL := fmt.Sprintf("%s/wiki/%s/%s/%s", teamURL, channel.Id, wikiId, page.Id)
		postMessage := fmt.Sprintf("Mentioned @%s on the page: [%s](%s)\n\n%s",
			mentionedUser.Username,
			pageTitle,
			pageURL,
			mentionContext)

		channelPost := &model.Post{
			UserId:    authorUserID,
			ChannelId: channel.Id,
			Message:   postMessage,
			Type:      model.PostTypePageMention,
			Props: model.StringInterface{
				"page_id":           page.Id,
				"wiki_id":           wikiId,
				"mentioned_user_id": mentionedUserID,
				"page_title":        pageTitle,
			},
		}

		flags := model.CreatePostFlags{
			TriggerWebhooks: false,
			SetOnline:       true,
		}
		if _, createErr := a.CreatePost(rctx, channelPost, channel, flags); createErr != nil {
			rctx.Logger().Warn("Failed to create page mention channel post",
				mlog.String("page_id", page.Id),
				mlog.String("mentioned_user_id", mentionedUserID),
				mlog.Err(createErr))
		}
	}
}

// extractMentionContext extracts the paragraph containing a mention from TipTap JSON content
func (a *App) extractMentionContext(rctx request.CTX, content string, mentionedUserID string) string {
	if content == "" {
		return ""
	}

	var doc struct {
		Content []json.RawMessage `json:"content"`
	}

	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		rctx.Logger().Warn("Failed to parse TipTap content for mention context",
			mlog.String("mentioned_user_id", mentionedUserID),
			mlog.Err(err))
		return ""
	}

	// Search through all nodes to find the paragraph containing this mention
	context := a.findMentionInNodes(rctx, doc.Content, mentionedUserID)
	if context != "" {
		return context
	}

	return ""
}

// findMentionInNodes recursively searches TipTap nodes for a paragraph containing the mention
func (a *App) findMentionInNodes(rctx request.CTX, nodes []json.RawMessage, mentionedUserID string) string {
	for _, nodeRaw := range nodes {
		var node struct {
			Type    string            `json:"type"`
			Content []json.RawMessage `json:"content,omitempty"`
			Attrs   map[string]any    `json:"attrs,omitempty"`
			Text    string            `json:"text,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			rctx.Logger().Debug("Failed to unmarshal TipTap node while searching for mention",
				mlog.String("mentioned_user_id", mentionedUserID),
				mlog.Err(err))
			continue
		}

		// If this is a paragraph node, check if it contains the mention
		if node.Type == "paragraph" {
			paragraphText := a.extractTextFromNodes(rctx, node.Content)
			// Check if this paragraph contains a mention of this user
			if a.paragraphContainsMention(rctx, node.Content, mentionedUserID) {
				return paragraphText
			}
		}

		// Recurse into child nodes
		if len(node.Content) > 0 {
			if result := a.findMentionInNodes(rctx, node.Content, mentionedUserID); result != "" {
				return result
			}
		}
	}

	return ""
}

// paragraphContainsMention checks if a paragraph contains a mention of the specified user
func (a *App) paragraphContainsMention(rctx request.CTX, nodes []json.RawMessage, mentionedUserID string) bool {
	for _, nodeRaw := range nodes {
		var node struct {
			Type  string         `json:"type"`
			Attrs map[string]any `json:"attrs,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			rctx.Logger().Debug("Failed to unmarshal TipTap node while checking for mention",
				mlog.String("mentioned_user_id", mentionedUserID),
				mlog.Err(err))
			continue
		}

		if node.Type == "mention" && node.Attrs != nil {
			if id, ok := node.Attrs["id"].(string); ok && id == mentionedUserID {
				return true
			}
		}
	}

	return false
}

// extractTextFromNodes converts TipTap nodes to plain text
func (a *App) extractTextFromNodes(rctx request.CTX, nodes []json.RawMessage) string {
	var text strings.Builder

	for _, nodeRaw := range nodes {
		var node struct {
			Type    string            `json:"type"`
			Text    string            `json:"text,omitempty"`
			Content []json.RawMessage `json:"content,omitempty"`
			Attrs   map[string]any    `json:"attrs,omitempty"`
		}

		if err := json.Unmarshal(nodeRaw, &node); err != nil {
			rctx.Logger().Debug("Failed to unmarshal TipTap node while extracting text",
				mlog.Err(err))
			continue
		}

		switch node.Type {
		case "text":
			text.WriteString(node.Text)
		case "mention":
			if node.Attrs != nil {
				if label, ok := node.Attrs["label"].(string); ok {
					text.WriteString(label)
				}
			}
		case "hardBreak":
			text.WriteString("\n")
		default:
			// Recurse for other node types
			if len(node.Content) > 0 {
				text.WriteString(a.extractTextFromNodes(rctx, node.Content))
			}
		}
	}

	return text.String()
}

// GetPageComments retrieves all comments (including inline comments) for a page
func (a *App) GetPageComments(rctx request.CTX, pageID string) ([]*model.Post, *model.AppError) {
	// Validate page exists
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.page_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	// Validate it's actually a page
	if page.Type != model.PostTypePage {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.not_a_page.app_error",
			nil, "post is not a page", http.StatusBadRequest)
	}

	// Get all comments with this page_id
	// This includes both inline comments (RootId empty) and regular comments (RootId = pageID)
	postList, appErr := a.Srv().Store().Post().GetCommentsForPage(pageID, false)
	if appErr != nil {
		return nil, model.NewAppError("GetPageComments",
			"app.page.get_comments.store_error.app_error",
			nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Convert PostList to array of posts (excluding the page itself)
	comments := make([]*model.Post, 0)
	for _, postID := range postList.Order {
		if postID != pageID { // Exclude the page itself
			if post, ok := postList.Posts[postID]; ok {
				comments = append(comments, post)
			}
		}
	}

	return comments, nil
}

// CreatePageComment creates a top-level comment on a page
func (a *App) CreatePageComment(rctx request.CTX, pageID, message string, inlineAnchor map[string]any) (*model.Post, *model.AppError) {
	// Validate page exists
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return nil, model.NewAppError("CreatePageComment",
			"app.page.create_comment.page_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	// Validate it's actually a page
	if page.Type != model.PostTypePage {
		return nil, model.NewAppError("CreatePageComment",
			"app.page.create_comment.not_a_page.app_error",
			nil, "post is not a page", http.StatusBadRequest)
	}

	// Check user has permission to view channel (inherited by comments)
	channel, chanErr := a.GetChannel(rctx, page.ChannelId)
	if chanErr != nil {
		return nil, chanErr
	}

	props := model.StringInterface{
		"page_id": pageID,
	}

	// Get wiki_id from CPA system
	wikiID, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr == nil && wikiID != "" {
		props["wiki_id"] = wikiID
	}

	// Inline comments are their own thread roots
	// Regular page comments are replies to the page
	rootID := pageID
	if len(inlineAnchor) > 0 {
		props["comment_type"] = "inline"
		props["inline_anchor"] = inlineAnchor
		rootID = ""
	}

	comment := &model.Post{
		ChannelId: page.ChannelId,
		UserId:    rctx.Session().UserId,
		RootId:    rootID,
		Message:   message,
		Type:      model.PostTypePageComment,
		Props:     props,
	}

	// Use existing CreatePost to get all hooks, validation, WebSocket events
	createdComment, createErr := a.CreatePost(rctx, comment, channel, model.CreatePostFlags{})
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page comment created",
		mlog.String("comment_id", createdComment.Id),
		mlog.String("page_id", pageID))

	return createdComment, nil
}

// CreatePageCommentReply creates a reply to a page comment (one level of nesting only)
func (a *App) CreatePageCommentReply(rctx request.CTX, pageID, parentCommentID, message string) (*model.Post, *model.AppError) {
	// Validate page exists
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil || page.Type != model.PostTypePage {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.page_not_found.app_error",
			nil, "", http.StatusNotFound)
	}

	// Validate parent comment exists
	parentComment, err := a.GetSinglePost(rctx, parentCommentID, false)
	if err != nil {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.parent_not_found.app_error",
			nil, "", http.StatusNotFound).Wrap(err)
	}

	// Validate parent is a page comment
	if parentComment.Type != model.PostTypePageComment {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.parent_not_comment.app_error",
			nil, "parent is not a page comment", http.StatusBadRequest)
	}

	// Validate: Can only reply to top-level comments (not to replies)
	// Enforce Confluence-style one-level nesting
	if parentComment.Props["parent_comment_id"] != nil {
		return nil, model.NewAppError("CreatePageCommentReply",
			"app.page.create_comment_reply.reply_to_reply_not_allowed.app_error",
			nil, "Can only reply to top-level comments", http.StatusBadRequest)
	}

	// Get channel
	channel, chanErr := a.GetChannel(rctx, page.ChannelId)
	if chanErr != nil {
		return nil, chanErr
	}

	// Determine RootId: for inline comments, RootId is the comment itself (thread root)
	// For regular page comments, RootId is the page
	rootID := pageID
	if parentComment.Props["comment_type"] == "inline" {
		rootID = parentCommentID
	}

	replyProps := model.StringInterface{
		"page_id":           pageID,
		"parent_comment_id": parentCommentID,
	}

	// Get wiki_id from CPA system
	wikiID, wikiErr := a.GetWikiIdForPage(rctx, pageID)
	if wikiErr == nil && wikiID != "" {
		replyProps["wiki_id"] = wikiID
	}

	reply := &model.Post{
		ChannelId: page.ChannelId,
		UserId:    rctx.Session().UserId,
		RootId:    rootID,
		Message:   message,
		Type:      model.PostTypePageComment,
		Props:     replyProps,
	}

	// Use existing CreatePost to get all hooks, validation, WebSocket events
	createdReply, createErr := a.CreatePost(rctx, reply, channel, model.CreatePostFlags{})
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page comment reply created",
		mlog.String("reply_id", createdReply.Id),
		mlog.String("page_id", pageID),
		mlog.String("parent_comment_id", parentCommentID))

	return createdReply, nil
}

// TransformPageCommentReply transforms a post structure when replying to a page comment
// from the standard RHS interface. This allows users to reply to page comments using
// the normal Mattermost reply UI without special handling.
//
// Inline comments have empty RootId (they are thread roots themselves)
// Regular page comments have RootId = pageID
//
// When a user tries to reply to an inline comment with RootId = commentID, this function:
//   - Keeps reply.RootId = commentID (inline comment is the thread root)
//   - Sets Props[parent_comment_id] = commentID
//   - Sets Type = PostTypePageComment
//
// For regular page comments:
//   - reply.RootId (commentID) -> reply.RootId (pageID)
//   - Sets Props[parent_comment_id] = commentID
//   - Sets Type = PostTypePageComment
func (a *App) TransformPageCommentReply(rctx request.CTX, post *model.Post, parentComment *model.Post) bool {
	// Only transform if parent is a page comment
	if parentComment.Type != model.PostTypePageComment {
		return false
	}

	parentCommentID := post.RootId
	pageID, _ := parentComment.Props["page_id"].(string)

	// Validate that the parent comment only replies to a page (one level nesting)
	if parentComment.Props["parent_comment_id"] != nil {
		// This is a reply to a reply - not allowed
		return false
	}

	// For inline comments: RootId stays as the comment ID (thread root)
	// For regular page comments: RootId becomes the page ID
	rootID := pageID
	if parentComment.Props["comment_type"] == "inline" {
		rootID = parentCommentID
	}

	// Update the post structure for page comment reply
	post.RootId = rootID
	post.Type = model.PostTypePageComment
	if post.Props == nil {
		post.Props = make(model.StringInterface)
	}
	post.Props["page_id"] = pageID
	post.Props["parent_comment_id"] = parentCommentID

	rctx.Logger().Debug("Transformed page comment reply structure",
		mlog.String("original_root_id", parentCommentID),
		mlog.String("new_root_id", rootID),
		mlog.String("parent_comment_id", parentCommentID))

	return true
}

const twoHoursInMilliseconds = int64(2 * 60 * 60 * 1000)

func (a *App) handlePageUpdateNotification(rctx request.CTX, page *model.Post, userId string) {
	wikiId, err := a.GetWikiIdForPage(rctx, page.Id)
	if err != nil {
		rctx.Logger().Warn("Failed to get wiki for page update notification",
			mlog.String("page_id", page.Id),
			mlog.Err(err))
		return
	}

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		rctx.Logger().Warn("Failed to get wiki details for page update notification",
			mlog.String("wiki_id", wikiId),
			mlog.Err(wikiErr))
		return
	}

	channel, chanErr := a.GetChannel(rctx, page.ChannelId)
	if chanErr != nil {
		rctx.Logger().Warn("Failed to get channel for page update notification",
			mlog.String("channel_id", page.ChannelId),
			mlog.Err(chanErr))
		return
	}

	twoHoursAgo := model.GetMillis() - twoHoursInMilliseconds

	existingPosts, searchErr := a.GetPostsSince(rctx, model.GetPostsSinceOptions{
		ChannelId: page.ChannelId,
		Time:      twoHoursAgo,
	})

	if searchErr != nil {
		rctx.Logger().Warn("Failed to search for existing page update notifications",
			mlog.String("page_id", page.Id),
			mlog.Err(searchErr))
		a.createNewPageUpdateNotification(rctx, page, wiki, channel, userId, 1)
		return
	}

	var existingNotification *model.Post
	for _, post := range existingPosts.Posts {
		if post.Type == model.PostTypePageUpdated {
			if pageIdProp, ok := post.Props["page_id"].(string); ok && pageIdProp == page.Id {
				existingNotification = post
				break
			}
		}
	}

	if existingNotification != nil {
		updateCount := 1
		if countProp, ok := existingNotification.Props["update_count"].(float64); ok {
			updateCount = int(countProp) + 1
		} else if countProp, ok := existingNotification.Props["update_count"].(int); ok {
			updateCount = countProp + 1
		}

		updaterIds := make(map[string]bool)
		if existingUpdaters, ok := existingNotification.Props["updater_ids"].([]any); ok {
			for _, id := range existingUpdaters {
				if idStr, ok := id.(string); ok {
					updaterIds[idStr] = true
				}
			}
		}
		updaterIds[userId] = true

		updaterIdsList := make([]string, 0, len(updaterIds))
		for id := range updaterIds {
			updaterIdsList = append(updaterIdsList, id)
		}

		user, userErr := a.GetUser(userId)
		if userErr != nil {
			rctx.Logger().Warn("Failed to get user for page update notification",
				mlog.String("user_id", userId),
				mlog.Err(userErr))
		} else {
			existingNotification.Props["username_"+userId] = user.Username
		}

		pageTitle := "Untitled"
		if title, ok := page.Props["title"].(string); ok && title != "" {
			pageTitle = title
		}

		existingNotification.Props["page_title"] = pageTitle
		existingNotification.Props["update_count"] = updateCount
		existingNotification.Props["last_update_time"] = model.GetMillis()
		existingNotification.Props["updater_ids"] = updaterIdsList

		if _, updateErr := a.Srv().Store().Post().Overwrite(rctx, existingNotification); updateErr != nil {
			rctx.Logger().Warn("Failed to update existing page update notification",
				mlog.String("notification_id", existingNotification.Id),
				mlog.String("page_id", page.Id),
				mlog.Err(updateErr))
		} else {
			rctx.Logger().Debug("Updated existing page update notification",
				mlog.String("notification_id", existingNotification.Id),
				mlog.String("page_id", page.Id),
				mlog.Int("update_count", updateCount))
		}
	} else {
		a.createNewPageUpdateNotification(rctx, page, wiki, channel, userId, 1)
	}
}

func (a *App) createNewPageUpdateNotification(rctx request.CTX, page *model.Post, wiki *model.Wiki, channel *model.Channel, userId string, updateCount int) {
	pageTitle := "Untitled"
	if title, ok := page.Props["title"].(string); ok && title != "" {
		pageTitle = title
	}

	user, userErr := a.GetUser(userId)
	if userErr != nil {
		rctx.Logger().Warn("Failed to get user for page update notification",
			mlog.String("user_id", userId),
			mlog.Err(userErr))
		return
	}

	systemPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Type:      model.PostTypePageUpdated,
		Props: map[string]any{
			"page_id":            page.Id,
			"page_title":         pageTitle,
			"wiki_id":            wiki.Id,
			"wiki_title":         wiki.Title,
			"channel_id":         channel.Id,
			"channel_name":       channel.Name,
			"update_count":       updateCount,
			"last_update_time":   model.GetMillis(),
			"updater_ids":        []string{userId},
			"username_" + userId: user.Username,
		},
	}

	if _, err := a.CreatePost(rctx, systemPost, channel, model.CreatePostFlags{}); err != nil {
		rctx.Logger().Warn("Failed to create page update system message",
			mlog.String("page_id", page.Id),
			mlog.String("wiki_id", wiki.Id),
			mlog.String("channel_id", channel.Id),
			mlog.Err(err))
	} else {
		rctx.Logger().Debug("Created new page update notification",
			mlog.String("page_id", page.Id),
			mlog.Int("update_count", updateCount))
	}
}

func (a *App) CanResolvePageComment(rctx request.CTX, session *model.Session, comment *model.Post, pageId string) bool {
	if comment.UserId == session.UserId {
		return true
	}

	page, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return false
	}

	if page.UserId == session.UserId {
		return true
	}

	return a.SessionHasPermissionToChannel(rctx, *session, page.ChannelId, model.PermissionManageChannelRoles)
}

func (a *App) ResolvePageComment(rctx request.CTX, commentId string, userId string) (*model.Post, *model.AppError) {
	comment, err := a.GetSinglePost(rctx, commentId, false)
	if err != nil {
		return nil, err
	}

	props := comment.GetProps()
	if resolved, ok := props["comment_resolved"].(bool); ok && resolved {
		return comment, nil
	}

	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	newProps["comment_resolved"] = true
	newProps["resolved_at"] = model.GetMillis()
	newProps["resolved_by"] = userId
	newProps["resolution_reason"] = "manual"
	comment.SetProps(newProps)

	updatedComment, updateErr := a.UpdatePost(rctx, comment, &model.UpdatePostOptions{})
	if updateErr != nil {
		return nil, updateErr
	}

	// Get page_id from comment props (inline comments have empty RootId)
	pageId, ok := comment.Props["page_id"].(string)
	if !ok || pageId == "" {
		return updatedComment, nil
	}

	page, pageErr := a.GetSinglePost(rctx, pageId, false)
	if pageErr == nil {
		channel, channelErr := a.GetChannel(rctx, page.ChannelId)
		if channelErr == nil {
			a.SendCommentResolvedEvent(rctx, updatedComment, page, channel)
		}
	}

	return updatedComment, nil
}

func (a *App) UnresolvePageComment(rctx request.CTX, commentId string) (*model.Post, *model.AppError) {
	comment, err := a.GetSinglePost(rctx, commentId, false)
	if err != nil {
		return nil, err
	}

	props := comment.GetProps()
	newProps := make(model.StringInterface)
	maps.Copy(newProps, props)

	delete(newProps, "comment_resolved")
	delete(newProps, "resolved_at")
	delete(newProps, "resolved_by")
	delete(newProps, "resolution_reason")
	comment.SetProps(newProps)

	updatedComment, updateErr := a.UpdatePost(rctx, comment, &model.UpdatePostOptions{})
	if updateErr != nil {
		return nil, updateErr
	}

	// Get page_id from comment props (inline comments have empty RootId)
	pageId, ok := comment.Props["page_id"].(string)
	if !ok || pageId == "" {
		return updatedComment, nil
	}

	page, pageErr := a.GetSinglePost(rctx, pageId, false)
	if pageErr == nil {
		channel, channelErr := a.GetChannel(rctx, page.ChannelId)
		if channelErr == nil {
			a.SendCommentUnresolvedEvent(rctx, updatedComment, page, channel)
		}
	}

	return updatedComment, nil
}

func (a *App) SendCommentResolvedEvent(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) {
	message := model.NewWebSocketEvent(
		model.WebsocketEventPageCommentResolved,
		channel.TeamId,
		comment.ChannelId,
		"",
		nil,
		"",
	)
	props := comment.GetProps()
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	message.Add("resolved_at", props["resolved_at"])
	message.Add("resolved_by", props["resolved_by"])
	a.Publish(message)
}

func (a *App) SendCommentUnresolvedEvent(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) {
	message := model.NewWebSocketEvent(
		model.WebsocketEventPageCommentUnresolved,
		channel.TeamId,
		comment.ChannelId,
		"",
		nil,
		"",
	)
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	a.Publish(message)
}

func (a *App) SendCommentDeletedEvent(rctx request.CTX, comment *model.Post, page *model.Post, channel *model.Channel) {
	message := model.NewWebSocketEvent(
		model.WebsocketEventPageCommentDeleted,
		channel.TeamId,
		comment.ChannelId,
		"",
		nil,
		"",
	)
	message.Add("comment_id", comment.Id)
	message.Add("page_id", page.Id)
	a.Publish(message)
}
