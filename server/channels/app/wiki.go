// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type WikiOperation int

const (
	WikiOperationCreate WikiOperation = iota
	WikiOperationEdit
	WikiOperationDelete
)

func getWikiPermission(channelType model.ChannelType, operation WikiOperation) *model.Permission {
	permMap := map[model.ChannelType]map[WikiOperation]*model.Permission{
		model.ChannelTypeOpen: {
			WikiOperationCreate: model.PermissionCreateWikiPublicChannel,
			WikiOperationEdit:   model.PermissionEditWikiPublicChannel,
			WikiOperationDelete: model.PermissionDeleteWikiPublicChannel,
		},
		model.ChannelTypePrivate: {
			WikiOperationCreate: model.PermissionCreateWikiPrivateChannel,
			WikiOperationEdit:   model.PermissionEditWikiPrivateChannel,
			WikiOperationDelete: model.PermissionDeleteWikiPrivateChannel,
		},
	}
	return getEntityPermissionByChannelType(channelType, operation, permMap)
}

func (a *App) HasPermissionToModifyWiki(rctx request.CTX, session *model.Session, channel *model.Channel, operation WikiOperation, operationName string) *model.AppError {
	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		permission := getWikiPermission(channel.Type, operation)
		if permission == nil {
			return model.NewAppError(operationName, "api.wiki.permission.forbidden.app_error", nil, "", http.StatusForbidden)
		}
		if !a.SessionHasPermissionToChannel(rctx, *session, channel.Id, permission) {
			return model.NewAppError(operationName, "api.wiki.permission.app_error", nil, "", http.StatusForbidden)
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, err := a.GetChannelMember(rctx, channel.Id, session.UserId); err != nil {
			return model.NewAppError(operationName, "api.wiki.permission.direct_or_group_channels.app_error", nil, err.Message, http.StatusForbidden)
		}

		user, err := a.GetUser(session.UserId)
		if err != nil {
			return err
		}

		if user.IsGuest() {
			return model.NewAppError(operationName, "api.wiki.permission.direct_or_group_channels_by_guests.app_error", nil, "", http.StatusForbidden)
		}

	default:
		return model.NewAppError(operationName, "api.wiki.permission.forbidden.app_error", nil, "", http.StatusForbidden)
	}

	return nil
}

