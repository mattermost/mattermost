// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

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
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiHierarchyLoad(time.Since(start).Seconds())
		}
	}()

	postList, err := a.Srv().Store().Page().GetChannelPages(channelID)
	if err != nil {
		return nil, model.NewAppError("GetChannelPages", "app.post.get_channel_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if enrichErr := a.EnrichPagesWithProperties(rctx, postList); enrichErr != nil {
		return nil, enrichErr
	}

	a.applyPostsWillBeConsumedHook(postList.Posts)

	if a.Metrics() != nil {
		maxDepth := a.calculateMaxDepthFromPostList(postList)
		a.Metrics().ObserveWikiHierarchyDepth(float64(maxDepth))
		a.Metrics().ObserveWikiPagesPerChannel(float64(len(postList.Posts)))
	}

	return postList, nil
}

// calculateMaxDepthFromPostList calculates the maximum depth in a page hierarchy
func (a *App) calculateMaxDepthFromPostList(postList *model.PostList) int {
	if postList == nil || len(postList.Posts) == 0 {
		return 0
	}

	parentMap := make(map[string]string)
	for _, post := range postList.Posts {
		if post.PageParentId != "" {
			parentMap[post.Id] = post.PageParentId
		}
	}

	maxDepth := 0
	for postID := range postList.Posts {
		depth := 1
		currentID := postID
		visited := make(map[string]bool)
		for parentMap[currentID] != "" {
			if visited[currentID] {
				break
			}
			visited[currentID] = true
			currentID = parentMap[currentID]
			depth++
		}
		if depth > maxDepth {
			maxDepth = depth
		}
	}

	return maxDepth
}

// ChangePageParent updates the parent of a page.
// Uses optimistic locking to handle concurrent modifications in HA cluster mode.
// If another node modifies the page concurrently, returns a conflict error.
func (a *App) ChangePageParent(rctx request.CTX, postID string, newParentID string) *model.AppError {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("move", time.Since(start).Seconds())
		}
	}()

	// Use master DB to avoid replica lag issues in HA
	page, err := a.GetPage(rctx.With(RequestContextWithMaster), postID)
	if err != nil {
		return model.NewAppError("ChangePageParent", "app.page.change_parent.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}
	post := page.Post()

	// Store old parent ID for websocket broadcast
	oldParentID := post.PageParentId

	// Store UpdateAt for optimistic locking - will fail if page was modified concurrently
	expectedUpdateAt := post.UpdateAt

	// Get wiki ID for websocket broadcast
	wikiID, wikiErr := a.GetWikiIdForPage(rctx, postID)
	if wikiErr != nil {
		return model.NewAppError("ChangePageParent", "app.page.change_parent.wiki_not_found.app_error", nil, "", http.StatusBadRequest).Wrap(wikiErr)
	}

	if newParentID != "" {
		if newParentID == postID {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.circular_reference.app_error", nil, "", http.StatusBadRequest)
		}

		parentPage, parentErr := a.GetPage(rctx, newParentID)
		if parentErr != nil {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.invalid_parent.app_error", nil, "", http.StatusBadRequest).Wrap(parentErr)
		}
		if parentPage.ChannelId() != post.ChannelId {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
		}

		ancestors, ancestorErr := a.GetPageAncestors(rctx, newParentID)
		if ancestorErr != nil {
			return ancestorErr
		}

		for _, ancestor := range ancestors.Posts {
			if ancestor.Id == postID {
				return model.NewAppError("ChangePageParent", "app.page.change_parent.circular_reference.app_error", nil, "", http.StatusBadRequest)
			}
		}

		// Calculate depth from already-fetched ancestors to avoid redundant DB query
		parentDepth := len(ancestors.Posts)
		newPageDepth := parentDepth + 1
		if newPageDepth > model.PostPageMaxDepth {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth}, "", http.StatusBadRequest)
		}
	}

	// Use optimistic locking: only update if UpdateAt hasn't changed since we read the page
	if storeErr := a.Srv().Store().Page().ChangePageParent(postID, newParentID, expectedUpdateAt); storeErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(storeErr, &nfErr):
			return model.NewAppError("ChangePageParent", "app.post.change_page_parent.not_found", nil, "", http.StatusNotFound).Wrap(storeErr)
		default:
			return model.NewAppError("ChangePageParent", "app.post.change_page_parent.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	a.invalidateCacheForChannelPosts(post.ChannelId)

	// Broadcast page_moved websocket event
	a.BroadcastPageMoved(postID, oldParentID, newParentID, wikiID, post.ChannelId, model.GetMillis())

	rctx.Logger().Info("Page parent changed",
		mlog.String("page_id", postID),
		mlog.String("old_parent_id", oldParentID),
		mlog.String("new_parent_id", newParentID))

	return nil
}

// calculatePageDepth calculates the depth of a page in the hierarchy
// Returns the depth (0 for root pages) and any error encountered
// Note: This is an internal function that bypasses permission checks.
// Callers must ensure the user has appropriate permissions before calling.
func (a *App) calculatePageDepth(rctx request.CTX, pageID string) (int, *model.AppError) {
	page, err := a.GetSinglePost(rctx, pageID, false)
	if err != nil {
		return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.not_found", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if page.PageParentId == "" {
		return 0, nil
	}

	// Call store directly to avoid permission check in GetPageAncestors.
	// This is safe because callers (CreatePage, ChangePageParent) have already
	// verified the user has permission to access the channel.
	ancestors, storeErr := a.Srv().Store().Page().GetPageAncestors(pageID)
	if storeErr != nil {
		return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	depth := len(ancestors.Posts)
	return depth, nil
}

// BuildBreadcrumbPath builds the breadcrumb navigation path for a page.
// Accepts pre-fetched wiki and channel to avoid redundant DB queries.
func (a *App) BuildBreadcrumbPath(rctx request.CTX, page *model.Post, wiki *model.Wiki, channel *model.Channel) (*model.BreadcrumbPath, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiBreadcrumbFetch(time.Since(start).Seconds())
		}
	}()

	var breadcrumbItems []*model.BreadcrumbItem

	ancestors, err := a.GetPageAncestors(rctx, page.Id)
	if err != nil {
		return nil, err
	}

	team, err := a.GetTeam(channel.TeamId)
	if err != nil {
		return nil, err
	}

	wikiId := wiki.Id

	wikiRoot := &model.BreadcrumbItem{
		Id:        wikiId,
		Title:     wiki.Title,
		Type:      "wiki",
		Path:      model.BuildWikiUrl(team.Name, page.ChannelId, wikiId),
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
					Path:      model.BuildPageUrl(team.Name, ancestor.ChannelId, wikiId, ancestor.Id),
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
		Path:      model.BuildPageUrl(team.Name, page.ChannelId, wikiId, page.Id),
		ChannelId: page.ChannelId,
	}

	return &model.BreadcrumbPath{
		Items:       breadcrumbItems,
		CurrentPage: currentPage,
	}, nil
}
