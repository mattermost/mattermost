// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitEntity() {
	api.BaseRoutes.APIRoot.Handle("/entities/card", api.APISessionRequired(getEntityCard)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/entities/posts", api.APISessionRequired(getEntityPosts)).Methods(http.MethodPost)
}

func getEntityCard(c *Context, w http.ResponseWriter, r *http.Request) {
	var card *model.EntityCard
	var appErr *model.AppError
	postID := r.URL.Query().Get("post_id")
	occurrence := r.URL.Query().Get("id")
	typeID := r.URL.Query().Get("type_id")
	switch {
	case postID != "" && occurrence != "":
		card, appErr = c.App.GetEntityCardForPost(c.AppContext, postID, occurrence, typeID)
	case postID != "":
		card, appErr = c.App.GetEntityCardFromPost(c.AppContext, postID, typeID, r.URL.Query().Get("value"))
	default:
		card, appErr = c.App.GetEntityCard(c.AppContext, typeID, r.URL.Query().Get("value"))
	}
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(card); err != nil {
		c.Logger.Warn("Error writing entity card", mlog.Err(err))
	}
}

func getEntityPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	var body struct {
		PostIDs []string `json:"post_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.SetInvalidParamWithErr("post_ids", err)
		return
	}
	posts, appErr := c.App.GetEntityPosts(c.AppContext, body.PostIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{"posts": posts}); err != nil {
		c.Logger.Warn("Error writing entity posts", mlog.Err(err))
	}
}
