// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) GetChannelTabs(channelId string, since int64) ([]*model.ChannelTabWithFileInfo, *model.AppError) {
	bookmarks, err := a.Srv().Store().ChannelTab().GetTabsForChannelSince(channelId, since)
	if err != nil {
		return nil, model.NewAppError("GetChannelTabs", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	return bookmarks, nil
}

func (a *App) GetTab(tabId string, includeDeleted bool) (*model.ChannelTabWithFileInfo, *model.AppError) {
	bookmark, err := a.Srv().Store().ChannelTab().Get(tabId, includeDeleted)
	if err != nil {
		return nil, model.NewAppError("GetTab", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	return bookmark, nil
}

func (a *App) CreateChannelTab(rctx request.CTX, newTab *model.ChannelTab, connectionId string) (*model.ChannelTabWithFileInfo, *model.AppError) {
	newTab.OwnerId = rctx.Session().UserId //ensure that the bookmark is being created by the user who owns the session
	newTab.Id = ""                         // ensure that creating a new bookmark generates a new ID
	bookmark, err := a.Srv().Store().ChannelTab().Save(newTab, true)
	if err != nil {
		return nil, model.NewAppError("CreateChannelTab", "app.channel.bookmark.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelTabCreated, "", bookmark.ChannelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(bookmark)
	if jsonErr != nil {
		return nil, model.NewAppError("CreateChannelTab", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmark", string(bookmarkJSON))
	a.Publish(message)
	return bookmark, nil
}

func (a *App) UpdateChannelTab(rctx request.CTX, updateTab *model.ChannelTabWithFileInfo, connectionId string) (*model.UpdateChannelTabResponse, *model.AppError) {
	response := &model.UpdateChannelTabResponse{}
	if updateTab.OwnerId == rctx.Session().UserId {
		isAnotherFile := updateTab.FileInfo != nil && updateTab.FileId != "" && updateTab.FileId != updateTab.FileInfo.Id

		if isAnotherFile {
			if fileAlreadyAttachedErr := a.Srv().Store().ChannelTab().ErrorIfTabFileInfoAlreadyAttached(updateTab.FileId, updateTab.ChannelId); fileAlreadyAttachedErr != nil {
				return nil, model.NewAppError("UpdateChannelTab", "app.channel.bookmark.update.app_error", nil, "", http.StatusInternalServerError).Wrap(fileAlreadyAttachedErr)
			}
		}

		if err := a.Srv().Store().ChannelTab().Update(updateTab.ChannelTab); err != nil {
			return nil, model.NewAppError("UpdateChannelTab", "app.channel.bookmark.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if isAnotherFile {
			fileInfo, fileErr := a.Srv().Store().FileInfo().Get(updateTab.FileId)
			if fileErr != nil {
				return nil, model.NewAppError("UpdateChannelTab", "app.channel.bookmark.get_existing.app_err", nil, "", http.StatusNotFound).Wrap(fileErr)
			}
			response.Updated = updateTab.ToTabWithFileInfo(fileInfo)
		} else {
			response.Updated = updateTab.ToTabWithFileInfo(updateTab.FileInfo)
		}
	} else {
		existingTab, ebErr := a.Srv().Store().ChannelTab().Get(updateTab.Id, false)
		if ebErr != nil {
			return nil, model.NewAppError("UpdateChannelTab", "app.channel.bookmark.get_existing.app_err", nil, "", http.StatusNotFound).Wrap(ebErr)
		}

		existingTab.DeleteAt = model.GetMillis()
		if err := a.Srv().Store().ChannelTab().Delete(updateTab.Id, false); err != nil {
			return nil, model.NewAppError("UpdateChannelTab", "app.channel.bookmark.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		newTab := updateTab.SetOriginal(rctx.Session().UserId)
		bookmark, err := a.Srv().Store().ChannelTab().Save(newTab, false)
		if err != nil {
			return nil, model.NewAppError("UpdateChannelTab", "app.channel.bookmark.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		response.Updated = bookmark
		response.Deleted = existingTab.ToTabWithFileInfo(nil)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelTabUpdated, "", updateTab.ChannelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(response)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateChannelTab", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmarks", string(bookmarkJSON))
	a.Publish(message)

	return response, nil
}

func (a *App) DeleteChannelTab(tabId, connectionId string) (*model.ChannelTabWithFileInfo, *model.AppError) {
	if err := a.Srv().Store().ChannelTab().Delete(tabId, true); err != nil {
		return nil, model.NewAppError("DeleteChannelTab", "app.channel.bookmark.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	bookmark, err := a.GetTab(tabId, true)
	if err != nil {
		return nil, model.NewAppError("DeleteChannelTab", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelTabDeleted, "", bookmark.ChannelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(bookmark)
	if jsonErr != nil {
		return nil, model.NewAppError("DeleteChannelTab", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmark", string(bookmarkJSON))
	a.Publish(message)

	return bookmark, nil
}

func (a *App) UpdateChannelTabSortOrder(tabId, channelId string, newIndex int64, connectionId string) ([]*model.ChannelTabWithFileInfo, *model.AppError) {
	bookmarks, err := a.Srv().Store().ChannelTab().UpdateSortOrder(tabId, channelId, newIndex)
	if err != nil {
		var iiErr *store.ErrInvalidInput
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &iiErr):
			return nil, model.NewAppError("UpdateSortOrder", "app.channel.bookmark.update_sort.invalid_input.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateSortOrder", "app.channel.bookmark.update_sort.missing_bookmark.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateSortOrder", "app.channel.bookmark.update_sort.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelTabSorted, "", channelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(bookmarks)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateSortOrder", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmarks", string(bookmarkJSON))
	a.Publish(message)

	return bookmarks, nil
}
