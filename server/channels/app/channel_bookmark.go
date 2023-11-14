// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetChannelBookmarks(channelId string, since int64) ([]*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	bookmarks, err := a.Srv().Store().ChannelBookmark().GetBookmarksForChannelSince(channelId, since)
	if err != nil {
		return nil, model.NewAppError("GetChannelBookmarks", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	return bookmarks, nil
}

func (a *App) GetAllChannelBookmarks(channelIds []string, since int64) (map[string][]*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	bookmarks, err := a.Srv().Store().ChannelBookmark().GetBookmarksForAllChannelByIdSince(channelIds, since)
	if err != nil {
		return nil, model.NewAppError("GetAllChannelBookmarks", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	return bookmarks, nil
}

func (a *App) GetBookmark(bookmarkId string, includeDeleted bool) (*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	bookmark, err := a.Srv().Store().ChannelBookmark().Get(bookmarkId, includeDeleted)
	if err != nil {
		return nil, model.NewAppError("GetBookmark", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	return bookmark, nil
}

func (a *App) CreateChannelBookmark(c request.CTX, newBookmark *model.ChannelBookmark, connectionId string) (*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	newBookmark.OwnerId = c.Session().UserId
	bookmark, err := a.Srv().Store().ChannelBookmark().Save(newBookmark, true)
	if err != nil {
		return nil, model.NewAppError("CreateChannelBookmark", "app.channel.bookmark.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelBookmarkCreated, "", bookmark.ChannelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(bookmark)
	if jsonErr != nil {
		return nil, model.NewAppError("CreateChannelBookmark", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmark", string(bookmarkJSON))
	a.Publish(message)
	return bookmark, nil
}

func (a *App) UpdateChannelBookmark(c request.CTX, updateBookmark *model.ChannelBookmark, connectionId string) (*model.UpdateChannelBookmarkResponse, *model.AppError) {
	bookmark, err := a.Srv().Store().ChannelBookmark().Get(updateBookmark.Id, true)
	if err != nil {
		return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	if bookmark.DeleteAt > 0 {
		return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.update_deleted.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	reponse := &model.UpdateChannelBookmarkResponse{}
	if bookmark.OwnerId == c.Session().UserId {
		if err = a.Srv().Store().ChannelBookmark().Update(updateBookmark); err != nil {
			return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		reponse.Updated = updateBookmark.ToBookmarkWithFileInfo(bookmark.FileInfo)
	} else {
		updateBookmark.DeleteAt = model.GetMillis()
		if err = a.Srv().Store().ChannelBookmark().Delete(updateBookmark.Id); err != nil {
			return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		newBookmark := updateBookmark.SetOriginal(c.Session().UserId)
		bookmark, err = a.Srv().Store().ChannelBookmark().Save(newBookmark, false)
		if err != nil {
			return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		reponse.Updated = bookmark
		reponse.Deleted = updateBookmark.ToBookmarkWithFileInfo(nil)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelBookmarkCreated, "", updateBookmark.ChannelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(reponse)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateChannelBookmark", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmarks", string(bookmarkJSON))
	return reponse, nil
}

func (a *App) DeleteChannelBookmark(bookmarkId, connectionId string) (*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	if err := a.Srv().Store().ChannelBookmark().Delete(bookmarkId); err != nil {
		return nil, model.NewAppError("DeleteChannelBookmark", "app.channel.bookmark.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	bookmark, err := a.GetBookmark(bookmarkId, true)
	if err != nil {
		return nil, model.NewAppError("DeleteChannelBookmark", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelBookmarkDeleted, "", bookmark.ChannelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(bookmark)
	if jsonErr != nil {
		return nil, model.NewAppError("DeleteChannelBookmark", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmark", string(bookmarkJSON))
	a.Publish(message)
	return bookmark, nil
}
