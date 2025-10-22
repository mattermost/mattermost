// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var (
	pageHierarchyLocks   = make(map[string]*sync.Mutex)
	pageHierarchyLocksMu sync.Mutex
)

// getPageHierarchyLock retrieves or creates a mutex for a specific channel's page hierarchy
func getPageHierarchyLock(channelID string) *sync.Mutex {
	pageHierarchyLocksMu.Lock()
	defer pageHierarchyLocksMu.Unlock()

	if lock, exists := pageHierarchyLocks[channelID]; exists {
		return lock
	}

	lock := &sync.Mutex{}
	pageHierarchyLocks[channelID] = lock
	return lock
}

// PageOperation represents the type of operation being performed on a page
type PageOperation int

const (
	PageOperationCreate PageOperation = iota
	PageOperationRead
	PageOperationEdit
	PageOperationDelete
)

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
	// 1. Get channel
	channel, err := a.GetChannel(rctx, page.ChannelId)
	if err != nil {
		return err
	}

	// 2. Determine required permission based on channel type and operation
	var permission *model.Permission
	switch channel.Type {
	case model.ChannelTypeOpen:
		switch operation {
		case PageOperationCreate:
			permission = model.PermissionCreatePagePublicChannel
		case PageOperationRead:
			permission = model.PermissionReadPagePublicChannel
		case PageOperationEdit:
			permission = model.PermissionEditPagePublicChannel
		case PageOperationDelete:
			permission = model.PermissionDeletePagePublicChannel
		}
	case model.ChannelTypePrivate:
		switch operation {
		case PageOperationCreate:
			permission = model.PermissionCreatePagePrivateChannel
		case PageOperationRead:
			permission = model.PermissionReadPagePrivateChannel
		case PageOperationEdit:
			permission = model.PermissionEditPagePrivateChannel
		case PageOperationDelete:
			permission = model.PermissionDeletePagePrivateChannel
		}
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// In DMs/GMs, check if user is a member
		if _, err := a.GetChannelMember(rctx, channel.Id, session.UserId); err != nil {
			return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
		}

		// Guests cannot modify pages in DM/GM
		user, err := a.GetUser(session.UserId)
		if err != nil {
			return err
		}
		if user.IsGuest() {
			return model.NewAppError(operationName, "api.page.permission.guest_cannot_modify", nil, "", http.StatusForbidden)
		}

		// For edit/delete operations, check ownership (same as public/private channels)
		if operation == PageOperationEdit || operation == PageOperationDelete {
			if page.UserId != session.UserId {
				// Not the author - need channel admin role
				member, err := a.GetChannelMember(rctx, channel.Id, session.UserId)
				if err != nil {
					return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden).Wrap(err)
				}

				if !member.SchemeAdmin {
					return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
				}
			}
		}

		return nil
	default:
		return model.NewAppError(operationName, "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
	}

	// 3. Check channel-level permission
	if !a.SessionHasPermissionToChannel(rctx, *session, channel.Id, permission) {
		return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
	}

	// 4. Ownership check for Edit/Delete (ChannelUsers can only modify their own pages)
	if operation == PageOperationEdit || operation == PageOperationDelete {
		if page.UserId != session.UserId {
			// Not the author - need channel admin role
			member, err := a.GetChannelMember(rctx, channel.Id, session.UserId)
			if err != nil {
				return model.NewAppError(operationName, "api.page.permission.no_channel_access", nil, "", http.StatusForbidden).Wrap(err)
			}

			if !member.SchemeAdmin {
				return model.NewAppError(operationName, "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			}
		}
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
	if len(title) > 255 {
		return nil, model.NewAppError("CreatePage", "app.page.create.title_too_long.app_error", nil, "title must be 255 characters or less", http.StatusBadRequest)
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

	pageContent := &model.PageContent{
		PageId: createdPage.Id,
	}
	if err := pageContent.SetDocumentJSON(content); err != nil {
		if _, delErr := a.DeletePost(rctx, createdPage.Id, userID); delErr != nil {
			rctx.Logger().Warn("Failed to delete page post during cleanup", mlog.String("page_id", createdPage.Id), mlog.Err(delErr))
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.invalid_content.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if searchText != "" {
		pageContent.SearchText = searchText
	}

	_, contentErr := a.Srv().Store().PageContent().Save(pageContent)
	if contentErr != nil {
		if _, delErr := a.DeletePost(rctx, createdPage.Id, userID); delErr != nil {
			rctx.Logger().Warn("Failed to delete page post during cleanup", mlog.String("page_id", createdPage.Id), mlog.Err(delErr))
		}
		return nil, model.NewAppError("CreatePage", "app.page.create.save_content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	rctx.Logger().Info("Page created",
		mlog.String("page_id", createdPage.Id),
		mlog.String("channel_id", channelID),
		mlog.String("parent_id", pageParentID))

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

	rctx.Logger().Debug("GetPage: returning post", mlog.String("page_id", pageID), mlog.Int("message_length", len(post.Message)))
	return post, nil
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

	if title != "" {
		if len(title) > 255 {
			return nil, model.NewAppError("UpdatePage", "app.page.update.title_too_long.app_error", nil, "title must be 255 characters or less", http.StatusBadRequest)
		}
		post.Props["title"] = title
	}

	if content != "" {
		pageContent, getErr := a.Srv().Store().PageContent().Get(pageID)
		if getErr != nil {
			var nfErr *store.ErrNotFound
			if errors.As(getErr, &nfErr) {
				pageContent = &model.PageContent{PageId: pageID}
			} else {
				return nil, model.NewAppError("UpdatePage", "app.page.update.get_content.app_error", nil, "", http.StatusInternalServerError).Wrap(getErr)
			}
		}

		if err := pageContent.SetDocumentJSON(content); err != nil {
			return nil, model.NewAppError("UpdatePage", "app.page.update.invalid_content.app_error", nil, err.Error(), http.StatusBadRequest)
		}

		if searchText != "" {
			pageContent.SearchText = searchText
		}

		var contentErr error
		if getErr != nil {
			_, contentErr = a.Srv().Store().PageContent().Save(pageContent)
		} else {
			_, contentErr = a.Srv().Store().PageContent().Update(pageContent)
		}

		if contentErr != nil {
			return nil, model.NewAppError("UpdatePage", "app.page.update.save_content.app_error", nil, "", http.StatusInternalServerError).Wrap(contentErr)
		}
	}

	updatedPost, updateErr := a.UpdatePost(rctx, post, nil)
	if updateErr != nil {
		return nil, updateErr
	}

	rctx.Logger().Info("Page updated",
		mlog.String("page_id", pageID))

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

	_, deleteErr := a.DeletePost(rctx, pageID, rctx.Session().UserId)
	return deleteErr
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

	// Acquire lock for the channel's page hierarchy to prevent race conditions
	// This ensures that concurrent parent changes cannot create circular references
	lock := getPageHierarchyLock(post.ChannelId)
	lock.Lock()
	defer lock.Unlock()

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

// BreadcrumbItem represents a single item in the breadcrumb path
type BreadcrumbItem struct {
	Id        string `json:"id"`
	Title     string `json:"title"`
	Type      string `json:"type"` // "wiki", "page"
	Path      string `json:"path"`
	ChannelId string `json:"channel_id"`
}

// BreadcrumbPath represents the full breadcrumb navigation path
type BreadcrumbPath struct {
	Items       []*BreadcrumbItem `json:"items"`
	CurrentPage *BreadcrumbItem   `json:"current_page"`
}

// BuildBreadcrumbPath builds the breadcrumb navigation path for a page
func (a *App) BuildBreadcrumbPath(rctx request.CTX, page *model.Post) (*BreadcrumbPath, *model.AppError) {
	var breadcrumbItems []*BreadcrumbItem

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
	wikiRoot := &BreadcrumbItem{
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
				item := &BreadcrumbItem{
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
	currentPage := &BreadcrumbItem{
		Id:        page.Id,
		Title:     a.getPageTitle(page),
		Type:      "page",
		Path:      "/" + team.Name + "/channels/" + page.ChannelId + "/" + page.Id + "?wikiId=" + wikiId,
		ChannelId: page.ChannelId,
	}

	return &BreadcrumbPath{
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
	var doc struct {
		Type    string            `json:"type"`
		Content []json.RawMessage `json:"content"`
	}

	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		return nil, err
	}

	mentionIDs := make(map[string]bool)
	a.extractMentionsFromNodes(doc.Content, mentionIDs)

	result := make([]string, 0, len(mentionIDs))
	for id := range mentionIDs {
		result = append(result, id)
	}

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
			continue
		}

		if node.Type == "mention" && node.Attrs != nil && node.Attrs.ID != "" {
			mentionIDs[node.Attrs.ID] = true
		}

		if len(node.Content) > 0 {
			a.extractMentionsFromNodes(node.Content, mentionIDs)
		}
	}
}

// PublishPageDraft publishes a draft as a page
func (a *App) PublishPageDraft(rctx request.CTX, userId, wikiId, draftId, parentId, title, searchText string) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Publishing page draft",
		mlog.String("user_id", userId),
		mlog.String("wiki_id", wikiId),
		mlog.String("draft_id", draftId))

	draft, err := a.Srv().Store().Draft().GetPageDraft(userId, wikiId, draftId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("PublishPageDraft", "app.draft.publish_page.not_found",
				nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("PublishPageDraft", "app.draft.publish_page.get_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("Draft content before validation",
		mlog.String("message", draft.Message),
		mlog.Int("message_length", len(draft.Message)),
		mlog.Int("trimmed_length", len(strings.TrimSpace(draft.Message))),
		mlog.Int("file_count", len(draft.FileIds)),
		mlog.Any("props", draft.Props))

	if strings.TrimSpace(draft.Message) == "" && len(draft.FileIds) == 0 {
		return nil, model.NewAppError("PublishPageDraft", "app.draft.publish_page.empty",
			nil, "cannot publish empty page draft", http.StatusBadRequest)
	}

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, wikiErr
	}

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, chanErr
	}

	session := rctx.Session()
	if permErr := a.HasPermissionToModifyWiki(rctx, session, channel, WikiOperationEdit, "PublishPageDraft"); permErr != nil {
		return nil, permErr
	}

	if parentId != "" {
		parentPage, parentErr := a.GetSinglePost(rctx, parentId, false)
		if parentErr != nil {
			return nil, model.NewAppError("PublishPageDraft", "api.page.publish.parent_not_found.app_error", nil, "", http.StatusNotFound).Wrap(parentErr)
		}

		if parentPage.Type != model.PostTypePage {
			return nil, model.NewAppError("PublishPageDraft", "api.page.publish.parent_not_page.app_error", nil, "", http.StatusBadRequest)
		}

		if parentPage.ChannelId != wiki.ChannelId {
			return nil, model.NewAppError("PublishPageDraft", "api.page.publish.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
		}
	}

	pageId, isUpdate := draft.Props["page_id"].(string)

	var savedPost *model.Post

	if isUpdate && pageId != "" {
		rctx.Logger().Debug("Updating existing page from draft",
			mlog.String("page_id", pageId),
			mlog.String("wiki_id", wikiId))

		existingPost, getErr := a.GetSinglePost(rctx, pageId, false)
		if getErr != nil {
			return nil, model.NewAppError("PublishPageDraft", "app.draft.publish_page.get_existing_error",
				nil, "", http.StatusInternalServerError).Wrap(getErr)
		}

		if parentId != "" {
			ancestors, ancestorsErr := a.GetPageAncestors(rctx, parentId)
			if ancestorsErr != nil {
				return nil, ancestorsErr
			}

			if _, exists := ancestors.Posts[pageId]; exists {
				return nil, model.NewAppError("PublishPageDraft", "api.page.publish.circular_reference.app_error",
					nil, "pageId="+pageId+", parentId="+parentId, http.StatusBadRequest)
			}
		}

		updatedPost, updateErr := a.UpdatePage(rctx, pageId, title, draft.Message, searchText)
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

		savedPost = updatedPost

		rctx.Logger().Info("Page updated from draft",
			mlog.String("page_id", savedPost.Id),
			mlog.String("wiki_id", wikiId),
			mlog.String("parent_id", parentId))
	} else {
		rctx.Logger().Debug("Creating new page from draft",
			mlog.String("wiki_id", wikiId))

		createdPost, createErr := a.CreatePage(rctx, wiki.ChannelId, title, parentId, draft.Message, userId, searchText)
		if createErr != nil {
			return nil, createErr
		}

		createdPost.Props["wiki_id"] = wikiId
		updatedPost, updateErr := a.UpdatePost(rctx, createdPost, nil)
		if updateErr != nil {
			if _, deleteErr := a.DeletePost(rctx, createdPost.Id, userId); deleteErr != nil {
				rctx.Logger().Warn("Failed to delete page after wiki_id update failure",
					mlog.String("page_id", createdPost.Id),
					mlog.Err(deleteErr))
			}
			return nil, updateErr
		}
		createdPost = updatedPost

		if linkErr := a.AddPageToWiki(rctx, createdPost.Id, wikiId); linkErr != nil {
			if _, deleteErr := a.DeletePost(rctx, createdPost.Id, userId); deleteErr != nil {
				rctx.Logger().Warn("Failed to delete page after wiki link failure",
					mlog.String("page_id", createdPost.Id),
					mlog.Err(deleteErr))
			}
			return nil, linkErr
		}

		savedPost = createdPost

		rctx.Logger().Info("Page created from draft",
			mlog.String("page_id", savedPost.Id),
			mlog.String("wiki_id", wikiId),
			mlog.String("parent_id", parentId))
	}

	if deleteErr := a.Srv().Store().Draft().DeletePageDraft(userId, wikiId, draftId); deleteErr != nil {
		rctx.Logger().Warn("Failed to delete draft after successful publish - orphaned draft will remain",
			mlog.String("user_id", userId),
			mlog.String("wiki_id", wikiId),
			mlog.String("draft_id", draftId),
			mlog.String("page_id", savedPost.Id),
			mlog.Err(deleteErr))
	}

	pageWithContent, getErr := a.GetPage(rctx, savedPost.Id)
	if getErr != nil {
		rctx.Logger().Warn("Failed to fetch published page with content", mlog.String("page_id", savedPost.Id), mlog.Err(getErr))
		return savedPost, nil
	}

	mentionedUserIDs, extractErr := a.ExtractMentionsFromTipTapContent(pageWithContent.Message)
	if extractErr != nil {
		rctx.Logger().Warn("Failed to extract mentions from page content", mlog.String("page_id", pageWithContent.Id), mlog.Err(extractErr))
	} else if len(mentionedUserIDs) > 0 {
		user, userErr := a.GetUser(userId)
		if userErr != nil {
			rctx.Logger().Warn("Failed to get user for mention notifications", mlog.String("user_id", userId), mlog.Err(userErr))
		} else {
			team, teamErr := a.GetTeam(channel.TeamId)
			if teamErr != nil {
				rctx.Logger().Warn("Failed to get team for mention notifications", mlog.String("team_id", channel.TeamId), mlog.Err(teamErr))
			} else {
				if _, notifyErr := a.SendNotifications(rctx, pageWithContent, team, channel, user, nil, true); notifyErr != nil {
					rctx.Logger().Warn("Failed to send mention notifications for page", mlog.String("page_id", pageWithContent.Id), mlog.Err(notifyErr))
				} else {
					rctx.Logger().Debug("Sent mention notifications for page",
						mlog.String("page_id", pageWithContent.Id),
						mlog.Int("mention_count", len(mentionedUserIDs)))
				}
			}
		}
	}

	pageJSON, jsonErr := pageWithContent.ToJSON()
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to encode page to JSON", mlog.Err(jsonErr))
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPagePublished, "", wiki.ChannelId, "", nil, "")
	message.Add("page_id", pageWithContent.Id)
	message.Add("wiki_id", wikiId)
	message.Add("draft_id", draftId)
	message.Add("user_id", userId)
	message.Add("page", pageJSON)
	message.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId: wiki.ChannelId,
	})
	a.Publish(message)

	return pageWithContent, nil
}
