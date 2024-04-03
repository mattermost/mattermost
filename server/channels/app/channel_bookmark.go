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

func (a *App) GetChannelBookmarks(channelId string, since int64) ([]*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	bookmarks, err := a.Srv().Store().ChannelBookmark().GetBookmarksForChannelSince(channelId, since)
	if err != nil {
		return nil, model.NewAppError("GetChannelBookmarks", "app.channel.bookmark.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
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
	newBookmark.OwnerId = c.Session().UserId //ensure that the bookmark is being created by the user who owns the session
	newBookmark.Id = ""                      // ensure that creating a new bookmark generates a new ID
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

func (a *App) UpdateChannelBookmark(c request.CTX, updateBookmark *model.ChannelBookmarkWithFileInfo, connectionId string) (*model.UpdateChannelBookmarkResponse, *model.AppError) {
	response := &model.UpdateChannelBookmarkResponse{}
	if updateBookmark.OwnerId == c.Session().UserId {
		isAnotherFile := updateBookmark.FileInfo != nil && updateBookmark.FileId != "" && updateBookmark.FileId != updateBookmark.FileInfo.Id

		if isAnotherFile {
			if fileAlreadyAttachedErr := a.Srv().Store().ChannelBookmark().ErrorIfBookmarkFileInfoAlreadyAttached(updateBookmark.FileId); fileAlreadyAttachedErr != nil {
				return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.update.app_error", nil, "", http.StatusInternalServerError).Wrap(fileAlreadyAttachedErr)
			}
		}

		if err := a.Srv().Store().ChannelBookmark().Update(updateBookmark.ChannelBookmark); err != nil {
			return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if isAnotherFile {
			fileInfo, fileErr := a.Srv().Store().FileInfo().Get(updateBookmark.FileId)
			if fileErr != nil {
				return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.get_existing.app_err", nil, "", http.StatusNotFound).Wrap(fileErr)
			}
			response.Updated = updateBookmark.ToBookmarkWithFileInfo(fileInfo)
		} else {
			response.Updated = updateBookmark.ToBookmarkWithFileInfo(updateBookmark.FileInfo)
		}
	} else {
		existingBookmark, ebErr := a.Srv().Store().ChannelBookmark().Get(updateBookmark.Id, false)
		if ebErr != nil {
			return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.get_existing.app_err", nil, "", http.StatusNotFound).Wrap(ebErr)
		}

		existingBookmark.DeleteAt = model.GetMillis()
		if err := a.Srv().Store().ChannelBookmark().Delete(updateBookmark.Id, false); err != nil {
			return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		newBookmark := updateBookmark.SetOriginal(c.Session().UserId)
		bookmark, err := a.Srv().Store().ChannelBookmark().Save(newBookmark, false)
		if err != nil {
			return nil, model.NewAppError("UpdateChannelBookmark", "app.channel.bookmark.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		response.Updated = bookmark
		response.Deleted = existingBookmark.ToBookmarkWithFileInfo(nil)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventChannelBookmarkUpdated, "", updateBookmark.ChannelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(response)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateChannelBookmark", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmarks", string(bookmarkJSON))
	a.Publish(message)

	return response, nil
}

func (a *App) DeleteChannelBookmark(bookmarkId, connectionId string) (*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	if err := a.Srv().Store().ChannelBookmark().Delete(bookmarkId, true); err != nil {
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

func (a *App) UpdateChannelBookmarkSortOrder(bookmarkId, channelId string, newIndex int64, connectionId string) ([]*model.ChannelBookmarkWithFileInfo, *model.AppError) {
	bookmarks, err := a.Srv().Store().ChannelBookmark().UpdateSortOrder(bookmarkId, channelId, newIndex)
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

	message := model.NewWebSocketEvent(model.WebsocketEventChannelBookmarkSorted, "", channelId, "", nil, connectionId)
	bookmarkJSON, jsonErr := json.Marshal(bookmarks)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateSortOrder", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("bookmarks", string(bookmarkJSON))
	a.Publish(message)

	return bookmarks, nil
}
