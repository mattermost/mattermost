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

type WikiOperation string

const (
	WikiOperationCreate WikiOperation = "create"
	WikiOperationEdit   WikiOperation = "edit"
	WikiOperationDelete WikiOperation = "delete"
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
	if ops, ok := permMap[channelType]; ok {
		return ops[operation]
	}
	return nil
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
	return updatedWiki, nil
}

func (a *App) DeleteWiki(rctx request.CTX, wikiId string) *model.AppError {
	rctx.Logger().Debug("Deleting wiki", mlog.String("wiki_id", wikiId))

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
	return nil
}

func (a *App) GetWikiPages(rctx request.CTX, wikiId string, offset, limit int) ([]*model.Post, *model.AppError) {
	rctx.Logger().Debug("Getting wiki pages", mlog.String("wiki_id", wikiId), mlog.Int("offset", offset), mlog.Int("limit", limit))

	pages, err := a.Srv().Store().Wiki().GetPages(wikiId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetWikiPages", "app.wiki.get_pages.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return pages, nil
}

func (a *App) AddPageToWiki(rctx request.CTX, pageId, wikiId string) *model.AppError {
	rctx.Logger().Debug("Adding page to wiki", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	post, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return err
	}
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
		} else {
			return wikiErr
		}
	} else {
		if existingWikiId == wikiId {
			return nil
		}
		return model.NewAppError("AddPageToWiki", "api.wiki.add.already_attached", nil, "", http.StatusConflict)
	}

	valueJSON, _ := json.Marshal(wikiId)
	value := &model.PropertyValue{
		TargetType: "post",
		TargetID:   pageId,
		GroupID:    model.WikiPropertyGroupID,
		FieldID:    model.WikiPropertyFieldID,
		Value:      valueJSON,
	}

	_, createErr := a.Srv().Store().PropertyValue().Create(value)
	if createErr != nil {
		rctx.Logger().Error("Failed to create PropertyValue", mlog.Err(createErr), mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))
		return model.NewAppError("AddPageToWiki", "app.wiki.add_page.app_error", nil, "", http.StatusInternalServerError).Wrap(createErr)
	}
	return nil
}

func (a *App) DeletePageFromWiki(rctx request.CTX, pageId, wikiId string) *model.AppError {
	rctx.Logger().Debug("Deleting page from wiki", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	wiki, wikiErr := a.GetWiki(rctx, wikiId)
	if wikiErr != nil {
		return model.NewAppError("DeletePageFromWiki", "app.wiki.delete_page.wiki_not_found.app_error", nil, "", http.StatusNotFound).Wrap(wikiErr)
	}

	channel, chanErr := a.GetChannel(rctx, wiki.ChannelId)
	if chanErr != nil {
		return model.NewAppError("DeletePageFromWiki", "app.wiki.delete_page.channel_not_found.app_error", nil, "", http.StatusNotFound).Wrap(chanErr)
	}

	if channel.DeleteAt != 0 {
		return model.NewAppError("DeletePageFromWiki", "app.wiki.delete_page.deleted_channel.app_error", nil, "channel is archived", http.StatusBadRequest)
	}

	post, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return err
	}

	if post.Type != model.PostTypePage {
		return model.NewAppError("DeletePageFromWiki", "api.wiki.delete.not_a_page", nil, "", http.StatusBadRequest)
	}

	if deleteErr := a.Srv().Store().PropertyValue().DeleteForTarget(model.WikiPropertyGroupID, "post", post.Id); deleteErr != nil {
		return model.NewAppError("DeletePageFromWiki", "app.wiki.delete_page.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	if deletePageErr := a.DeletePage(rctx, pageId); deletePageErr != nil {
		return deletePageErr
	}

	rctx.Logger().Info("Page deleted from wiki", mlog.String("page_id", pageId), mlog.String("wiki_id", wikiId))

	return nil
}

func (a *App) CreateWikiPage(rctx request.CTX, wikiId, parentId, title, content, userId, searchText string) (*model.Post, *model.AppError) {
	rctx.Logger().Debug("Creating wiki page",
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId))

	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, err
	}

	createdPage, createErr := a.CreatePage(rctx, wiki.ChannelId, title, parentId, content, userId, searchText)
	if createErr != nil {
		return nil, createErr
	}

	if linkErr := a.AddPageToWiki(rctx, createdPage.Id, wikiId); linkErr != nil {
		if deleteErr := a.DeletePage(rctx, createdPage.Id); deleteErr != nil {
			rctx.Logger().Warn("Failed to delete page after wiki link failure", mlog.String("page_id", createdPage.Id), mlog.Err(deleteErr))
		}
		return nil, linkErr
	}

	rctx.Logger().Info("Wiki page created",
		mlog.String("page_id", createdPage.Id),
		mlog.String("wiki_id", wikiId),
		mlog.String("parent_id", parentId))

	return createdPage, nil
}

