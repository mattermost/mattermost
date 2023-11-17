// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	whereOutgoingOAuthConnection = "listOutgoingOAuthConnections"
)

func (api *API) InitOutgoingOAuthConnection() {
	api.BaseRoutes.OutgoingOAuthConnection.Handle("", api.APISessionRequired(listConnections)).Methods("GET")
}

func ensureOutgoingOAuthConnectionInterface(c *Context, where string) (einterfaces.OutgoingOAuthConnectionInterface, bool) {
	if c.App.OutgoingOAuthConnection() == nil || !c.App.Config().FeatureFlags.OutgoingOAuthConnections || c.App.License() == nil || c.App.License().SkuShortName != model.LicenseShortSkuEnterprise {
		c.Err = model.NewAppError(where, "api.context.oauth_outgoing_connection.not_available.app_error", nil, "", http.StatusNotImplemented)
		return nil, false
	}
	return c.App.OutgoingOAuthConnection(), true
}

func listConnections(c *Context, w http.ResponseWriter, r *http.Request) {
	service, ok := ensureOutgoingOAuthConnectionInterface(c, whereOutgoingOAuthConnection)
	if !ok {
		return
	}

	connections, err := service.GetConnections(c.AppContext, model.OutgoingOAuthConnectionGetConnectionsFilter{})
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.oauth_outgoing_connection.list_connections.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(connections); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.oauth_outgoing_connection.list_connections.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}
