// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/channels/utils"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitUsage() {
	// GET /api/v4/usage/posts
	api.BaseRoutes.Usage.Handle("/posts", api.APISessionRequired(getPostsUsage)).Methods("GET")
	// GET /api/v4/usage/storage
	api.BaseRoutes.Usage.Handle("/storage", api.APISessionRequired(getStorageUsage)).Methods("GET")
	// GET /api/v4/usage/teams
	api.BaseRoutes.Usage.Handle("/teams", api.APISessionRequired(getTeamsUsage)).Methods("GET")
}

func getPostsUsage(c *Context, w http.ResponseWriter, r *http.Request) {
	count, appErr := c.App.GetPostsUsage()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getPostsUsage", "app.post.analytics_posts_count.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	json, err := json.Marshal(&model.PostsUsage{Count: count})
	if err != nil {
		c.Err = model.NewAppError("Api4.getPostsUsage", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(json)
}

func getStorageUsage(c *Context, w http.ResponseWriter, r *http.Request) {
	usage, appErr := c.App.GetStorageUsage()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getStorageUsage", "app.usage.get_storage_usage.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	usage = utils.RoundOffToZeroesResolution(float64(usage), 8)
	json, err := json.Marshal(&model.StorageUsage{Bytes: usage})
	if err != nil {
		c.Err = model.NewAppError("Api4.getStorageUsage", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(json)
}

func getTeamsUsage(c *Context, w http.ResponseWriter, r *http.Request) {
	teamsUsage, appErr := c.App.GetTeamsUsage()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getTeamsUsage", "app.teams.analytics_teams_count.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	if teamsUsage == nil {
		c.Err = model.NewAppError("Api4.getTeamsUsage", "app.teams.analytics_teams_count.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	json, err := json.Marshal(teamsUsage)
	if err != nil {
		c.Err = model.NewAppError("Api4.getTeamsUsage", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(json)
}