func (a *App) CreateWiki(rctx request.CTX, wiki *model.Wiki, userId string) (*model.Wiki, *model.AppError) {
	rctx.Logger().Debug("Creating wiki", mlog.String("channel_id", wiki.ChannelId), mlog.String("title", wiki.Title))

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return nil, model.NewAppError("CreateWiki", "app.wiki.create.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("CreateWiki", "app.wiki.create.deleted_channel.app_error", nil, "channel is archived", http.StatusBadRequest)
	}

	savedWiki, err := a.Srv().Store().Wiki().CreateWikiWithDefaultPage(wiki, userId)
	if err != nil {
		return nil, model.NewAppError("CreateWiki", "app.wiki.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("Wiki created successfully",
		mlog.String("wiki_id", savedWiki.Id),
		mlog.String("channel_id", wiki.ChannelId))

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
		return nil, model.NewAppError("UpdateWiki", "app.wiki.update.deleted_channel.app_error", nil, "channel is archived", http.StatusBadRequest)
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

	// Broadcast wiki update to all clients
	a.BroadcastWikiUpdated(updatedWiki)

	return updatedWiki, nil
}

func (a *App) DeleteWiki(rctx request.CTX, wikiId, userId string) *model.AppError {
	rctx.Logger().Debug("Deleting wiki", mlog.String("wiki_id", wikiId))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return wikiErr
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
	rctx.Logger().Debug("Getting wiki pages", mlog.String("wiki_id", wikiId), mlog.Int("offset", offset), mlog.Int("limit", limit))

	pages, err := a.Srv().Store().Wiki().GetPages(wikiId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetWikiPages", "app.wiki.get_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Enrich pages with property values (status, etc.)
	if len(pages) > 0 {
		postList := &model.PostList{
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

	return pages, nil
}

func (a *App) AddPageToWiki(rctx request.CTX, pageId, wikiId string) *model.AppError {
	post, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return err
	}

	pageTitle := post.GetPageTitle()

	rctx.Logger().Debug("Adding page to wiki",
		mlog.String("page_id", pageId),
		mlog.String("wiki_id", wikiId),
		mlog.String("page_title", pageTitle),
		mlog.String("page_parent_id", post.PageParentId))

	if post.Type != model.PostTypePage {
		return model.NewAppError("AddPageToWiki", "api.wiki.add.not_a_page", nil, "", http.StatusBadRequest)
	}

	wiki, getErr := a.GetWiki(rctx, wikiId)
	if getErr != nil {
		return getErr
	}

	if wiki.ChannelId != post.ChannelId {
		return model.NewAppError("AddPageToWiki", "api.wiki.add.channel_mismatch", nil, "", http.StatusBadRequest)
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
		return model.NewAppError("AddPageToWiki", "api.wiki.add.already_attached", nil, "", http.StatusConflict)
	}

	group, grpErr := a.GetPagePropertyGroup()
	if grpErr != nil {
		return model.NewAppError("AddPageToWiki", "app.wiki.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(grpErr)
	}

	wikiField, fldErr := a.GetPagePropertyFieldByName("wiki")
	if fldErr != nil {
		return fldErr
	}

	valueJSON, _ := json.Marshal(wikiId)
	value := &model.PropertyValue{
		TargetType: "post",
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

	rctx.Logger().Info("PropertyValue created successfully",
		mlog.String("page_id", pageId),
		mlog.String("wiki_id", wikiId),
		mlog.String("page_title", pageTitle),
		mlog.String("page_parent_id", post.PageParentId))

	return nil
}

func (a *App) DeleteWikiPage(rctx request.CTX, pageId, wikiId string) *model.AppError {
	rctx.Logger().Debug("Deleting wiki page", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.deleted_channel.app_error", nil, "channel is archived", http.StatusBadRequest)
	}

	post, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return err
	}

	if post.Type != model.PostTypePage {
		return model.NewAppError("DeleteWikiPage", "api.wiki.delete.not_a_page", nil, "", http.StatusBadRequest)
	}

	group, grpErr := a.GetPagePropertyGroup()
	if grpErr != nil {
		return model.NewAppError("DeleteWikiPage", "app.wiki.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(grpErr)
	}

	if deleteErr := a.Srv().Store().PropertyValue().DeleteForTarget(group.ID, "post", post.Id); deleteErr != nil {
		return model.NewAppError("DeleteWikiPage", "app.wiki.delete_page.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	if deletePageErr := a.DeletePage(rctx, pageId, wikiId); deletePageErr != nil {
		return deletePageErr
	}

	rctx.Logger().Info("Wiki page deleted", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	return nil
}

func (a *App) CreateWikiPage(rctx request.CTX, wikiId, parentId, title, content, userId, searchText string) (*model.Post, *model.AppError) {
	isChild := parentId != ""
	rctx.Logger().Debug("Creating wiki page",
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId),
		mlog.String("title", title),
		mlog.Bool("is_child_page", isChild))

	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, err
	}

	createdPage, createErr := a.CreatePage(rctx, wiki.ChannelId, title, parentId, content, userId, searchText)
	if createErr != nil {
		return nil, createErr
	}

	rctx.Logger().Debug("Page created, now linking to wiki",
		mlog.String("page_id", createdPage.Id),
		mlog.String("wiki_id", wikiId),
		mlog.Bool("is_child_page", isChild))

	if linkErr := a.AddPageToWiki(rctx, createdPage.Id, wikiId); linkErr != nil {
		rctx.Logger().Error("Failed to link page to wiki",
			mlog.String("page_id", createdPage.Id),
			mlog.String("wiki_id", wikiId),
			mlog.Bool("is_child_page", isChild),
			mlog.Err(linkErr))
		if deleteErr := a.DeletePage(rctx, createdPage.Id); deleteErr != nil {
			rctx.Logger().Warn("Failed to delete page after wiki link failure", mlog.String("page_id", createdPage.Id), mlog.Err(deleteErr))
		}
		return nil, linkErr
	}

	rctx.Logger().Info("Wiki page created and linked successfully",
		mlog.String("page_id", createdPage.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId),
		mlog.String("title", title),
		mlog.Bool("is_child_page", isChild))

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr == nil {
		a.sendPageAddedNotification(rctx, createdPage, wiki, channel, userId, title)
	} else {
		rctx.Logger().Warn("Failed to get channel for page added notification",
			mlog.String("channel_id", wiki.ChannelId),
			mlog.Err(chanErr))
	}

	a.handlePageMentions(rctx, createdPage, wiki.ChannelId, content, userId)

	return createdPage, nil
}

func (a *App) GetWikiIdForPage(rctx request.CTX, pageId string) (string, *model.AppError) {
	group, err := a.GetPagePropertyGroup()
	if err != nil {
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	wikiField, appErr := a.GetPagePropertyFieldByName("wiki")
	if appErr != nil {
		return "", appErr
	}

	opts := model.PropertyValueSearchOpts{
		TargetType: "post",
		TargetIDs:  []string{pageId},
		FieldID:    wikiField.ID,
		GroupID:    group.ID,
		PerPage:    1,
	}
	propertyValues, err := a.Srv().Store().PropertyValue().SearchPropertyValues(opts)
	if err != nil {
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_wiki_for_page.search_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(propertyValues) == 0 {
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_wiki_for_page.not_found", nil, "", http.StatusNotFound)
	}

	var wikiId string
	if jsonErr := json.Unmarshal(propertyValues[0].Value, &wikiId); jsonErr != nil {
		return "", model.NewAppError("GetWikiIdForPage", "app.wiki.get_wiki_for_page.unmarshal_failed", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	return wikiId, nil
}

type movePageContext struct {
	page       *model.Post
	sourceWiki *model.Wiki
	targetWiki *model.Wiki
	channel    *model.Channel
}

func (a *App) validateMovePageSource(rctx request.CTX, pageId, targetWikiId string) (*movePageContext, string, *model.AppError) {
	page, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return nil, "", model.NewAppError("validateMovePageSource", "app.page.move.page_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	if page.Type != model.PostTypePage {
		return nil, "", model.NewAppError("validateMovePageSource", "app.page.move.not_a_page", nil, "", http.StatusBadRequest)
	}

	sourceWikiId, err := a.GetWikiIdForPage(rctx, pageId)
	if err != nil {
		return nil, "", model.NewAppError("validateMovePageSource", "app.page.move.source_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	sourceWiki, err := a.GetWiki(rctx, sourceWikiId)
	if err != nil {
		return nil, "", model.NewAppError("validateMovePageSource", "app.page.move.source_wiki_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	ctx := &movePageContext{
		page:       page,
		sourceWiki: sourceWiki,
	}

	return ctx, sourceWikiId, nil
}

func (a *App) validateMovePageTarget(rctx request.CTX, ctx *movePageContext, targetWikiId string) *model.AppError {
	targetWiki, err := a.GetWiki(rctx, targetWikiId)
	if err != nil {
		return model.NewAppError("validateMovePageTarget", "app.page.move.target_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	if ctx.page.ChannelId != targetWiki.ChannelId {
		return model.NewAppError("validateMovePageTarget", "app.page.move.cross_channel_not_supported", nil,
			"Cross-channel moves not supported in Phase 1", http.StatusBadRequest)
	}

	if ctx.sourceWiki.ChannelId != targetWiki.ChannelId {
		return model.NewAppError("validateMovePageTarget", "app.page.move.wiki_channel_mismatch", nil, "", http.StatusInternalServerError)
	}

	channel, err := a.GetChannel(rctx, targetWiki.ChannelId)
	if err != nil {
		return model.NewAppError("validateMovePageTarget", "app.page.move.channel_not_found", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	ctx.targetWiki = targetWiki
	ctx.channel = channel
	return nil
}

func (a *App) checkMovePagePermissions(rctx request.CTX, ctx *movePageContext) *model.AppError {
	session := rctx.Session()

	if err := a.HasPermissionToModifyPage(rctx, session, ctx.page, PageOperationEdit, "checkMovePagePermissions"); err != nil {
		return err
	}

	return a.checkPageCreatePermission(rctx, session, ctx.channel)
}

func (a *App) validateMovePageParent(rctx request.CTX, pageId, targetWikiId string, parentPageId *string) *model.AppError {
	if parentPageId == nil || *parentPageId == "" {
		return nil
	}

	parentPage, err := a.GetSinglePost(rctx, *parentPageId, false)
	if err != nil {
		return model.NewAppError("validateMovePageParent", "app.page.move.parent_not_found", nil,
			"Parent page not found", http.StatusNotFound).Wrap(err)
	}

	if parentPage.Type != model.PostTypePage {
		return model.NewAppError("validateMovePageParent", "app.page.move.parent_not_a_page", nil,
			"Parent must be a page", http.StatusBadRequest)
	}

	parentWikiId, err := a.GetWikiIdForPage(rctx, *parentPageId)
	if err != nil {
		return model.NewAppError("validateMovePageParent", "app.page.move.parent_wiki_not_found", nil,
			"Could not determine parent's wiki", http.StatusInternalServerError).Wrap(err)
	}

	if parentWikiId != targetWikiId {
		return model.NewAppError("validateMovePageParent", "app.page.move.parent_wrong_wiki", nil,
			"Parent page must be in target wiki", http.StatusBadRequest)
	}

	if *parentPageId == pageId {
		return model.NewAppError("validateMovePageParent", "app.page.move.self_parent", nil,
			"Cannot move page under itself", http.StatusBadRequest)
	}

	descendants, err := a.GetPageDescendants(rctx, pageId)
	if err != nil {
		return model.NewAppError("validateMovePageParent", "app.page.move.get_descendants_failed", nil,
			"Failed to get page descendants", http.StatusInternalServerError).Wrap(err)
	}

	for _, descendant := range descendants.Posts {
		if descendant.Id == *parentPageId {
			return model.NewAppError("validateMovePageParent", "app.page.move.circular_reference", nil,
				"Cannot move page under its own descendant", http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) MovePageToWiki(rctx request.CTX, pageId, targetWikiId string, parentPageId *string) *model.AppError {
	ctx, sourceWikiId, err := a.validateMovePageSource(rctx, pageId, targetWikiId)
	if err != nil {
		return err
	}

	if sourceWikiId == targetWikiId && parentPageId == nil {
		rctx.Logger().Debug("Same-wiki move without parent change has no effect",
			mlog.String("page_id", pageId),
			mlog.String("wiki_id", targetWikiId))
		return nil
	}

	if err := a.validateMovePageTarget(rctx, ctx, targetWikiId); err != nil {
		return err
	}

	if err := a.checkMovePagePermissions(rctx, ctx); err != nil {
		return err
	}

	if err := a.validateMovePageParent(rctx, pageId, targetWikiId, parentPageId); err != nil {
		return err
	}

	if err := a.Srv().Store().Wiki().MovePageToWiki(pageId, targetWikiId, parentPageId); err != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	pageTitle := ctx.page.GetPageTitle()
	rctx.Logger().Info("Page moved to wiki",
		mlog.String("page_id", pageId),
		mlog.String("page_title", pageTitle),
		mlog.String("source_wiki_id", sourceWikiId),
		mlog.String("source_wiki_title", ctx.sourceWiki.Title),
		mlog.String("target_wiki_id", targetWikiId),
		mlog.String("target_wiki_title", ctx.targetWiki.Title),
		mlog.String("channel_id", ctx.page.ChannelId),
		mlog.String("user_id", rctx.Session().UserId))

	// Broadcast page_published event to target wiki so other users see the new page
	// Pass source wiki ID so clients can remove the page from the source wiki
	a.BroadcastPagePublished(ctx.page, targetWikiId, ctx.page.ChannelId, "", rctx.Session().UserId, sourceWikiId)

	// Also broadcast page_moved event with parent change information
	var newParentId string
	if parentPageId != nil {
		newParentId = *parentPageId
	}
	a.BroadcastPageMoved(pageId, ctx.page.PageParentId, newParentId, targetWikiId, ctx.page.ChannelId, ctx.page.UpdateAt)

	return nil
}

func (a *App) DuplicatePage(rctx request.CTX, sourcePageId, targetWikiId string, parentPageId *string, customTitle *string, userId string) (*model.Post, *model.AppError) {
	sourcePage, err := a.GetSinglePost(rctx, sourcePageId, false)
	if err != nil {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.source_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	if sourcePage.Type != model.PostTypePage {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.not_a_page", nil, "", http.StatusBadRequest)
	}

	sourceContent, contentErr := a.Srv().Store().PageContent().Get(sourcePageId)
	if contentErr != nil {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.content_not_found", nil, "", http.StatusInternalServerError).Wrap(contentErr)
	}

	targetWiki, err := a.GetWiki(rctx, targetWikiId)
	if err != nil {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.target_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	if targetWiki.ChannelId != sourcePage.ChannelId {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.cross_channel_not_supported", nil, "", http.StatusBadRequest)
	}

	channel, chanErr := a.GetChannel(rctx, targetWiki.ChannelId)
	if chanErr != nil {
		return nil, chanErr
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("DuplicatePage", "app.page.duplicate.channel_deleted", nil, "", http.StatusBadRequest)
	}

	originalTitle := sourcePage.GetPageTitle()
	var duplicateTitle string
	if customTitle != nil && *customTitle != "" {
		duplicateTitle = *customTitle
	} else {
		duplicateTitle = "Copy of " + originalTitle
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
	duplicatedPage, createErr := a.CreatePage(rctx, targetWiki.ChannelId, duplicateTitle, parentId, contentJSON, userId, sourceContent.SearchText)
	if createErr != nil {
		return nil, createErr
	}

	if linkErr := a.AddPageToWiki(rctx, duplicatedPage.Id, targetWikiId); linkErr != nil {
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

func (a *App) sendWikiAddedNotification(rctx request.CTX, wiki *model.Wiki, channel *model.Channel, userId string) {
	user, err := a.GetUser(userId)
	if err != nil {
		rctx.Logger().Warn("Failed to get user for wiki added notification",
			mlog.String("user_id", userId),
			mlog.Err(err))
		return
	}

	systemPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Type:      model.PostTypeWikiAdded,
		Props: map[string]any{
			"wiki_id":       wiki.Id,
			"wiki_title":    wiki.Title,
			"channel_id":    channel.Id,
			"channel_name":  channel.Name,
			"added_user_id": userId,
			"username":      user.Username,
		},
	}

	if _, err := a.CreatePost(rctx, systemPost, channel, model.CreatePostFlags{}); err != nil {
		rctx.Logger().Warn("Failed to create wiki added system message",
			mlog.String("wiki_id", wiki.Id),
			mlog.String("channel_id", channel.Id),
			mlog.Err(err))
	}
}

func (a *App) sendWikiDeletedNotification(rctx request.CTX, wiki *model.Wiki, channel *model.Channel, userId string) {
	user, err := a.GetUser(userId)
	if err != nil {
		rctx.Logger().Warn("Failed to get user for wiki deleted notification",
			mlog.String("user_id", userId),
			mlog.Err(err))
		return
	}

	systemPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Type:      model.PostTypeWikiDeleted,
		Props: map[string]any{
			"wiki_id":         wiki.Id,
			"wiki_title":      wiki.Title,
			"channel_id":      channel.Id,
			"channel_name":    channel.Name,
			"deleted_user_id": userId,
			"username":        user.Username,
		},
	}

	if _, err := a.CreatePost(rctx, systemPost, channel, model.CreatePostFlags{}); err != nil {
		rctx.Logger().Warn("Failed to create wiki deleted system message",
			mlog.String("wiki_id", wiki.Id),
			mlog.String("channel_id", channel.Id),
			mlog.Err(err))
	}
}

func (a *App) sendPageAddedNotification(rctx request.CTX, page *model.Post, wiki *model.Wiki, channel *model.Channel, userId string, pageTitle string) {
	user, err := a.GetUser(userId)
	if err != nil {
		rctx.Logger().Warn("Failed to get user for page added notification",
			mlog.String("user_id", userId),
			mlog.Err(err))
		return
	}

	systemPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Type:      model.PostTypePageAdded,
		Props: map[string]any{
			"page_id":       page.Id,
			"page_title":    pageTitle,
			"wiki_id":       wiki.Id,
			"wiki_title":    wiki.Title,
			"channel_id":    channel.Id,
			"channel_name":  channel.Name,
			"added_user_id": userId,
			"username":      user.Username,
		},
	}

	if _, err := a.CreatePost(rctx, systemPost, channel, model.CreatePostFlags{}); err != nil {
		rctx.Logger().Warn("Failed to create page added system message",
			mlog.String("page_id", page.Id),
			mlog.String("wiki_id", wiki.Id),
			mlog.String("channel_id", channel.Id),
			mlog.Err(err))
	}
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

	return movedWiki, nil
}
