// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitAI() {
	api.BaseRoutes.APIRoot.Handle("/ai/rewrite", api.APISessionRequired(rewriteMessage)).Methods(http.MethodPost)
}

// rewriteMessage handles AI-powered message rewriting requests
func rewriteMessage(c *Context, w http.ResponseWriter, r *http.Request) {
	// Parse request
	var req app.AIRewriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request_body", err)
		return
	}

	// Call app layer to handle business logic
	response, appErr := c.App.RewriteMessage(
		c.AppContext,
		c.AppContext.Session().UserId,
		req.Message,
		req.Action,
	)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Return response
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
