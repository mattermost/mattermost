// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAIBridgeTestHelper() {
	api.BaseRoutes.System.Handle("/e2e/ai_bridge", api.APISessionRequired(putAIBridgeTestHelper)).Methods(http.MethodPut)
	api.BaseRoutes.System.Handle("/e2e/ai_bridge", api.APISessionRequired(getAIBridgeTestHelper)).Methods(http.MethodGet)
	api.BaseRoutes.System.Handle("/e2e/ai_bridge", api.APISessionRequired(deleteAIBridgeTestHelper)).Methods(http.MethodDelete)
}

func requireAIBridgeTestHelperEnabled(c *Context) {
	if !*c.App.Config().ServiceSettings.EnableTesting {
		c.Err = model.NewAppError("requireAIBridgeTestHelperEnabled", "api.ai_bridge_test_helper.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
	}
}

func putAIBridgeTestHelper(c *Context, w http.ResponseWriter, r *http.Request) {
	requireAIBridgeTestHelperEnabled(c)
	if c.Err != nil {
		return
	}

	var config model.AIBridgeTestHelperConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	if appErr := c.App.SetAIBridgeTestHelperConfig(&config); appErr != nil {
		c.Err = appErr
		return
	}

	state := c.App.GetAIBridgeTestHelperState()
	if err := json.NewEncoder(w).Encode(state); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getAIBridgeTestHelper(c *Context, w http.ResponseWriter, r *http.Request) {
	requireAIBridgeTestHelperEnabled(c)
	if c.Err != nil {
		return
	}

	if err := json.NewEncoder(w).Encode(c.App.GetAIBridgeTestHelperState()); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func deleteAIBridgeTestHelper(c *Context, w http.ResponseWriter, r *http.Request) {
	requireAIBridgeTestHelperEnabled(c)
	if c.Err != nil {
		return
	}

	c.App.ResetAIBridgeTestHelper()
	ReturnStatusOK(w)
}
