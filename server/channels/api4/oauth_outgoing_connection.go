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
	whereOAuthOutgoingConnection = "listOAuthOutgoingConnections"
)

func (api *API) InitOAuthOutgoingConnection() {
	api.BaseRoutes.OAuthOutgoingConnection.Handle("", api.APISessionRequired(listConnections)).Methods("GET")
}

func ensureOAuthOutgoingConnectionInterface(c *Context, where string) (einterfaces.OAuthOutgoingConnectionInterface, bool) {
	if c.App.OAuthOutgoingConnection() == nil || !c.App.Config().FeatureFlags.OAuthOutgoingConnections || c.App.License() == nil || c.App.License().SkuShortName != model.LicenseShortSkuEnterprise {
		c.Err = model.NewAppError(where, "api.context.oauth_outgoing_connection.not_available.app_error", nil, "", http.StatusNotImplemented)
		return nil, false
	}
	return c.App.OAuthOutgoingConnection(), true
}

func listConnections(c *Context, w http.ResponseWriter, r *http.Request) {
	service, ok := ensureOAuthOutgoingConnectionInterface(c, whereOAuthOutgoingConnection)
	if !ok {
		return
	}

	connections, err := service.GetConnections(c.AppContext, model.OAuthOutgoingConnectionGetConnectionsFilter{})
	if err != nil {
		c.Err = model.NewAppError(whereOAuthOutgoingConnection, "api.context.oauth_outgoing_connection.list_connections.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(connections); err != nil {
		c.Err = model.NewAppError(whereOAuthOutgoingConnection, "api.context.oauth_outgoing_connection.list_connections.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}
