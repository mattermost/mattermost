// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitUsage() {
	// GET /api/v4/usage/posts
	api.BaseRoutes.Usage.Handle("/posts", api.APISessionRequired(getPostsUsage)).Methods("GET")
}

func getPostsUsage(c *Context, w http.ResponseWriter, r *http.Request) {
	// TODO: yet to decide permission
	// if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.AppContext.Session().UserId) {
	// 	c.SetPermissionError(model.PermissionEditOtherUsers)
	// 	return
	// }

	count, appErr := c.App.GetPostsUsage()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getPostsUsage", "app.post.analytics_posts_count.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(&model.PostsUsage{Count: count})
	if err != nil {
		c.Err = model.NewAppError("Api4.getPostsUsage", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}