func (a *App) GetWikiIdForPage(rctx request.CTX, pageId string) (string, *model.AppError) {
	opts := model.PropertyValueSearchOpts{
		TargetType: "post",
		TargetIDs:  []string{pageId},
		FieldID:    model.WikiPropertyFieldID,
		GroupID:    model.WikiPropertyGroupID,
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

func (a *App) MovePageToWiki(rctx request.CTX, pageId, targetWikiId string, parentPageId *string) *model.AppError {
	session := rctx.Session()

	page, err := a.GetSinglePost(rctx, pageId, false)
	if err != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.page_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	if page.Type != model.PostTypePage {
		return model.NewAppError("MovePageToWiki", "app.page.move.not_a_page", nil, "", http.StatusBadRequest)
	}

	targetWiki, err := a.GetWiki(rctx, targetWikiId)
	if err != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.target_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	sourceWikiId, err := a.GetWikiIdForPage(rctx, pageId)
	if err != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.source_wiki_not_found", nil, "", http.StatusNotFound).Wrap(err)
	}

	isSameWiki := sourceWikiId == targetWikiId

	if isSameWiki && parentPageId == nil {
		rctx.Logger().Debug("Same-wiki move without parent change has no effect",
			mlog.String("page_id", pageId),
			mlog.String("wiki_id", targetWikiId))
		return nil
	}

	sourceWiki, err := a.GetWiki(rctx, sourceWikiId)
	if err != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.source_wiki_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if page.ChannelId != targetWiki.ChannelId {
		return model.NewAppError("MovePageToWiki", "app.page.move.cross_channel_not_supported", nil,
			"Cross-channel moves not supported in Phase 1", http.StatusBadRequest)
	}

	if sourceWiki.ChannelId != targetWiki.ChannelId {
		return model.NewAppError("MovePageToWiki", "app.page.move.wiki_channel_mismatch", nil, "", http.StatusInternalServerError)
	}

	if appErr := a.HasPermissionToModifyPage(rctx, session, page, PageOperationEdit, "MovePageToWiki"); appErr != nil {
		return appErr
	}

	channel, chanErr := a.GetChannel(rctx, targetWiki.ChannelId)
	if chanErr != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.channel_not_found", nil, "", http.StatusInternalServerError).Wrap(chanErr)
	}

	var targetPermission *model.Permission
	switch channel.Type {
	case model.ChannelTypeOpen:
		targetPermission = model.PermissionCreatePagePublicChannel
	case model.ChannelTypePrivate:
		targetPermission = model.PermissionCreatePagePrivateChannel
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		targetPermission = nil
	default:
		return model.NewAppError("MovePageToWiki", "app.page.move.invalid_channel_type", nil, "", http.StatusBadRequest)
	}

	if targetPermission != nil && !a.SessionHasPermissionToChannel(rctx, *session, targetWiki.ChannelId, targetPermission) {
		return model.NewAppError("MovePageToWiki", "app.page.move.no_target_permission", nil,
			"User cannot add pages to target wiki", http.StatusForbidden)
	}

	targetPages, pagesErr := a.Srv().Store().Wiki().GetPages(targetWikiId, 0, 10000)
	if pagesErr != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.get_target_pages_failed", nil, "", http.StatusInternalServerError).Wrap(pagesErr)
	}

	pageTitle, _ := page.Props["title"].(string)
	for _, existingPage := range targetPages {
		if existingPage.Id == pageId {
			continue
		}
		if existingTitle, ok := existingPage.Props["title"].(string); ok && existingTitle == pageTitle {
			return model.NewAppError("MovePageToWiki", "app.page.move.title_conflict", nil,
				"Target wiki already has a page with this title", http.StatusConflict)
		}
	}

	if parentPageId != nil && *parentPageId != "" {
		parentPage, parentErr := a.GetSinglePost(rctx, *parentPageId, false)
		if parentErr != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_not_found", nil,
				"Parent page not found", http.StatusNotFound).Wrap(parentErr)
		}

		if parentPage.Type != model.PostTypePage {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_not_a_page", nil,
				"Parent must be a page", http.StatusBadRequest)
		}

		parentWikiId, parentWikiErr := a.GetWikiIdForPage(rctx, *parentPageId)
		if parentWikiErr != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_wiki_not_found", nil,
				"Could not determine parent's wiki", http.StatusInternalServerError).Wrap(parentWikiErr)
		}

		if parentWikiId != targetWikiId {
			return model.NewAppError("MovePageToWiki", "app.page.move.parent_wrong_wiki", nil,
				"Parent page must be in target wiki", http.StatusBadRequest)
		}

		if *parentPageId == pageId {
			return model.NewAppError("MovePageToWiki", "app.page.move.self_parent", nil,
				"Cannot move page under itself", http.StatusBadRequest)
		}

		descendants, descErr := a.GetPageDescendants(rctx, pageId)
		if descErr != nil {
			return model.NewAppError("MovePageToWiki", "app.page.move.get_descendants_failed", nil,
				"Failed to get page descendants", http.StatusInternalServerError).Wrap(descErr)
		}

		for _, descendant := range descendants.Posts {
			if descendant.Id == *parentPageId {
				return model.NewAppError("MovePageToWiki", "app.page.move.circular_reference", nil,
					"Cannot move page under its own descendant", http.StatusBadRequest)
			}
		}
	}

	if storeErr := a.Srv().Store().Wiki().MovePageToWiki(pageId, targetWikiId, parentPageId); storeErr != nil {
		return model.NewAppError("MovePageToWiki", "app.page.move.failed", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	rctx.Logger().Info("Page moved to wiki",
		mlog.String("page_id", pageId),
		mlog.String("page_title", pageTitle),
		mlog.String("source_wiki_id", sourceWikiId),
		mlog.String("source_wiki_title", sourceWiki.Title),
		mlog.String("target_wiki_id", targetWikiId),
		mlog.String("target_wiki_title", targetWiki.Title),
		mlog.String("channel_id", page.ChannelId),
		mlog.String("user_id", session.UserId))

	return nil
}
