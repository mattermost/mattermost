// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) CreateWiki(rctx request.CTX, wiki *model.Wiki, userId string) (*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Creating wiki", mlog.String("channel_id", wiki.ChannelId), mlog.String("title", wiki.Title))

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("CreateWiki", "app.wiki.create.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("CreateWiki", "app.wiki.create.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	savedWiki, err := a.Srv().Store().Wiki().CreateWikiWithDefaultPage(wiki, userId)
	if err != nil {
		return nil, model.NewAppError("CreateWiki", "app.wiki.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("Wiki created successfully",
		mlog.String("wiki_id", savedWiki.Id),
		mlog.String("channel_id", wiki.ChannelId))

	// Invalidate cache so other nodes see the new wiki
	a.invalidateCacheForChannelPosts(wiki.ChannelId)

	// Broadcast wiki creation to all clients in the channel
	a.BroadcastWikiCreated(savedWiki)

	a.sendWikiAddedNotification(rctx, savedWiki, channel, userId)

	return savedWiki, nil
}

func (a *App) GetWiki(rctx request.CTX, wikiId string) (*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Getting wiki", mlog.String("wiki_id", wikiId))

	wiki, err := a.Srv().Store().Wiki().Get(wikiId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("GetWiki", "app.wiki.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetWiki", "app.wiki.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return wiki, nil
}

func (a *App) GetWikisForChannel(rctx request.CTX, channelId string, includeDeleted bool) ([]*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Getting wikis for channel", mlog.String("channel_id", channelId), mlog.Bool("include_deleted", includeDeleted))

	wikis, err := a.Srv().Store().Wiki().GetForChannel(channelId, includeDeleted)
	if err != nil {
		return nil, model.NewAppError("GetWikisForChannel", "app.wiki.get_for_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return wikis, nil
}

func (a *App) UpdateWiki(rctx request.CTX, wiki *model.Wiki) (*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Updating wiki", mlog.String("wiki_id", wiki.Id), mlog.String("title", wiki.Title))

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("UpdateWiki", "app.wiki.update.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("UpdateWiki", "app.wiki.update.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	wiki.PreUpdate()
	if appErr := wiki.IsValid(); appErr != nil {
		return nil, appErr
	}

	updatedWiki, err := a.Srv().Store().Wiki().Update(wiki)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("UpdateWiki", "app.wiki.update.app_error", nil, "", http.StatusNotFound).Wrap(err)
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

	if err := a.Srv().Store().Wiki().DeleteAllPagesForWiki(wikiId); err != nil {
		return model.NewAppError("DeleteWiki", "app.wiki.delete.delete_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	err := a.Srv().Store().Wiki().Delete(wikiId, false)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return model.NewAppError("DeleteWiki", "app.wiki.delete.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeleteWiki", "app.wiki.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Invalidate cache so other nodes see the deletion
	a.invalidateCacheForChannelPosts(wiki.ChannelId)

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr == nil {
		a.sendWikiDeletedNotification(rctx, wiki, channel, userId)
	} else {
		rctx.Logger().Warn("Failed to get channel for wiki deleted notification",
			mlog.String("channel_id", wiki.ChannelId),
			mlog.Err(chanErr))
	}

	return nil
}

func (a *App) GetWikiPages(rctx request.CTX, wikiId string, offset, limit int) ([]*model.Post, *model.AppError) {
	start := time.Now()
	defer func() {
		if a.Metrics() != nil {
			a.Metrics().ObserveWikiHierarchyLoad(time.Since(start).Seconds())
		}
	}()

	rctx.Logger().Debug("Getting wiki pages", mlog.String("wiki_id", wikiId), mlog.Int("offset", offset), mlog.Int("limit", limit))

	pages, err := a.Srv().Store().Wiki().GetPages(wikiId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetWikiPages", "app.wiki.get_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Enrich pages with property values (status, etc.)
	var postList *model.PostList
	if len(pages) > 0 {
		postList = &model.PostList{
			Posts: make(map[string]*model.Post),
			Order: make([]string, 0, len(pages)),
		}
		for _, page := range pages {
			postList.Posts[page.Id] = page
			postList.Order = append(postList.Order, page.Id)
		}
		if enrichErr := a.EnrichPagesWithProperties(rctx, postList); enrichErr != nil {
			return nil, enrichErr
		}
	}

	if a.Metrics() != nil && postList != nil {
		maxDepth := a.calculateMaxDepthFromPostList(postList)
		a.Metrics().ObserveWikiHierarchyDepth(float64(maxDepth))
		a.Metrics().ObserveWikiPagesPerChannel(float64(len(postList.Posts)))
	}

	return pages, nil
}

// AddPageToWiki associates a page with a wiki.
// page is optional - if provided, avoids a redundant DB fetch.
func (a *App) AddPageToWiki(rctx request.CTX, pageId, wikiId string, page *model.Post) *model.AppError {
	if page == nil {
		var err *model.AppError
		page, err = a.GetPage(rctx, pageId)
		if err != nil {
			return model.NewAppError("AddPageToWiki", "app.wiki.add.not_a_page", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}
	post := page

	pageTitle := post.GetPageTitle()

	rctx.Logger().Debug("Adding page to wiki",
		mlog.String("page_id", pageId),
		mlog.String("wiki_id", wikiId),
		mlog.String("page_title", pageTitle),
		mlog.String("page_parent_id", post.PageParentId))

	wiki, getErr := a.GetWiki(rctx, wikiId)
	if getErr != nil {
		return getErr
	}

	if wiki.ChannelId != post.ChannelId {
		return model.NewAppError("AddPageToWiki", "app.wiki.add.channel_mismatch", nil, "", http.StatusBadRequest)
	}

	existingWikiId, wikiErr := a.GetWikiIdForPage(rctx, pageId)
	if wikiErr != nil {
		var nfErr *model.AppError
		if errors.As(wikiErr, &nfErr) && nfErr.StatusCode == http.StatusNotFound {
			rctx.Logger().Debug("No existing wiki association found for page - will create new",
				mlog.String("page_id", pageId),
				mlog.String("wiki_id", wikiId))
		} else {
			return wikiErr
		}
	} else {
		if existingWikiId == wikiId {
			rctx.Logger().Debug("Page already associated with this wiki",
				mlog.String("page_id", pageId),
				mlog.String("wiki_id", wikiId))
			return nil
		}
		return model.NewAppError("AddPageToWiki", "app.wiki.add.already_attached", nil, "", http.StatusConflict)
	}

	group, grpErr := a.GetPagePropertyGroup()
	if grpErr != nil {
		return model.NewAppError("AddPageToWiki", "app.wiki.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(grpErr)
	}

	wikiField, fldErr := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", "wiki")
	if fldErr != nil {
		return model.NewAppError("AddPageToWiki", "app.wiki.get_wiki_field.app_error", nil, "", http.StatusInternalServerError).Wrap(fldErr)
	}

	valueJSON, jsonErr := json.Marshal(wikiId)
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to marshal wiki ID", mlog.String("wiki_id", wikiId), mlog.Err(jsonErr))
		return model.NewAppError("AddPageToWiki", "app.wiki.marshal_wiki_id.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	value := &model.PropertyValue{
		TargetType: model.PropertyValueTargetTypePost,
		TargetID:   pageId,
		GroupID:    group.ID,
		FieldID:    wikiField.ID,
		Value:      valueJSON,
	}

	rctx.Logger().Debug("Creating PropertyValue",
		mlog.String("page_id", pageId),
		mlog.String("wiki_id", wikiId),
		mlog.String("group_id", group.ID),
		mlog.String("field_id", wikiField.ID),
		mlog.String("value_json", string(valueJSON)))

	_, createErr := a.Srv().Store().PropertyValue().Create(value)
	if createErr != nil {
		rctx.Logger().Error("Failed to create PropertyValue",
			mlog.Err(createErr),
			mlog.String("page_id", pageId),
			mlog.String("wiki_id", wikiId),
			mlog.String("page_title", pageTitle))
		return model.NewAppError("AddPageToWiki", "app.wiki.add_page.app_error", nil, "", http.StatusInternalServerError).Wrap(createErr)
	}

	// Store wiki_id in Post.Props for fast lookup (optimization to avoid property service queries)
	if err := a.setWikiIdInPostProps(rctx, pageId, wikiId); err != nil {
		rctx.Logger().Warn("Failed to store wiki_id in Post.Props (non-fatal)",
			mlog.String("page_id", pageId),
			mlog.String("wiki_id", wikiId),
			mlog.Err(err))
	}

	rctx.Logger().Debug("PropertyValue created successfully",
		mlog.String("page_id", pageId),
		mlog.String("wiki_id", wikiId),
		mlog.String("page_title", pageTitle),
		mlog.String("page_parent_id", post.PageParentId))

	return nil
}

// DeleteWikiPage deletes a page from a wiki.
// wiki and channel are optional - if provided, avoids redundant DB fetches.
func (a *App) DeleteWikiPage(rctx request.CTX, page *model.Post, wikiId string, wiki *model.Wiki, channel *model.Channel) *model.AppError {
	pageId := page.Id

	rctx.Logger().Debug("Deleting wiki page", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	if wiki == nil {
		var wikiErr *model.AppError
		wiki, wikiErr = a.GetWiki(rctx, wikiId)
		if wikiErr != nil {
			return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
		}
	}

	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetChannel(rctx, wiki.ChannelId)
		if chanErr != nil {
			return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
		}
	}

	if channel.DeleteAt != 0 {
		return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.deleted_channel.app_error", nil, "", http.StatusBadRequest)
	}

	group, grpErr := a.GetPagePropertyGroup()
	if grpErr != nil {
		return model.NewAppError("DeleteWikiPage", "app.wiki.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(grpErr)
	}

	if deleteErr := a.Srv().Store().PropertyValue().DeleteForTarget(group.ID, "post", pageId); deleteErr != nil {
		return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	if deletePageErr := a.DeletePage(rctx, page, wikiId); deletePageErr != nil {
		return deletePageErr
	}

	rctx.Logger().Debug("Wiki page deleted", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	return nil
}

// CreateWikiPage creates a new page in a wiki.
// If pageID is provided, it will be used as the page's ID (for publishing drafts with unified IDs).
// If pageID is empty, a new ID will be generated.
func (a *App) CreateWikiPage(rctx request.CTX, wikiId, parentId, title, content, userId, searchText, pageID string) (*model.Post, *model.AppError) {
	isChild := parentId != ""
	rctx.Logger().Debug("CreateWikiPage entry",
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId),
		mlog.String("title", title),
		mlog.String("page_id", pageID),
		mlog.Bool("is_child_page", isChild))

	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, err
	}

	// Fetch channel once and reuse for page creation, notification, and mentions
	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("CreateWikiPage", "app.wiki.create_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	createdPage, createErr := a.CreatePageWithChannel(rctx, channel, title, parentId, content, userId, searchText, pageID)
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page created, now linking to wiki",
		mlog.String("page_id", createdPage.Id),
		mlog.String("wiki_id", wikiId),
		mlog.Bool("is_child_page", isChild))

	if linkErr := a.AddPageToWiki(rctx, createdPage.Id, wikiId, createdPage); linkErr != nil {
		rctx.Logger().Error("Failed to link page to wiki",
			mlog.String("page_id", createdPage.Id),
			mlog.String("wiki_id", wikiId),
			mlog.Bool("is_child_page", isChild),
			mlog.Err(linkErr))
		if deleteErr := a.DeletePage(rctx, createdPage, ""); deleteErr != nil {
			rctx.Logger().Warn("Failed to delete page after wiki link failure", mlog.String("page_id", createdPage.Id), mlog.Err(deleteErr))
		}
		return nil, linkErr
	}

	// Add wiki_id to the in-memory post so subsequent updates don't lose it
	createdPage.AddProp(model.PagePropsWikiID, wikiId)

	rctx.Logger().Debug("Wiki page created and linked successfully",
		mlog.String("page_id", createdPage.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId),
		mlog.String("title", title),
		mlog.Bool("is_child_page", isChild))

	a.sendPageAddedNotification(rctx, createdPage, wiki, channel, userId, title)

	a.handlePageMentions(rctx, createdPage, channel, content, userId)

	return createdPage, nil
}

func (a *App) GetWikiIdForPage(rctx request.CTX, pageId string) (string, *model.AppError) {
	post, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_wiki_for_page.post_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	return a.GetWikiIdForPost(rctx, post)
}

// GetWikiIdForPost returns the wiki ID for a page post that's already been fetched.
// Use this variant when you already have the post to avoid an extra DB query.
func (a *App) GetWikiIdForPost(rctx request.CTX, post *model.Post) (string, *model.AppError) {
	if post == nil {
		return "", model.NewAppError("GetWikiIdForPost", "app.wiki.get_wiki_for_post.nil_post", nil, "", http.StatusBadRequest)
	}

	// Fast path: check Props cache
	if wikiId, ok := post.Props[model.PagePropsWikiID].(string); ok && wikiId != "" {
		return wikiId, nil
	}

	// Fallback: query PropertyValues (source of truth)
	wikiId, propErr := a.getWikiIdFromPropertyValues(rctx, post.Id)
	if propErr != nil {
		rctx.Logger().Debug("GetWikiIdForPost: PropertyValues lookup failed",
			mlog.String("page_id", post.Id),
			mlog.Err(propErr))
		return "", model.NewAppError("GetWikiIdForPost", "app.wiki.get_wiki_for_post.not_found", nil, "", http.StatusNotFound)
	}

	return wikiId, nil
}

func (a *App) getWikiIdFromPropertyValues(rctx request.CTX, pageId string) (string, error) {
	group, grpErr := a.GetPagePropertyGroup()
	if grpErr != nil {
		return "", grpErr
	}

	wikiField, fldErr := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", "wiki")
	if fldErr != nil {
		return "", fldErr
	}

	searchOpts := model.PropertyValueSearchOpts{
		TargetIDs: []string{pageId},
		FieldID:   wikiField.ID,
		PerPage:   1,
	}

	values, err := a.Srv().propertyService.SearchPropertyValues(group.ID, searchOpts)
	if err != nil {
		return "", err
	}

	if len(values) == 0 {
		return "", errors.New("no wiki property value found for page")
	}

	var wikiId string
	if jsonErr := json.Unmarshal(values[0].Value, &wikiId); jsonErr != nil {
		return "", jsonErr
	}

	if wikiId == "" {
		return "", errors.New("wiki_id is empty")
	}

	return wikiId, nil
}

// MovePageToWiki moves a page to a different wiki (or different parent in same wiki).
// sourceWikiId is optional - if empty, it will be fetched from the page properties.
// sourceWiki and targetWiki are optional - if provided, avoids redundant DB fetches.
func (a *App) MovePageToWiki(rctx request.CTX, page *model.Post, targetWikiId string, parentPageId *string, sourceWikiId string, sourceWiki, targetWiki *model.Wiki) *model.AppError {
	pageId := page.Id
	post := page

	// Use provided sourceWikiId or fetch if not provided
	if sourceWikiId == "" {
		var err *model.AppError
		sourceWikiId, err = a.GetWikiIdForPage(rctx, pageId)
		if err != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.source_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
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
			return model.NewAppError("MovePageToWiki", "app.page.move.target_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
		}
	}

	if page.ChannelId != targetWiki.ChannelId {
		return model.NewAppError("MovePageToWiki", "app.page.move.cross_channel_not_supported", nil,
			"Cross-channel moves not supported in Phase 1", http.StatusBadRequest)
	}

	if sourceWiki.ChannelId != targetWiki.ChannelId {
		return model.NewAppError("MovePageToWiki", "app.page.move.wiki_channel_mismatch", nil, "", http.StatusInternalServerError)
	}

	if parentPageId != nil && *parentPageId != "" {
		parentPage, parentErr := a.GetPage(rctx, *parentPageId)
		if parentErr != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_not_found", nil,
				"Parent page not found", http.StatusNotFound).Wrap(parentErr)
		}

		// Try to get parent's wiki ID from Props first (fast path)
		var parentWikiId string
		if propWikiId, ok := parentPage.Props[model.PagePropsWikiID].(string); ok && propWikiId != "" {
			parentWikiId = propWikiId
		} else {
			// Fallback to property values lookup
			var wikiErr *model.AppError
			parentWikiId, wikiErr = a.GetWikiIdForPage(rctx, parentPage.Id)
			if wikiErr != nil {
				return model.NewAppError("MovePageToWiki", "app.page.move.parent_wiki_not_found", nil,
					"Could not determine parent's wiki", http.StatusInternalServerError).Wrap(wikiErr)
			}
		}

		if parentWikiId != targetWikiId {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_wrong_wiki", nil,
				"Parent page must be in target wiki", http.StatusBadRequest)
		}

		if *parentPageId == pageId {
			return model.NewAppError("MovePageToWiki", "app.page.move.self_parent", nil,
				"Cannot move page under itself", http.StatusBadRequest)
		}

		descendants, err := a.GetPageDescendants(rctx, pageId)
		if err != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.get_descendants_failed", nil,
				"Failed to get page descendants", http.StatusInternalServerError).Wrap(err)
		}

		for _, descendant := range descendants.Posts {
			if descendant.Id == *parentPageId {
				return model.NewAppError("MovePageToWiki", "app.page.move.circular_reference", nil,
					"Cannot move page under its own descendant", http.StatusBadRequest)
			}
		}
	}

	if err := a.Srv().Store().Wiki().MovePageToWiki(pageId, targetWikiId, parentPageId); err != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Invalidate cache so other nodes see the move
	a.invalidateCacheForChannelPosts(page.ChannelId)

	pageTitle := post.GetPageTitle()
	rctx.Logger().Info("Page moved to wiki",
		mlog.String("page_id", pageId),
		mlog.String("page_title", pageTitle),
		mlog.String("source_wiki_id", sourceWikiId),
		mlog.String("source_wiki_title", sourceWiki.Title),
		mlog.String("target_wiki_id", targetWikiId),
		mlog.String("target_wiki_title", targetWiki.Title),
		mlog.String("channel_id", page.ChannelId),
		mlog.String("user_id", rctx.Session().UserId))

	var newParentId string
	if parentPageId != nil {
		newParentId = *parentPageId
	}
	a.BroadcastPageMoved(pageId, page.PageParentId, newParentId, targetWikiId, page.ChannelId, post.UpdateAt, sourceWikiId)

	return nil
}

// DuplicatePage creates a copy of a page in the target wiki.
// targetWiki and channel are optional - if provided, avoids redundant DB fetches.
func (a *App) DuplicatePage(rctx request.CTX, sourcePage *model.Post, targetWikiId string, parentPageId *string, customTitle *string, userId string, targetWiki *model.Wiki, channel *model.Channel) (*model.Post, *model.AppError) {
	sourcePageId := sourcePage.Id
	sourcePost := sourcePage

	sourceContent, contentErr := a.Srv().Store().Page().GetPageContent(sourcePageId)
	if contentErr != nil {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.content_not_found", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	if targetWiki == nil {
		var err *model.AppError
		targetWiki, err = a.GetWiki(rctx, targetWikiId)
		if err != nil {
			return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.target_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
		}
	}

	if targetWiki.ChannelId != sourcePage.ChannelId {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.cross_channel_not_supported", nil, "", http.StatusBadRequest)
	}

	if channel == nil {
		var chanErr *model.AppError
		channel, chanErr = a.GetChannel(rctx, targetWiki.ChannelId)
		if chanErr != nil {
			return nil, chanErr
		}
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.channel_deleted", nil, "", http.StatusBadRequest)
	}

	originalTitle := sourcePost.GetPageTitle()
	var duplicateTitle string
	if customTitle != nil && *customTitle != "" {
		duplicateTitle = *customTitle
	} else {
		duplicateTitle = model.PageDuplicateTitlePrefix + originalTitle
		if len(duplicateTitle) > model.MaxPageTitleLength {
			duplicateTitle = duplicateTitle[:model.MaxPageTitleLength-3] + "..."
		}
	}

	var parentId string
	if parentPageId != nil {
		parentId = *parentPageId
	} else {
		parentId = sourcePage.PageParentId
	}

	contentJSON, jsonErr := sourceContent.GetDocumentJSON()
	if jsonErr != nil {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.serialize_content_failed", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	duplicatedPage, createErr := a.CreatePage(rctx, targetWiki.ChannelId, duplicateTitle, parentId, contentJSON, userId, sourceContent.SearchText, "")
	if createErr != nil {
		return nil, createErr
	}

	if linkErr := a.AddPageToWiki(rctx, duplicatedPage.Id, targetWikiId, duplicatedPage); linkErr != nil {
		if _, delErr := a.DeletePost(rctx, duplicatedPage.Id, userId); delErr != nil {
			rctx.Logger().Error("Failed to delete page after AddPageToWiki failed",
				mlog.String("page_id", duplicatedPage.Id),
				mlog.Err(delErr))
		}
		return nil, linkErr
	}

	rctx.Logger().Info("Page duplicated",
		mlog.String("source_page_id", sourcePageId),
		mlog.String("duplicated_page_id", duplicatedPage.Id),
		mlog.String("target_wiki_id", targetWikiId),
		mlog.String("user_id", userId))

	a.BroadcastPagePublished(duplicatedPage, targetWikiId, targetWiki.ChannelId, "", userId)

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

func (a *App) sendWikiAddedNotification(rctx request.CTX, wiki *model.Wiki, channel *model.Channel, userId string) {
	a.sendWikiNotification(rctx, wikiNotificationParams{
		postType:    model.PostTypeWikiAdded,
		wiki:        wiki,
		channel:     channel,
		userId:      userId,
		userPropKey: "added_user_id",
	})
}

func (a *App) sendWikiDeletedNotification(rctx request.CTX, wiki *model.Wiki, channel *model.Channel, userId string) {
	a.sendWikiNotification(rctx, wikiNotificationParams{
		postType:    model.PostTypeWikiDeleted,
		wiki:        wiki,
		channel:     channel,
		userId:      userId,
		userPropKey: "deleted_user_id",
	})
}

func (a *App) sendPageAddedNotification(rctx request.CTX, page *model.Post, wiki *model.Wiki, channel *model.Channel, userId string, pageTitle string) {
	a.sendWikiNotification(rctx, wikiNotificationParams{
		postType:    model.PostTypePageAdded,
		wiki:        wiki,
		channel:     channel,
		userId:      userId,
		userPropKey: "added_user_id",
		extraProps: map[string]any{
			"page_id":    page.Id,
			"page_title": pageTitle,
		},
	})
}

func (a *App) MoveWikiToChannel(rctx request.CTX, wiki *model.Wiki, targetChannel *model.Channel, userId string) (*model.Wiki, *model.AppError) {
	if wiki.ChannelId == targetChannel.Id {
		return nil, model.NewAppError(
			"App.MoveWikiToChannel",
			"app.wiki.move_wiki_to_channel.same_channel.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
	}

	sourceChannel, err := a.GetChannel(rctx, wiki.ChannelId)
	if err != nil {
		return nil, err
	}

	if sourceChannel.TeamId != targetChannel.TeamId {
		return nil, model.NewAppError(
			"App.MoveWikiToChannel",
			"app.wiki.move_wiki_to_channel.cross_team_not_supported.app_error",
			nil,
			"cross-team moves not supported",
			http.StatusBadRequest,
		)
	}

	movedWiki, storeErr := a.Srv().Store().Wiki().MoveWikiToChannel(
		wiki.Id,
		targetChannel.Id,
		model.GetMillis(),
	)
	if storeErr != nil {
		return nil, model.NewAppError(
			"App.MoveWikiToChannel",
			"app.wiki.move_wiki.store_error.app_error",
			nil,
			"",
			http.StatusInternalServerError,
		).Wrap(storeErr)
	}

	rctx.Logger().Info(
		"Wiki moved to channel",
		mlog.String("wiki_id", wiki.Id),
		mlog.String("wiki_title", wiki.Title),
		mlog.String("source_channel_id", sourceChannel.Id),
		mlog.String("target_channel_id", targetChannel.Id),
		mlog.String("user_id", userId),
	)

	// Broadcast wiki moved event to both source and target channels
	a.BroadcastWikiMoved(movedWiki, sourceChannel.Id, targetChannel.Id)

	return movedWiki, nil
}

// setWikiIdInPostProps stores wiki_id in the post's Props for fast lookup.
// This is an optimization to avoid querying the property service on every GetWikiIdForPage call.
// Uses a direct SQL update that doesn't modify UpdateAt to avoid optimistic locking conflicts.
func (a *App) setWikiIdInPostProps(rctx request.CTX, pageId, wikiId string) *model.AppError {
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
