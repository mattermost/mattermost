// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// GetPageChildren fetches direct children of a page.
// Note: Permission checks should be performed by the caller (API layer) before calling this method.
func (a *App) GetPageChildren(rctx request.CTX, postID string, options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	_, appErr := a.GetPage(rctx, postID)
	if appErr != nil {
		return nil, model.NewAppError("GetPageChildren", "app.page.get_children.parent.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	}

	postList, err := a.Srv().Store().Page().GetPageChildren(postID, options)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPageChildren", "app.page.get_children.invalid_input.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageChildren", "app.page.get_children.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.EnrichPagesWithProperties(rctx, postList)

	a.applyPostsWillBeConsumedHook(postList.Posts)

	return postList, nil
}

// GetPageAncestors fetches all ancestors of a page up to the root
func (a *App) GetPageAncestors(rctx request.CTX, postID string) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Page().GetPageAncestors(postID)
	if err != nil {
		return nil, model.NewAppError("GetPageAncestors", "app.page.get_ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.EnrichPagesWithProperties(rctx, postList)

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

	a.EnrichPagesWithProperties(rctx, postList)

	a.applyPostsWillBeConsumedHook(postList.Posts)

	return postList, nil
}

// GetChannelPages fetches pages in a channel with pagination.
// Pages are sorted by hierarchy order in-memory, then paginated.
func (a *App) GetChannelPages(rctx request.CTX, channelID string, offset, limit int) (*model.PostList, *model.AppError) {
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

	if a.Metrics() != nil {
		maxDepth := a.calculateMaxDepthFromPostList(postList)
		a.Metrics().ObserveWikiHierarchyDepth(float64(maxDepth))
		a.Metrics().ObserveWikiPagesPerChannel(float64(len(postList.Posts)))
	}

	// Apply pagination before enrichment so we only enrich the page we return
	if offset > 0 || limit > 0 {
		order := postList.Order
		if offset >= len(order) {
			postList.Order = []string{}
			postList.Posts = map[string]*model.Post{}
		} else {
			end := min(offset+limit, len(order))
			paginatedOrder := order[offset:end]
			paginatedPosts := make(map[string]*model.Post, len(paginatedOrder))
			for _, id := range paginatedOrder {
				if p, ok := postList.Posts[id]; ok {
					paginatedPosts[id] = p
				}
			}
			postList.Order = paginatedOrder
			postList.Posts = paginatedPosts
		}
	}

	a.EnrichPagesWithProperties(rctx, postList)

	a.applyPostsWillBeConsumedHook(postList.Posts)

	return postList, nil
}

// GetPagesForChannel fetches pages from all wikis linked to a channel, merges results,
// and applies pagination. Returns the page list and whether results are partial (some
// wiki fetches failed). Callers are responsible for initial channel permission checks.
// When includeContent is false, page message bodies are stripped before returning.
func (a *App) GetPagesForChannel(rctx request.CTX, channelId string, page, perPage int, includeContent bool) (*model.PostList, bool, *model.AppError) {
	wikis, wikiErr := a.GetWikisLinkedToChannel(rctx, channelId)
	if wikiErr != nil {
		return nil, false, wikiErr
	}

	const maxPerWikiLimit = 200
	perWikiLimit := (page + 1) * perPage
	if perWikiLimit <= 0 || perWikiLimit > maxPerWikiLimit {
		perWikiLimit = maxPerWikiLimit
	}

	session := rctx.Session()
	allPages := model.NewPostList()
	var mu sync.Mutex
	var failCount atomic.Int64
	var wg sync.WaitGroup
	sem := make(chan struct{}, 10)
	for _, wiki := range wikis {
		wg.Go(func() {
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-rctx.Context().Done():
				failCount.Add(1)
				return
			}
			// Per-wiki permission filter: applied here (rather than at the API layer) because
			// GetPagesForChannel is a fan-out over multiple wikis within a single channel.
			// Internal callers (session.UserId == "") bypass this filter intentionally.
			if session.UserId != "" && !a.SessionHasWikiPermission(*session, wiki, model.PermissionReadPage) {
				return
			}
			wikiPages, pagesErr := a.GetChannelPages(rctx, wiki.ChannelId, 0, perWikiLimit)
			if pagesErr != nil {
				rctx.Logger().Warn("Failed to fetch pages for wiki, skipping",
					mlog.String("wiki_channel_id", wiki.ChannelId), mlog.Err(pagesErr))
				failCount.Add(1)
				return
			}
			if wikiPages == nil {
				return
			}
			mu.Lock()
			allPages.Extend(wikiPages)
			mu.Unlock()
		})
	}
	wg.Wait()

	if n := int64(len(wikis)); n > 0 && failCount.Load() == n {
		return nil, false, model.NewAppError("GetPagesForChannel", "app.page.get_channel_pages.all_wikis_failed.app_error", nil, "", http.StatusInternalServerError)
	}

	hasPartialContent := failCount.Load() > 0

	allPages.SortByCreateAt()

	postList := model.NewPostList()
	start := page * perPage
	end := start + perPage
	if start < len(allPages.Order) {
		if end > len(allPages.Order) {
			end = len(allPages.Order)
		}
		postList.Order = allPages.Order[start:end]
		for _, id := range postList.Order {
			if p, ok := allPages.Posts[id]; ok {
				postList.Posts[id] = p
			}
		}
	}

	if !includeContent {
		for _, post := range postList.Posts {
			if post.Type == model.PostTypePage {
				post.Message = ""
			}
		}
	}

	return postList, hasPartialContent, nil
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

// MovePage moves a page within the hierarchy. Can change parent and/or reorder among siblings.
// - newParentID: if non-nil, changes the page's parent (nil = keep current parent, empty string = move to root)
// - newIndex: if non-nil, reorders the page to this position among siblings
// Uses optimistic locking to handle concurrent modifications in HA cluster mode.
// wikiID is optional - if empty, it will be fetched from the page's props or property values.
// Returns the updated list of siblings if reordering occurred, nil otherwise.
func (a *App) MovePage(rctx request.CTX, postID string, newParentID *string, wikiID string, newIndex *int64) (*model.PostList, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("move", time.Since(start).Seconds())
		}
	}()

	// Use master DB to avoid replica lag issues in HA
	page, err := a.GetPage(RequestContextWithMaster(rctx), postID)
	if err != nil {
		return nil, err
	}
	post := page

	// Store old parent ID for websocket broadcast
	oldParentID := post.PageParentId

	// Determine effective parent ID for validation and broadcast
	effectiveParentID := oldParentID
	parentChanging := false
	if newParentID != nil {
		effectiveParentID = *newParentID
		parentChanging = effectiveParentID != oldParentID
	}

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
				return nil, model.NewAppError("MovePage", "app.page.move.wiki_not_found.app_error", nil, "", http.StatusBadRequest).Wrap(wikiErr)
			}
		}
	}

	// Validate parent change if applicable (depth checks, same channel, etc.)
	if parentChanging && effectiveParentID != "" {
		if effectiveParentID == postID {
			return nil, model.NewAppError("MovePage", "app.page.move.circular_reference.app_error", nil, "", http.StatusBadRequest)
		}

		parentPage, parentErr := a.GetPage(rctx, effectiveParentID)
		if parentErr != nil {
			return nil, model.NewAppError("MovePage", "app.page.move.invalid_parent.app_error", nil, "", http.StatusBadRequest).Wrap(parentErr)
		}
		if parentPage.ChannelId != post.ChannelId {
			return nil, model.NewAppError("MovePage", "app.page.move.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
		}

		ancestors, ancestorErr := a.GetPageAncestors(rctx, effectiveParentID)
		if ancestorErr != nil {
			return nil, model.NewAppError("MovePage", "app.page.move.get_ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(ancestorErr)
		}

		for _, ancestor := range ancestors.Posts {
			if ancestor.Id == postID {
				return nil, model.NewAppError("MovePage", "app.page.move.circular_reference.app_error", nil, "", http.StatusBadRequest)
			}
		}

		// Calculate depth from already-fetched ancestors to avoid redundant DB query
		parentDepth := len(ancestors.Posts)
		newPageDepth := parentDepth + 1
		if newPageDepth > model.PostPageMaxDepth {
			return nil, model.NewAppError("MovePage", "app.page.move.max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth}, "", http.StatusBadRequest)
		}

		// Validate that the entire subtree won't exceed max depth after the move
		subtreeMaxDepth, subtreeErr := a.calculateSubtreeMaxDepth(rctx, postID)
		if subtreeErr != nil {
			return nil, subtreeErr
		}
		if newPageDepth+subtreeMaxDepth > model.PostPageMaxDepth {
			return nil, model.NewAppError("MovePage", "app.page.move.subtree_max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth, "SubtreeDepth": subtreeMaxDepth, "NewDepth": newPageDepth}, "", http.StatusBadRequest)
		}
	}

	// Perform atomic move operation (parent change + sort order in single transaction)
	siblingPosts, storeErr := a.Srv().Store().Page().MovePage(postID, post.ChannelId, newParentID, newIndex, expectedUpdateAt)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(storeErr, &nfErr):
			return nil, model.NewAppError("MovePage", "app.page.move.not_found", nil, "", http.StatusNotFound).Wrap(storeErr)
		case errors.As(storeErr, &invErr):
			// Cycle detected at store level (race condition prevention)
			return nil, model.NewAppError("MovePage", "app.page.move.circular_reference.app_error", nil, "", http.StatusBadRequest).Wrap(storeErr)
		default:
			return nil, model.NewAppError("MovePage", "app.page.move.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	// Convert to PostList for response
	var siblings *model.PostList
	if siblingPosts != nil {
		siblings = model.NewPostList()
		for _, p := range siblingPosts {
			siblings.AddPost(p)
			siblings.AddOrder(p.Id)
		}
	}

	a.invalidateCacheForChannelPosts(post.ChannelId)

	// Broadcast page_moved websocket event (only if parent changed or reordering happened)
	if parentChanging || newIndex != nil {
		opts := PageMovedBroadcastOptions{
			Siblings: siblings, // Include updated sort orders so all clients sync
		}
		a.BroadcastPageMoved(postID, oldParentID, effectiveParentID, wikiID, model.GetMillis(), opts)
	}

	rctx.Logger().Info("Page moved",
		mlog.String("page_id", postID),
		mlog.String("old_parent_id", oldParentID),
		mlog.String("effective_parent_id", effectiveParentID),
		mlog.Bool("parent_changed", parentChanging),
		mlog.Bool("reordered", newIndex != nil))

	return siblings, nil
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
		page, err = a.GetPage(rctx, pageID)
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
func (a *App) BuildBreadcrumbPath(rctx request.CTX, page *model.Post, wiki *model.Wiki) (*model.BreadcrumbPath, *model.AppError) {
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

	wikiId := wiki.Id

	teamName := ""
	if wiki.TeamId != "" {
		if team, teamErr := a.GetTeam(wiki.TeamId); teamErr != nil {
			rctx.Logger().Warn("BuildBreadcrumbPath: failed to fetch team for wiki", mlog.String("wiki_id", wiki.Id), mlog.Err(teamErr))
		} else {
			teamName = team.Name
		}
	}

	wikiRoot := &model.BreadcrumbItem{
		Id:    wikiId,
		Title: wiki.Title,
		Type:  "wiki",
		Path:  model.BuildWikiUrl(teamName, wikiId),
	}
	breadcrumbItems = append(breadcrumbItems, wikiRoot)

	if ancestors != nil && len(ancestors.Order) > 0 {
		for _, ancestorId := range ancestors.Order {
			if ancestor, ok := ancestors.Posts[ancestorId]; ok {
				item := &model.BreadcrumbItem{
					Id:    ancestor.Id,
					Title: ancestor.GetPageTitle(),
					Type:  "page",
					Path:  model.BuildPageUrl(teamName, wikiId, ancestor.Id),
				}
				breadcrumbItems = append(breadcrumbItems, item)
			}
		}
	}

	currentPage := &model.BreadcrumbItem{
		Id:    page.Id,
		Title: page.GetPageTitle(),
		Type:  "page",
		Path:  model.BuildPageUrl(teamName, wikiId, page.Id),
	}

	return &model.BreadcrumbPath{
		Items:       breadcrumbItems,
		CurrentPage: currentPage,
	}, nil
}
