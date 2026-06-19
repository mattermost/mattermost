// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"maps"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// prepareWikiCreateInputs builds and pre-validates the structs the store layer
// inserts atomically: backing channel (ChannelTypeWiki, generated name), creator
// admin membership (nil if userId == ""), and the default page draft seeded
// with an empty TipTap doc and DefaultPageTitle in props (nil if userId == "").
// Mutates wiki: sets ChannelId from the new backing channel, CreatorId, and
// runs PreSave/IsValid.
func (a *App) prepareWikiCreateInputs(wiki *model.Wiki, userId string) (*model.Channel, *model.ChannelMember, *model.Draft, *model.AppError) {
	backingChannel := &model.Channel{
		TeamId: wiki.TeamId,
		Type:   model.ChannelTypeWiki,
		DisplayName: func() string {
			s, _ := model.LimitRunes(strings.TrimSpace(wiki.Title), model.ChannelDisplayNameMaxRunes)
			return s
		}(),
		Name:      "wiki-" + model.NewId()[:20],
		Header:    wiki.Description,
		CreatorId: userId,
	}
	backingChannel.PreSave()
	if vErr := backingChannel.IsValid(); vErr != nil {
		return nil, nil, nil, model.NewAppError("CreateWiki", "app.wiki.create.invalid_backing_channel.app_error", nil, "", http.StatusBadRequest).Wrap(vErr)
	}

	wiki.ChannelId = backingChannel.Id
	wiki.CreatorId = userId
	wiki.PreSave()
	if vErr := wiki.IsValid(); vErr != nil {
		return nil, nil, nil, model.NewAppError("CreateWiki", "app.wiki.create.invalid_wiki.app_error", nil, "", http.StatusBadRequest).Wrap(vErr)
	}

	if userId == "" {
		return backingChannel, nil, nil, nil
	}

	creatorMember := &model.ChannelMember{
		ChannelId:   backingChannel.Id,
		UserId:      userId,
		SchemeUser:  true,
		SchemeAdmin: true,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	creatorMember.PreSave()
	if vErr := creatorMember.IsValid(); vErr != nil {
		return nil, nil, nil, model.NewAppError("CreateWiki", "app.wiki.create.invalid_channel_member.app_error", nil, "", http.StatusBadRequest).Wrap(vErr)
	}

	return backingChannel, creatorMember, newDefaultPageDraft(wiki.Id, userId), nil
}

// newDefaultPageDraft seeds the empty page that appears when a fresh wiki opens.
// Page draft rows use ChannelId = wiki.Id and RootId = the new page id.
func newDefaultPageDraft(wikiId, userId string) *model.Draft {
	now := model.GetMillis()
	pageId := model.NewId()
	return &model.Draft{
		CreateAt:  now,
		UpdateAt:  now,
		Message:   model.EmptyTipTapJSON,
		RootId:    pageId,
		ChannelId: wikiId,
		UserId:    userId,
		FileIds:   model.StringArray{},
		Props: model.StringInterface{
			model.PagePropsTitle:  model.DefaultPageTitle,
			model.PagePropsPageID: pageId,
		},
		Priority: model.StringInterface{},
	}
}

func (a *App) CreateWiki(rctx request.CTX, wiki *model.Wiki, userId string) (*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Creating independent wiki", mlog.String("title", wiki.Title))

	// ChannelId is server-assigned (backing channel). Callers must not set it.
	if wiki.ChannelId != "" {
		return nil, model.NewAppError("CreateWiki", "app.wiki.create.channel_id_not_allowed.app_error", nil, "", http.StatusBadRequest)
	}

	if wiki.TeamId != "" {
		if _, teamErr := a.GetTeam(wiki.TeamId); teamErr != nil {
			return nil, model.NewAppError("CreateWiki", "app.wiki.create.team_not_found.app_error", nil, "", http.StatusNotFound).Wrap(teamErr)
		}
	}

	backingChannel, creatorMember, defaultDraft, prepErr := a.prepareWikiCreateInputs(wiki, userId)
	if prepErr != nil {
		return nil, prepErr
	}

	// Wiki backing channels are internal-only (ChannelTypeWiki) and bypass
	// a.CreateChannel() to avoid firing the ChannelHasBeenCreated plugin hook.
	// The store commits all rows atomically.
	savedWiki, err := a.Srv().Store().Wiki().Create(rctx, wiki, backingChannel, creatorMember, defaultDraft)
	if err != nil {
		return nil, model.NewAppError("CreateWiki", "app.wiki.create.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if userId != "" {
		a.Srv().Platform().InvalidateChannelCacheForUser(userId)
	}

	a.BroadcastWikiCreated(savedWiki, nil)

	return savedWiki, nil
}

func (a *App) GetWiki(rctx request.CTX, wikiId string) (*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Getting wiki", mlog.String("wiki_id", wikiId))

	wiki, err := a.Srv().Store().Wiki().Get(wikiId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("GetWiki", "app.wiki.get.not_found", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetWiki", "app.wiki.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return wiki, nil
}

func (a *App) GetWikiByChannelId(rctx request.CTX, channelId string) (*model.Wiki, *model.AppError) {
	wiki, err := a.Srv().Store().Wiki().GetByChannelId(channelId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("GetWikiByChannelId", "app.wiki.get_by_channel_id.not_found", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetWikiByChannelId", "app.wiki.get_by_channel_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return wiki, nil
}

func (a *App) GetTeamWikis(rctx request.CTX, teamId string, page, perPage int) ([]*model.Wiki, *model.AppError) {
	wikis, err := a.Srv().Store().Wiki().GetForTeam(teamId, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetTeamWikis", "app.wiki.get_for_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return wikis, nil
}

// resolveToBackingChannelIds resolves source channel IDs to wiki backing
// channel IDs via ChannelMemberLinks. If a channel has no links (i.e. it is
// already a backing channel), it is included as-is.
func (a *App) resolveToBackingChannelIds(rctx request.CTX, channelIds []string) []string {
	if len(channelIds) == 0 {
		return channelIds
	}

	allLinks, err := a.Srv().Store().ChannelMemberLink().GetBySources(channelIds)
	if err != nil {
		rctx.Logger().Warn("Failed to resolve backing channel IDs", mlog.Err(err))
		return channelIds
	}

	linksBySource := make(map[string][]string, len(channelIds))
	for _, link := range allLinks {
		linksBySource[link.SourceId] = append(linksBySource[link.SourceId], link.DestinationId)
	}

	seen := make(map[string]bool, len(channelIds))
	resolved := make([]string, 0, len(channelIds))
	for _, chId := range channelIds {
		var candidates []string
		if dests, ok := linksBySource[chId]; ok {
			candidates = dests
		} else {
			candidates = []string{chId}
		}
		for _, id := range candidates {
			if !seen[id] {
				seen[id] = true
				resolved = append(resolved, id)
			}
		}
	}
	return resolved
}

func (a *App) GetUserWikis(rctx request.CTX, userId, teamId string, page, perPage int) ([]*model.Wiki, *model.AppError) {
	wikis, err := a.Srv().Store().Wiki().GetForUser(userId, teamId, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetUserWikis", "app.wiki.get_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return wikis, nil
}

func (a *App) GetWikisForChannel(rctx request.CTX, channelId string, includeDeleted bool) ([]*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Getting wikis for channel", mlog.String("channel_id", channelId), mlog.Bool("include_deleted", includeDeleted))

	var wikis []*model.Wiki
	var links []*model.ChannelMemberLink
	var wg sync.WaitGroup
	var wikiErr error
	var linkErr error

	wg.Add(2)
	go func() {
		defer wg.Done()
		var err error
		wikis, err = a.Srv().Store().Wiki().GetForChannel(channelId, includeDeleted)
		if err != nil {
			wikiErr = err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		links, err = a.Srv().Store().ChannelMemberLink().GetBySource(channelId)
		if err != nil {
			linkErr = err
		}
	}()

	wg.Wait()

	if wikiErr != nil {
		return nil, model.NewAppError("GetWikisForChannel", "app.wiki.get_for_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(wikiErr)
	}
	if linkErr != nil {
		rctx.Logger().Warn("Failed to fetch wiki links for channel", mlog.String("channel_id", channelId), mlog.Err(linkErr))
	}

	seen := make(map[string]bool, len(wikis))
	for _, w := range wikis {
		seen[w.Id] = true
	}

	if len(links) > 0 {
		destIds := make([]string, 0, len(links))
		for _, link := range links {
			destIds = append(destIds, link.DestinationId)
		}
		linked, lErr := a.Srv().Store().Wiki().GetForChannels(destIds, includeDeleted)
		if lErr != nil {
			rctx.Logger().Warn("Failed to fetch wikis for linked channels", mlog.Err(lErr))
		} else {
			for _, w := range linked {
				if !seen[w.Id] {
					seen[w.Id] = true
					wikis = append(wikis, w)
				}
			}
		}
	}

	return wikis, nil
}

func (a *App) UpdateWiki(rctx request.CTX, wiki *model.Wiki) (*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Updating wiki", mlog.String("wiki_id", wiki.Id), mlog.String("title", wiki.Title))

	if wiki.ChannelId != "" {
		channel, chanErr := a.GetWikiBackingChannel(rctx, wiki.ChannelId)
		if chanErr != nil {
			return nil, model.NewAppError("UpdateWiki", "app.wiki.update.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
		}

		if channel.DeleteAt != 0 {
			return nil, model.NewAppError("UpdateWiki", "app.wiki.update.deleted_channel.app_error", nil, "", http.StatusBadRequest)
		}

		if wiki.TeamId != "" && wiki.TeamId != channel.TeamId {
			return nil, model.NewAppError("UpdateWiki", "app.wiki.update.team_channel_mismatch.app_error", nil, "", http.StatusBadRequest)
		}
	}

	wiki.PreUpdate()
	if appErr := wiki.IsValid(); appErr != nil {
		return nil, appErr
	}

	updatedWiki, err := a.Srv().Store().Wiki().Update(wiki)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("UpdateWiki", "app.wiki.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		var conflictErr *store.ErrConflict
		if errors.As(err, &conflictErr) {
			return nil, model.NewAppError("UpdateWiki", "app.wiki.update.conflict.app_error", nil, "", http.StatusConflict).Wrap(err)
		}
		return nil, model.NewAppError("UpdateWiki", "app.wiki.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Invalidate cache so other nodes see the update
	a.invalidateCacheForChannelPosts(updatedWiki.ChannelId)

	// Broadcast wiki update to all clients
	a.BroadcastWikiUpdated(updatedWiki)

	return updatedWiki, nil
}

// DeleteWiki deletes a wiki and all its pages.
// wiki is optional - if provided, avoids a redundant DB fetch.
func (a *App) DeleteWiki(rctx request.CTX, wikiId, userId string, wiki *model.Wiki) *model.AppError {
	rctx.Logger().Debug("Deleting wiki", mlog.String("wiki_id", wikiId))

	if wiki == nil {
		var wikiErr *model.AppError
		wiki, wikiErr = a.GetWiki(rctx, wikiId)
		if wikiErr != nil {
			return wikiErr
		}
	}

	var wikiChannel *model.Channel
	if wiki.ChannelId != "" {
		var chErr *model.AppError
		wikiChannel, chErr = a.GetWikiBackingChannel(rctx, wiki.ChannelId)
		if chErr != nil {
			return chErr
		}
	}

	var links []*model.ChannelMemberLink
	if wiki.ChannelId != "" {
		var linksErr error
		links, linksErr = a.Srv().Store().ChannelMemberLink().GetByDestination(wiki.ChannelId)
		if linksErr != nil {
			rctx.Logger().Warn("Failed to fetch wiki links for broadcast; wiki_unlinked WebSocket events will not be sent for this wiki's links",
				mlog.String("wiki_id", wikiId), mlog.Err(linksErr))
		}
	}

	// Collect page IDs before deletion so their PropertyValues can be cleaned up afterward.
	var pageIDs []string
	if wiki.ChannelId != "" {
		if pageMeta, metaErr := a.Srv().Store().Page().GetChannelPagesMeta(wiki.ChannelId); metaErr == nil {
			for _, p := range pageMeta {
				pageIDs = append(pageIDs, p.Id)
			}
		} else {
			rctx.Logger().Warn("Failed to collect page IDs for property cleanup; property values may require manual cleanup",
				mlog.String("wiki_id", wikiId), mlog.Err(metaErr))
		}
	}

	// Mark wiki as deleted first so it becomes invisible to reads even if later
	// cascade steps fail. This matches the PermanentDeleteTeam pattern: mark
	// DeleteAt before touching children so a crash mid-cascade leaves no live wiki.
	if err := a.Srv().Store().Wiki().Delete(wikiId, false); err != nil {
		return model.NewAppError("DeleteWiki", "app.wiki.delete.wiki_record_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Wiki().DeleteWikiCascade(wikiId); err != nil {
		rctx.Logger().Warn("Failed to cascade-delete wiki pages; pages may require manual cleanup",
			mlog.String("wiki_id", wikiId), mlog.Err(err))
	}

	// Clean up PropertyValues for all deleted pages (best-effort).
	if len(pageIDs) > 0 {
		group, groupErr := a.GetPagePropertyGroup()
		if groupErr != nil {
			rctx.Logger().Warn("Failed to get page property group for cleanup; property values may require manual cleanup",
				mlog.String("wiki_id", wikiId), mlog.Err(groupErr))
		} else {
			for _, pageID := range pageIDs {
				if appErr := a.DeletePropertyValuesForTarget(rctx, group.ID, model.PropertyValueTargetTypePage, pageID); appErr != nil {
					rctx.Logger().Warn("Failed to clean up property values for deleted page",
						mlog.String("page_id", pageID), mlog.Err(appErr))
				}
			}
		}
	}

	if wikiChannel != nil {
		if delErr := a.PermanentDeleteChannel(rctx, wikiChannel); delErr != nil {
			rctx.Logger().Warn("Failed to delete wiki backing channel; channel may require manual cleanup",
				mlog.String("channel_id", wiki.ChannelId), mlog.Err(delErr))
		}
	}

	if len(links) > 0 {
		sourceChannelIds := make([]string, 0, len(links))
		for _, link := range links {
			sourceChannelIds = append(sourceChannelIds, link.SourceId)
		}
		sourceChannels, chFetchErr := a.GetChannels(rctx, sourceChannelIds)
		if chFetchErr != nil {
			rctx.Logger().Warn("Failed to batch-fetch source channels for wiki deleted notifications",
				mlog.String("wiki_id", wikiId), mlog.Err(chFetchErr))
		}
		sourceChannelMap := make(map[string]*model.Channel, len(sourceChannels))
		for _, ch := range sourceChannels {
			sourceChannelMap[ch.Id] = ch
		}
		for _, link := range links {
			if sourceChannel, ok := sourceChannelMap[link.SourceId]; ok {
				a.sendWikiNotification(rctx, wikiNotificationParams{
					postType:    model.PostTypeWikiDeleted,
					wiki:        wiki,
					channel:     sourceChannel,
					userId:      userId,
					userPropKey: "deleted_user_id",
				})
			}
		}
		// Batch cache invalidation before broadcasting so other nodes that respond
		// to the unlinked event don't serve stale pre-delete state.
		for _, link := range links {
			a.invalidateCachesForLinkChange(rctx, link.SourceId, wiki.ChannelId)
		}
		// Batch broadcast wiki unlinked events
		now := model.GetMillis()
		for _, link := range links {
			a.broadcastChannelMemberLinkEvent(model.WebsocketEventChannelMemberUnlinked, wikiId, link.SourceId, now)
		}
	}

	a.BroadcastWikiDeleted(wiki, links)

	return nil
}

func (a *App) GetWikiPages(rctx request.CTX, wikiId string, offset, limit int) ([]*model.Page, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiHierarchyLoad(time.Since(start).Seconds())
		}
	}()

	rctx.Logger().Debug("Getting wiki pages", mlog.String("wiki_id", wikiId), mlog.Int("offset", offset), mlog.Int("limit", limit))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return nil, wikiErr
	}

	pages, err := a.Srv().Store().Page().GetChannelPages(wiki.ChannelId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetWikiPages", "app.wiki.get_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.EnrichPagesWithProperties(rctx, pages)

	if a.Metrics() != nil && len(pages) > 0 {
		maxDepth := a.calculateMaxDepthFromPages(pages)
		a.Metrics().ObserveWikiHierarchyDepth(float64(maxDepth))
		a.Metrics().ObserveWikiPagesPerChannel(float64(len(pages)))
	}

	return pages, nil
}

// DeleteWikiPage deletes a page from a wiki.
// wiki and channel are optional - if provided, avoids redundant DB fetches.
func (a *App) DeleteWikiPage(rctx request.CTX, page *model.Page, wikiId string, wiki *model.Wiki, channel *model.Channel) *model.AppError {
	pageId := page.Id

	rctx.Logger().Debug("Deleting wiki page", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	if wiki == nil {
		var wikiErr *model.AppError
		wiki, wikiErr = a.GetWiki(rctx, wikiId)
		if wikiErr != nil {
			return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
		}
	}

	if channel == nil && wiki.ChannelId != "" {
		var chanErr *model.AppError
		channel, chanErr = a.GetWikiBackingChannel(rctx, wiki.ChannelId)
		if chanErr != nil {
			return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
		}
	}

	if channel != nil && channel.DeleteAt != 0 {
		return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if deletePageErr := a.DeletePage(rctx, page, wikiId); deletePageErr != nil {
		return deletePageErr
	}

	rctx.Logger().Debug("Wiki page deleted", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	return nil
}

// MovePageToWiki moves a page to a different wiki (or different parent in same wiki).
// sourceWikiId is optional - if empty, it will be fetched from the page's WikiId column.
// sourceWiki and targetWiki are optional - if provided, avoids redundant DB fetches.
func (a *App) MovePageToWiki(rctx request.CTX, page *model.Page, targetWikiId string, parentPageId *string, sourceWikiId string, sourceWiki, targetWiki *model.Wiki) *model.AppError {
	pageId := page.Id
	post := page

	// Use provided sourceWikiId, page.WikiId column, or fetch if not provided
	if sourceWikiId == "" {
		if page.WikiId != "" {
			sourceWikiId = page.WikiId
		} else {
			var err *model.AppError
			sourceWikiId, err = a.GetWikiIdForPage(rctx, pageId)
			if err != nil {
				statusCode := http.StatusInternalServerError
				if err.StatusCode == http.StatusNotFound {
					statusCode = http.StatusNotFound
				}
				return model.NewAppError("MovePageToWiki", "app.page.move.source_wiki_not_found", nil, "", statusCode).Wrap(err)
			}
		}
	}

	if sourceWiki == nil {
		var err *model.AppError
		sourceWiki, err = a.GetWiki(rctx, sourceWikiId)
		if err != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.source_wiki_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if sourceWikiId == targetWikiId && parentPageId == nil {
		rctx.Logger().Debug("Same-wiki move without parent change has no effect",
			mlog.String("page_id", pageId),
			mlog.String("wiki_id", targetWikiId))
		return nil
	}

	if targetWiki == nil {
		var err *model.AppError
		targetWiki, err = a.GetWiki(rctx, targetWikiId)
		if err != nil {
			statusCode := http.StatusInternalServerError
			if err.StatusCode == http.StatusNotFound {
				statusCode = http.StatusNotFound
			}
			return model.NewAppError("MovePageToWiki", "app.page.move.target_wiki_not_found", nil, "", statusCode).Wrap(err)
		}
	}

	if parentPageId != nil && *parentPageId != "" {
		parentPage, parentErr := a.GetPage(rctx, *parentPageId)
		if parentErr != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_not_found", nil,
				"", http.StatusNotFound).Wrap(parentErr)
		}

		parentWikiId, parentWikiErr := a.GetWikiIdForPage(rctx, parentPage.Id)
		if parentWikiErr != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_wiki_not_found", nil,
				"", http.StatusInternalServerError).Wrap(parentWikiErr)
		}

		if parentWikiId != targetWikiId {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_wrong_wiki", nil,
				"", http.StatusBadRequest)
		}

		if *parentPageId == pageId {
			return model.NewAppError("MovePageToWiki", "app.page.move.self_parent", nil,
				"", http.StatusBadRequest)
		}

		descendants, err := a.GetPageDescendants(rctx, pageId)
		if err != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.get_descendants_failed", nil,
				"", http.StatusInternalServerError).Wrap(err)
		}

		for _, descendant := range descendants {
			if descendant.Id == *parentPageId {
				return model.NewAppError("MovePageToWiki", "app.page.move.circular_reference", nil,
					"", http.StatusBadRequest)
			}
		}
	}

	if err := a.Srv().Store().Wiki().MovePageToWiki(pageId, targetWikiId, targetWiki.ChannelId, parentPageId); err != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Re-fetch the page to get the updated UpdateAt timestamp set by MovePageToWiki
	if refreshedPage, refreshErr := a.GetPage(RequestContextWithMaster(rctx), pageId); refreshErr == nil {
		post = refreshedPage
	}

	// Invalidate caches so other nodes see the move. When a page moves between
	// wikis whose backing channels differ, both source and target channel caches
	// must be invalidated — otherwise nodes serving the target channel will keep
	// the stale "page-not-here" view until TTL expiry.
	a.invalidateCacheForChannelPosts(page.ChannelId)
	if targetWiki.ChannelId != "" && targetWiki.ChannelId != page.ChannelId {
		a.invalidateCacheForChannelPosts(targetWiki.ChannelId)
	}

	rctx.Logger().Info("Page moved to wiki",
		mlog.String("page_id", pageId),
		mlog.String("page_title", post.Title),
		mlog.String("source_wiki_id", sourceWikiId),
		mlog.String("source_wiki_title", sourceWiki.Title),
		mlog.String("target_wiki_id", targetWikiId),
		mlog.String("target_wiki_title", targetWiki.Title),
		mlog.String("channel_id", page.ChannelId),
		mlog.String("user_id", sessionUserID(rctx)))

	var newParentId string
	if parentPageId != nil {
		newParentId = *parentPageId
	}
	opts := PageMovedBroadcastOptions{SourceWikiId: sourceWikiId}
	a.BroadcastPageMoved(pageId, page.ParentId, newParentId, targetWikiId, post.UpdateAt, opts)

	return nil
}

// DuplicatePage creates a copy of a page in the target wiki.
// targetWiki and channel are optional - if provided, avoids redundant DB fetches.
func (a *App) DuplicatePage(rctx request.CTX, sourcePage *model.Page, targetWikiId string, parentPageId *string, customTitle *string, userId string, targetWiki *model.Wiki, channel *model.Channel) (*model.Page, *model.AppError) {
	sourcePageId := sourcePage.Id
	sourcePost := sourcePage

	if targetWiki == nil {
		var err *model.AppError
		targetWiki, err = a.GetWiki(rctx, targetWikiId)
		if err != nil {
			return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.target_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
		}
	}

	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetWikiBackingChannel(rctx, targetWiki.ChannelId)
		if chanErr != nil {
			return nil, chanErr
		}
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.channel_deleted", nil, "", http.StatusBadRequest)
	}

	var duplicateTitle string
	if customTitle != nil && *customTitle != "" {
		duplicateTitle = *customTitle
	} else {
		duplicateTitle = model.PageDuplicateTitlePrefix + sourcePost.Title
		if len(duplicateTitle) > model.MaxPageTitleLength {
			duplicateTitle = duplicateTitle[:model.MaxPageTitleLength-3] + "..."
		}
	}

	var parentId string
	if parentPageId != nil {
		parentId = *parentPageId
	} else {
		parentId = sourcePage.ParentId
	}

	duplicatedPage, createErr := a.CreatePage(rctx, targetWiki.ChannelId, duplicateTitle, parentId, sourcePage.Body, userId, "", "")
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Info("Page duplicated",
		mlog.String("source_page_id", sourcePageId),
		mlog.String("duplicated_page_id", duplicatedPage.Id),
		mlog.String("target_wiki_id", targetWikiId),
		mlog.String("user_id", userId))

	a.BroadcastPagePublished(duplicatedPage, targetWikiId, "", userId)

	return duplicatedPage, nil
}

type wikiNotificationParams struct {
	postType    string
	wiki        *model.Wiki
	channel     *model.Channel
	userId      string
	extraProps  map[string]any
	userPropKey string
}

func (a *App) sendWikiNotification(rctx request.CTX, params wikiNotificationParams) {
	user, err := a.GetUser(params.userId)
	if err != nil {
		rctx.Logger().Warn("Failed to get user for wiki notification",
			mlog.String("post_type", params.postType),
			mlog.String("user_id", params.userId),
			mlog.Err(err))
		return
	}

	props := map[string]any{
		"wiki_id":          params.wiki.Id,
		"wiki_title":       params.wiki.Title,
		"channel_id":       params.channel.Id,
		"channel_name":     params.channel.Name,
		params.userPropKey: params.userId,
		"username":         user.Username,
	}

	maps.Copy(props, params.extraProps)

	systemPost := &model.Post{
		ChannelId: params.channel.Id,
		UserId:    params.userId,
		Type:      params.postType,
		Props:     props,
	}

	if _, _, err := a.CreatePost(rctx, systemPost, params.channel, model.CreatePostFlags{}); err != nil {
		rctx.Logger().Warn("Failed to create wiki notification",
			mlog.String("post_type", params.postType),
			mlog.String("wiki_id", params.wiki.Id),
			mlog.String("channel_id", params.channel.Id),
			mlog.Err(err))
	}
}

func (a *App) sendPageAddedNotification(rctx request.CTX, page *model.Page, wiki *model.Wiki, backingChannel *model.Channel, userId string, pageTitle string) {
	params := wikiNotificationParams{
		postType:    model.PostTypePageAdded,
		wiki:        wiki,
		userId:      userId,
		userPropKey: "added_user_id",
		extraProps: map[string]any{
			"page_id":    page.Id,
			"page_title": pageTitle,
		},
	}

	// Send the notification to all source channels linked to the wiki's backing channel,
	// so it appears in the channels where users see the wiki tab (not the hidden backing channel).
	links, err := a.Srv().Store().ChannelMemberLink().GetByDestination(backingChannel.Id)
	if err != nil {
		rctx.Logger().Warn("Skipping page added notification: failed to get linked source channels",
			mlog.String("backing_channel_id", backingChannel.Id),
			mlog.Err(err))
		return
	}

	if len(links) == 0 {
		rctx.Logger().Debug("Skipping page added notification: wiki has no linked source channels",
			mlog.String("backing_channel_id", backingChannel.Id))
		return
	}

	sourceChannelIds := make([]string, 0, len(links))
	for _, link := range links {
		sourceChannelIds = append(sourceChannelIds, link.SourceId)
	}
	sourceChannels, chanErr := a.GetChannels(rctx, sourceChannelIds)
	if chanErr != nil {
		rctx.Logger().Warn("Skipping page added notification: failed to batch-fetch source channels",
			mlog.String("backing_channel_id", backingChannel.Id),
			mlog.Err(chanErr))
		return
	}
	sourceChannelMap := make(map[string]*model.Channel, len(sourceChannels))
	for _, ch := range sourceChannels {
		sourceChannelMap[ch.Id] = ch
	}
	for _, link := range links {
		if sourceChannel, ok := sourceChannelMap[link.SourceId]; ok {
			params.channel = sourceChannel
			a.sendWikiNotification(rctx, params)
		}
	}
}

// setWikiIdInPostProps stores wiki_id in the post's Props for fast lookup.
// This is an optimization to avoid querying the property service on every GetWikiIdForPage call.
// Uses a direct SQL update that doesn't modify UpdateAt to avoid optimistic locking conflicts.
func (a *App) setWikiIdInPostProps(pageId, wikiId string) *model.AppError {
	if err := a.Srv().Store().Wiki().SetWikiIdInPostProps(pageId, wikiId); err != nil {
		return model.NewAppError("setWikiIdInPostProps", "app.wiki.set_wiki_id_props.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// InvalidateCacheForWikiImport invalidates caches after a wiki import completes.
// This ensures all cluster nodes see the imported wiki data.
func (a *App) InvalidateCacheForWikiImport(rctx request.CTX, channelIds []string) {
	rctx.Logger().Debug("Invalidating caches for wiki import",
		mlog.Int("channel_count", len(channelIds)))

	// Invalidate post caches for each affected channel
	for _, channelId := range channelIds {
		a.invalidateCacheForChannelPosts(channelId)
	}

	// Clear channel caches to ensure channel-level wiki queries are refreshed
	a.Srv().Store().Channel().ClearCaches()
}

// onWikiBackingChannelArchived is called when a wiki backing channel is archived.
// ChannelMemberLinks are deleted on archive — the backing channel is no longer accessible so
// source channels should not remain linked to it. Restore does not recreate links;
// callers must re-link manually if desired.
func (a *App) onWikiBackingChannelArchived(rctx request.CTX, channelID string) {
	if err := a.Srv().Store().ChannelMemberLink().DeleteByDestination(channelID); err != nil {
		rctx.Logger().Warn("Failed to clean up wiki links by destination during channel archive",
			mlog.String("channel_id", channelID), mlog.Err(err))
	}
}

// onWikiBackingChannelRestored is called when a wiki backing channel is restored.
// No-op: ChannelMemberLinks are deleted on archive and must be re-created manually.
func (a *App) onWikiBackingChannelRestored(_ request.CTX, _ string) {}

// hasPermissionToWikiBackingChannel checks if a user has the requested permission on a wiki
// backing channel (type W). GetAllChannelMembersForUser excludes wiki channels, so we fetch
// membership directly and then check roles, falling back to the session's user/team roles.
func (a *App) hasPermissionToWikiBackingChannel(rctx request.CTX, session model.Session, channelID string, permission *model.Permission) (hasPermission bool, isMember bool) {
	member, err := a.GetChannelMember(rctx, channelID, session.UserId)
	if err != nil {
		return false, false
	}
	if a.RolesGrantPermission(member.GetRoles(), permission.Id) {
		return true, true
	}
	if a.RolesGrantPermission(session.GetUserRoles(), permission.Id) {
		return true, true
	}
	return false, true
}
