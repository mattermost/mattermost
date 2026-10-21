// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitRecentSearch() {
	api.BaseRoutes.RecentSearches.Handle("", api.APISessionRequired(getRecentSearches)).Methods(http.MethodGet)
	api.BaseRoutes.RecentSearches.Handle("", api.APISessionRequired(saveRecentSearch)).Methods(http.MethodPost)
	api.BaseRoutes.RecentSearches.Handle("/{search_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteRecentSearch)).Methods(http.MethodDelete)
}

func requireRecentSearchOwner(c *Context) bool {
	c.RequireUserId()
	if c.Err != nil {
		return false
	}

	if c.AppContext.Session().UserId != c.Params.UserId {
		c.Err = model.NewAppError("requireRecentSearchOwner", "api.recent_search.permissions.app_error", nil, "", http.StatusForbidden)
		return false
	}
	return true
}

func getRecentSearches(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireRecentSearchOwner(c) {
		return
	}

	list, err := c.App.GetRecentSearchesForUser(c.AppContext, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(list); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func saveRecentSearch(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireRecentSearchOwner(c) {
		return
	}

	var search model.RecentSearch
	if jsonErr := json.NewDecoder(r.Body).Decode(&search); jsonErr != nil {
		c.SetInvalidParamWithErr("recent_search", jsonErr)
		return
	}

	saved, err := c.App.SaveRecentSearch(c.AppContext, c.Params.UserId, &search)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(saved); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteRecentSearch(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requireRecentSearchOwner(c) {
		return
	}

	c.RequireRecentSearchId()
	if c.Err != nil {
		return
	}

	if err := c.App.DeleteRecentSearch(c.AppContext, c.Params.UserId, c.Params.RecentSearchId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
