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

func (a *App) SaveRecentSearch(rctx request.CTX, userID string, search *model.RecentSearch) (*model.RecentSearch, *model.AppError) {
	if search == nil {
		return nil, model.NewAppError("SaveRecentSearch", "api.recent_search.save.invalid.app_error", nil, "", http.StatusBadRequest)
	}

	search.UserId = userID
	search.PreSave()
	if appErr := search.IsValid(); appErr != nil {
		return nil, appErr
	}

	saved, err := a.Srv().Store().RecentSearch().Save(search)
	if err != nil {
		return nil, model.NewAppError("SaveRecentSearch", "app.recent_search.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("Saved recent search",
		mlog.String("user_id", userID),
		mlog.String("search_type", saved.SearchType),
		mlog.String("search_id", saved.Id),
	)

	a.publishRecentSearchEvent(userID, model.RecentSearchWSActionSave, saved, "")
	return saved, nil
}

func (a *App) GetRecentSearchesForUser(rctx request.CTX, userID string) (*model.RecentSearchList, *model.AppError) {
	items, err := a.Srv().Store().RecentSearch().GetByUser(userID, model.RecentSearchLimit)
	if err != nil {
		return nil, model.NewAppError("GetRecentSearchesForUser", "app.recent_search.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if items == nil {
		items = []*model.RecentSearch{}
	}

	rctx.Logger().Debug("Listed recent searches",
		mlog.String("user_id", userID),
		mlog.Int("count", len(items)),
	)

	return &model.RecentSearchList{Items: items}, nil
}

func (a *App) DeleteRecentSearch(rctx request.CTX, userID, searchID string) *model.AppError {
	if err := a.Srv().Store().RecentSearch().Delete(userID, searchID); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteRecentSearch", "app.recent_search.delete.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteRecentSearch", "app.recent_search.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	rctx.Logger().Debug("Deleted recent search",
		mlog.String("user_id", userID),
		mlog.String("search_id", searchID),
	)

	a.publishRecentSearchEvent(userID, model.RecentSearchWSActionDelete, nil, searchID)
	return nil
}

func (a *App) publishRecentSearchEvent(userID, action string, item *model.RecentSearch, id string) {
	message := model.NewWebSocketEvent(model.WebsocketEventRecentSearchUpdated, "", "", userID, nil, "")
	message.Add("action", action)
	if item != nil {
		itemJSON, err := json.Marshal(item)
		if err != nil {
			return
		}
		message.Add("item", string(itemJSON))
	}
	if id != "" {
		message.Add("id", id)
	}
	a.Publish(message)
}
