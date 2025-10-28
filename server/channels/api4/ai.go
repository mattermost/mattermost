// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAI() {
	// FEATURE_FLAG_REMOVAL: EnableAIRewrites - Remove this feature flag check and always initialize AI routes
	if !api.srv.Config().FeatureFlags.EnableAIRewrites {
		return
	}
	api.BaseRoutes.APIRoot.Handle("/ai/rewrite", api.APISessionRequired(rewriteMessage)).Methods(http.MethodPost)
}

// rewriteMessage handles AI-powered message rewriting requests
func rewriteMessage(c *Context, w http.ResponseWriter, r *http.Request) {
	// FEATURE_FLAG_REMOVAL: EnableAIRewrites - Remove this feature flag check and always allow rewrite requests
	if !c.App.Config().FeatureFlags.EnableAIRewrites {
		c.Err = model.NewAppError("rewriteMessage", "api.ai.rewrite.not_implemented", nil, "AI rewrites feature is not enabled", http.StatusNotImplemented)
		return
	}

	// Parse request
	var req model.AIRewriteRequest
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
