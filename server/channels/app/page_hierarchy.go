// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var pageHierarchyLock sync.Mutex

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
		if newPageDepth > model.PostPageMaxDepth {
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

	ancestors, err := a.GetPageAncestors(rctx, page.Id)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(rctx, page.ChannelId)
	if err != nil {
		return nil, err
	}

	team, err := a.GetTeam(channel.TeamId)
	if err != nil {
		return nil, err
	}

	wikiId, err := a.GetWikiIdForPage(rctx, page.Id)
	if err != nil {
		return nil, err
	}

	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, err
	}

	wikiRoot := &model.BreadcrumbItem{
		Id:        wikiId,
		Title:     wiki.Title,
		Type:      "wiki",
		Path:      "/" + team.Name + "/channels/" + page.ChannelId + "?wikiId=" + wikiId,
		ChannelId: page.ChannelId,
	}
	breadcrumbItems = append(breadcrumbItems, wikiRoot)

	if ancestors != nil && len(ancestors.Order) > 0 {
		for _, ancestorId := range ancestors.Order {
			if ancestor, ok := ancestors.Posts[ancestorId]; ok {
				item := &model.BreadcrumbItem{
					Id:        ancestor.Id,
					Title:     ancestor.GetPageTitle(),
					Type:      "page",
					Path:      "/" + team.Name + "/channels/" + page.ChannelId + "/" + ancestor.Id + "?wikiId=" + wikiId,
					ChannelId: ancestor.ChannelId,
				}
				breadcrumbItems = append(breadcrumbItems, item)
			}
		}
	}

	currentPage := &model.BreadcrumbItem{
		Id:        page.Id,
		Title:     page.GetPageTitle(),
		Type:      "page",
		Path:      "/" + team.Name + "/channels/" + page.ChannelId + "/" + page.Id + "?wikiId=" + wikiId,
		ChannelId: page.ChannelId,
	}

	return &model.BreadcrumbPath{
		Items:       breadcrumbItems,
		CurrentPage: currentPage,
	}, nil
}
