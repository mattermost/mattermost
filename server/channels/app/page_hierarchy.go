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

// GetPageChildren fetches direct children of a page.
// Note: Permission checks should be performed by the caller (API layer) before calling this method.
func (a *App) GetPageChildren(rctx request.CTX, postID string, options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	parentPost, appErr := a.GetSinglePost(rctx, postID, false)
	if appErr != nil {
		return nil, model.NewAppError("GetPageChildren", "app.page.get_children.parent.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	}

	// Verify parent exists but don't check permissions here - that's the API layer's job
	_ = parentPost

	postList, err := a.Srv().Store().Page().GetPageChildren(postID, options)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPageChildren", "app.page.get_children.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageChildren", "app.page.get_children.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
			return nil, model.NewAppError("GetPageAncestors", "app.page.get_ancestors.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageAncestors", "app.page.get_ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
			return nil, model.NewAppError("GetPageDescendants", "app.page.get_descendants.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageDescendants", "app.page.get_descendants.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		return nil, model.NewAppError("GetChannelPages", "app.page.get_channel_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
// wikiID is optional - if empty, it will be fetched from the page's props or property values.
func (a *App) ChangePageParent(rctx request.CTX, postID string, newParentID string, wikiID string) *model.AppError {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("move", time.Since(start).Seconds())
		}
	}()

	// Use master DB to avoid replica lag issues in HA
	page, err := a.GetPage(RequestContextWithMaster(rctx), postID)
	if err != nil {
		return model.NewAppError("ChangePageParent", "app.page.change_parent.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}
	post := page

	// Store old parent ID for websocket broadcast
	oldParentID := post.PageParentId

	// Store UpdateAt for optimistic locking - will fail if page was modified concurrently
	expectedUpdateAt := post.UpdateAt

	// Get wiki ID for websocket broadcast (use provided or fetch from page)
	if wikiID == "" {
		// Try to get from page.Props first (fast path)
		if propWikiID, ok := page.Props[model.PagePropsWikiID].(string); ok && propWikiID != "" {
			wikiID = propWikiID
		} else {
			// Fallback to property values lookup
			var wikiErr *model.AppError
			wikiID, wikiErr = a.GetWikiIdForPage(rctx, postID)
			if wikiErr != nil {
				return model.NewAppError("ChangePageParent", "app.page.change_parent.wiki_not_found.app_error", nil, "", http.StatusBadRequest).Wrap(wikiErr)
			}
		}
	}

	if newParentID != "" {
		if newParentID == postID {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.circular_reference.app_error", nil, "", http.StatusBadRequest)
		}

		parentPage, parentErr := a.GetPage(rctx, newParentID)
		if parentErr != nil {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.invalid_parent.app_error", nil, "", http.StatusBadRequest).Wrap(parentErr)
		}
		if parentPage.ChannelId != post.ChannelId {
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

		// Validate that the entire subtree won't exceed max depth after the move
		subtreeMaxDepth, subtreeErr := a.calculateSubtreeMaxDepth(rctx, postID)
		if subtreeErr != nil {
			return subtreeErr
		}
		if newPageDepth+subtreeMaxDepth > model.PostPageMaxDepth {
			return model.NewAppError("ChangePageParent", "app.page.change_parent.subtree_max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth, "SubtreeDepth": subtreeMaxDepth, "NewDepth": newPageDepth}, "", http.StatusBadRequest)
		}
	}

	// Use optimistic locking: only update if UpdateAt hasn't changed since we read the page
	// The store layer also performs atomic cycle detection to prevent race conditions
	if storeErr := a.Srv().Store().Page().ChangePageParent(postID, newParentID, expectedUpdateAt); storeErr != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(storeErr, &nfErr):
			return model.NewAppError("ChangePageParent", "app.page.change_parent.not_found", nil, "", http.StatusNotFound).Wrap(storeErr)
		case errors.As(storeErr, &invErr):
			// Cycle detected at store level (race condition prevention)
			return model.NewAppError("ChangePageParent", "app.page.change_parent.circular_reference.app_error", nil, "", http.StatusBadRequest).Wrap(storeErr)
		default:
			return model.NewAppError("ChangePageParent", "app.page.change_parent.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
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
// page is optional - if provided, avoids a DB fetch.
func (a *App) calculatePageDepth(rctx request.CTX, pageID string, page *model.Post) (int, *model.AppError) {
	// Use provided page or fetch if not provided
	if page == nil {
		var err *model.AppError
		page, err = a.GetSinglePost(rctx, pageID, false)
		if err != nil {
			return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.not_found", nil, "", http.StatusBadRequest).Wrap(err)
		}
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

// calculateSubtreeMaxDepth calculates the maximum depth of descendants relative to the given page.
// Returns 0 if the page has no children, 1 if only direct children, etc.
func (a *App) calculateSubtreeMaxDepth(rctx request.CTX, pageID string) (int, *model.AppError) {
	descendants, err := a.Srv().Store().Page().GetPageDescendants(pageID)
	if err != nil {
		return 0, model.NewAppError("calculateSubtreeMaxDepth", "app.page.calculate_subtree_depth.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if descendants == nil || len(descendants.Posts) == 0 {
		return 0, nil
	}

	// Build parent map
	parentMap := make(map[string]string)
	for _, post := range descendants.Posts {
		if post.PageParentId != "" {
			parentMap[post.Id] = post.PageParentId
		}
	}

	// Find max depth relative to pageID (the root of the subtree)
	maxDepth := 0
	for descendantID := range descendants.Posts {
		depth := 0
		currentID := descendantID
		visited := make(map[string]bool)
		for currentID != pageID && currentID != "" {
			if visited[currentID] {
				break
			}
			visited[currentID] = true
			depth++
			currentID = parentMap[currentID]
		}
		if depth > maxDepth {
			maxDepth = depth
		}
	}

	return maxDepth, nil
}

// BuildBreadcrumbPath builds the breadcrumb navigation path for a page.
// Accepts pre-fetched wiki, channel, and optionally team to avoid redundant DB queries.
func (a *App) BuildBreadcrumbPath(rctx request.CTX, page *model.Post, wiki *model.Wiki, channel *model.Channel, team *model.Team) (*model.BreadcrumbPath, *model.AppError) {
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

	// Use provided team or fetch if not provided
	if team == nil {
		var teamErr *model.AppError
		team, teamErr = a.GetTeam(channel.TeamId)
		if teamErr != nil {
			return nil, teamErr
		}
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
