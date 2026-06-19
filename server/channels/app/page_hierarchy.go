// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"sort"
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
func (a *App) GetPageChildren(rctx request.CTX, pageID string, options model.GetPostsOptions) ([]*model.Page, *model.AppError) {
	_, appErr := a.GetPage(rctx, pageID)
	if appErr != nil {
		return nil, model.NewAppError("GetPageChildren", "app.page.get_children.parent.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	}

	pages, err := a.Srv().Store().Page().GetPageChildren(pageID, options)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPageChildren", "app.page.get_children.invalid_input.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageChildren", "app.page.get_children.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.EnrichPagesWithProperties(rctx, pages)

	return pages, nil
}

// GetPageAncestors fetches all ancestors of a page up to the root
func (a *App) GetPageAncestors(rctx request.CTX, pageID string) ([]*model.Page, *model.AppError) {
	pages, err := a.Srv().Store().Page().GetPageAncestors(pageID)
	if err != nil {
		return nil, model.NewAppError("GetPageAncestors", "app.page.get_ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.EnrichPagesWithProperties(rctx, pages)

	return pages, nil
}

// GetPageDescendants fetches all descendants of a page (entire subtree)
func (a *App) GetPageDescendants(rctx request.CTX, pageID string) ([]*model.Page, *model.AppError) {
	pages, err := a.Srv().Store().Page().GetPageDescendants(pageID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetPageDescendants", "app.page.get_descendants.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPageDescendants", "app.page.get_descendants.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.EnrichPagesWithProperties(rctx, pages)

	return pages, nil
}

// GetChannelPages fetches a paginated set of full-content pages in a channel, ordered by
// CreateAt DESC. Pass offset=0, limit=0 to load all pages (import paths only).
func (a *App) GetChannelPages(rctx request.CTX, channelID string, offset, limit int) ([]*model.Page, *model.AppError) {
	pages, err := a.Srv().Store().Page().GetChannelPages(channelID, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetChannelPages", "app.page.get_channel_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.EnrichPagesWithProperties(rctx, pages)

	return pages, nil
}

// GetPagesForChannel fetches pages from all wikis linked to a channel, merges results,
// and applies pagination. Returns the page list and whether results are partial (some
// wiki fetches failed). Callers are responsible for initial channel permission checks.
// When includeContent is false, page body fields are already absent (metadata-only load).
func (a *App) GetPagesForChannel(rctx request.CTX, channelId string, page, perPage int, includeContent bool) ([]*model.Page, bool, *model.AppError) {
	wikis, wikiErr := a.GetWikisLinkedToChannel(rctx, channelId)
	if wikiErr != nil {
		return nil, false, wikiErr
	}

	session := rctx.Session()
	var allPages []*model.Page
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
			// Load metadata only (no Body/TipTap content) so merging all wikis in memory
			// is cheap; full content is populated after pagination when includeContent=true.
			wikiPages, pagesErr := a.Srv().Store().Page().GetChannelPagesMeta(wiki.ChannelId)
			if pagesErr != nil {
				rctx.Logger().Warn("Failed to fetch pages for wiki, skipping",
					mlog.String("wiki_channel_id", wiki.ChannelId), mlog.Err(pagesErr))
				failCount.Add(1)
				return
			}
			mu.Lock()
			allPages = append(allPages, wikiPages...)
			mu.Unlock()
		})
	}
	wg.Wait()

	if n := int64(len(wikis)); n > 0 && failCount.Load() == n {
		return nil, false, model.NewAppError("GetPagesForChannel", "app.page.get_channel_pages.all_wikis_failed.app_error", nil, "", http.StatusInternalServerError)
	}

	hasPartialContent := failCount.Load() > 0

	// Sort by CreateAt descending (newest first)
	sortPagesByCreateAt(allPages)

	// Paginate
	start := page * perPage
	var pageSlice []*model.Page
	if start < len(allPages) {
		end := start + perPage
		if end > len(allPages) {
			end = len(allPages)
		}
		pageSlice = allPages[start:end]
	}

	if includeContent && len(pageSlice) > 0 {
		ids := make([]string, 0, len(pageSlice))
		for _, p := range pageSlice {
			ids = append(ids, p.Id)
		}
		full, pagesErr := a.Srv().Store().Page().GetPagesByIDs(RequestContextWithMaster(rctx), ids)
		if pagesErr != nil {
			rctx.Logger().Warn("Failed to batch-fetch page content", mlog.Err(pagesErr))
		} else {
			// Build a map for O(1) lookup
			fullMap := make(map[string]*model.Page, len(full))
			for _, fp := range full {
				fullMap[fp.Id] = fp
			}
			for _, p := range pageSlice {
				if fp, ok := fullMap[p.Id]; ok {
					p.Body = fp.Body
				}
			}
		}
	}

	return pageSlice, hasPartialContent, nil
}

// sortPagesByCreateAt sorts pages in descending CreateAt order (newest first).
func sortPagesByCreateAt(pages []*model.Page) {
	sort.Slice(pages, func(i, j int) bool {
		return pages[i].CreateAt > pages[j].CreateAt
	})
}

// calculateMaxDepthFromPages calculates the maximum depth in a page hierarchy slice.
func (a *App) calculateMaxDepthFromPages(pages []*model.Page) int {
	if len(pages) == 0 {
		return 0
	}

	parentMap := make(map[string]string)
	for _, p := range pages {
		if p.ParentId != "" {
			parentMap[p.Id] = p.ParentId
		}
	}

	maxDepth := 0
	for _, p := range pages {
		depth := 1
		currentID := p.Id
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
// wikiID is optional - if empty, it will be fetched from the page's WikiId column.
// Returns the updated list of siblings if reordering occurred, nil otherwise.
func (a *App) MovePage(rctx request.CTX, pageID string, newParentID *string, wikiID string, newIndex *int64) ([]*model.Page, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiPageOperation("move", time.Since(start).Seconds())
		}
	}()

	// Use master DB to avoid replica lag issues in HA
	page, err := a.GetPage(RequestContextWithMaster(rctx), pageID)
	if err != nil {
		return nil, err
	}

	// Store old parent ID for websocket broadcast
	oldParentID := page.ParentId

	// Determine effective parent ID for validation and broadcast
	effectiveParentID := oldParentID
	parentChanging := false
	if newParentID != nil {
		effectiveParentID = *newParentID
		parentChanging = effectiveParentID != oldParentID
	}

	// Store UpdateAt for optimistic locking - will fail if page was modified concurrently
	expectedUpdateAt := page.UpdateAt

	// Get wiki ID for websocket broadcast
	if wikiID == "" {
		if page.WikiId != "" {
			wikiID = page.WikiId
		} else {
			var wikiErr *model.AppError
			wikiID, wikiErr = a.GetWikiIdForPage(rctx, pageID)
			if wikiErr != nil {
				return nil, model.NewAppError("MovePage", "app.page.move.wiki_not_found.app_error", nil, "", http.StatusBadRequest).Wrap(wikiErr)
			}
		}
	}

	// Validate parent change if applicable (depth checks, same channel, etc.)
	if parentChanging && effectiveParentID != "" {
		if effectiveParentID == pageID {
			return nil, model.NewAppError("MovePage", "app.page.move.circular_reference.app_error", nil, "", http.StatusBadRequest)
		}

		parentPage, parentErr := a.GetPage(rctx, effectiveParentID)
		if parentErr != nil {
			return nil, model.NewAppError("MovePage", "app.page.move.invalid_parent.app_error", nil, "", http.StatusBadRequest).Wrap(parentErr)
		}
		if parentPage.ChannelId != page.ChannelId {
			return nil, model.NewAppError("MovePage", "app.page.move.parent_different_channel.app_error", nil, "", http.StatusBadRequest)
		}

		ancestors, ancestorErr := a.GetPageAncestors(rctx, effectiveParentID)
		if ancestorErr != nil {
			return nil, model.NewAppError("MovePage", "app.page.move.get_ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(ancestorErr)
		}

		for _, ancestor := range ancestors {
			if ancestor.Id == pageID {
				return nil, model.NewAppError("MovePage", "app.page.move.circular_reference.app_error", nil, "", http.StatusBadRequest)
			}
		}

		// Calculate depth from already-fetched ancestors to avoid redundant DB query
		parentDepth := len(ancestors)
		newPageDepth := parentDepth + 1
		if newPageDepth > model.PostPageMaxDepth {
			return nil, model.NewAppError("MovePage", "app.page.move.max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth}, "", http.StatusBadRequest)
		}

		// Validate that the entire subtree won't exceed max depth after the move
		subtreeMaxDepth, subtreeErr := a.calculateSubtreeMaxDepth(rctx, pageID)
		if subtreeErr != nil {
			return nil, subtreeErr
		}
		if newPageDepth+subtreeMaxDepth > model.PostPageMaxDepth {
			return nil, model.NewAppError("MovePage", "app.page.move.subtree_max_depth_exceeded.app_error",
				map[string]any{"MaxDepth": model.PostPageMaxDepth, "SubtreeDepth": subtreeMaxDepth, "NewDepth": newPageDepth}, "", http.StatusBadRequest)
		}
	}

	// Perform atomic move operation (parent change + sort order in single transaction)
	siblings, storeErr := a.Srv().Store().Page().MovePage(pageID, page.ChannelId, newParentID, newIndex, expectedUpdateAt)
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

	a.invalidateCacheForChannelPosts(page.ChannelId)

	// Broadcast page_moved websocket event (only if parent changed or reordering happened)
	if parentChanging || newIndex != nil {
		opts := PageMovedBroadcastOptions{
			Siblings: siblings,
		}
		a.BroadcastPageMoved(pageID, oldParentID, effectiveParentID, wikiID, model.GetMillis(), opts)
	}

	rctx.Logger().Info("Page moved",
		mlog.String("page_id", pageID),
		mlog.String("old_parent_id", oldParentID),
		mlog.String("effective_parent_id", effectiveParentID),
		mlog.Bool("parent_changed", parentChanging),
		mlog.Bool("reordered", newIndex != nil))

	return siblings, nil
}

// calculatePageDepth calculates the depth of a page in the hierarchy.
// Returns the depth (0 for root pages) and any error encountered.
// page is optional - if provided, avoids a DB fetch.
func (a *App) calculatePageDepth(rctx request.CTX, pageID string, page *model.Page) (int, *model.AppError) {
	if page == nil {
		var err *model.AppError
		page, err = a.GetPage(rctx, pageID)
		if err != nil {
			return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.not_found", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	if page.ParentId == "" {
		return 0, nil
	}

	// Call store directly to avoid permission check in GetPageAncestors.
	ancestors, storeErr := a.Srv().Store().Page().GetPageAncestors(pageID)
	if storeErr != nil {
		return 0, model.NewAppError("calculatePageDepth", "app.page.calculate_depth.ancestors.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	return len(ancestors), nil
}

// calculateSubtreeMaxDepth calculates the maximum depth of descendants relative to the given page.
// Returns 0 if the page has no children, 1 if only direct children, etc.
func (a *App) calculateSubtreeMaxDepth(rctx request.CTX, pageID string) (int, *model.AppError) {
	descendants, err := a.Srv().Store().Page().GetPageDescendants(pageID)
	if err != nil {
		return 0, model.NewAppError("calculateSubtreeMaxDepth", "app.page.calculate_subtree_depth.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(descendants) == 0 {
		return 0, nil
	}

	// Build parent map
	parentMap := make(map[string]string)
	for _, p := range descendants {
		if p.ParentId != "" {
			parentMap[p.Id] = p.ParentId
		}
	}

	// Find max depth relative to pageID (the root of the subtree)
	maxDepth := 0
	for _, d := range descendants {
		depth := 0
		currentID := d.Id
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
func (a *App) BuildBreadcrumbPath(rctx request.CTX, page *model.Page, wiki *model.Wiki) (*model.BreadcrumbPath, *model.AppError) {
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

	for _, ancestor := range ancestors {
		item := &model.BreadcrumbItem{
			Id:    ancestor.Id,
			Title: ancestor.Title,
			Type:  "page",
			Path:  model.BuildPageUrl(teamName, wikiId, ancestor.Id),
		}
		breadcrumbItems = append(breadcrumbItems, item)
	}

	currentPage := &model.BreadcrumbItem{
		Id:    page.Id,
		Title: page.Title,
		Type:  "page",
		Path:  model.BuildPageUrl(teamName, wikiId, page.Id),
	}

	return &model.BreadcrumbPath{
		Items:       breadcrumbItems,
		CurrentPage: currentPage,
	}, nil
}
