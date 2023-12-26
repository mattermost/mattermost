// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	whereOutgoingOAuthConnection = "outgoingOAuthConnections"
)

func (api *API) InitOutgoingOAuthConnection() {
	api.BaseRoutes.OutgoingOAuthConnections.Handle("", api.APISessionRequired(listOutgoingOAuthConnections)).Methods("GET")
	api.BaseRoutes.OutgoingOAuthConnection.Handle("", api.APISessionRequired(getOutgoingOAuthConnection)).Methods("GET")
}

func ensureOutgoingOAuthConnectionInterface(c *Context, where string) (einterfaces.OutgoingOAuthConnectionInterface, bool) {
	if !c.App.Config().FeatureFlags.OutgoingOAuthConnections {
		c.Err = model.NewAppError(where, "api.context.outgoing_oauth_connection.not_available.feature_flag", nil, "", http.StatusNotImplemented)
		return nil, false
	}

	if c.App.OutgoingOAuthConnections() == nil || c.App.License() == nil || c.App.License().SkuShortName != model.LicenseShortSkuEnterprise {
		c.Err = model.NewAppError(where, "api.license.upgrade_needed.app_error", nil, "", http.StatusNotImplemented)
		return nil, false
	}
	return c.App.OutgoingOAuthConnections(), true
}

type listOutgoingOAuthConnectionsQuery struct {
	FromID string
	Limit  int
}

// SetDefaults sets the default values for the query.
func (q *listOutgoingOAuthConnectionsQuery) SetDefaults() {
	// Set default values
	if q.Limit == 0 {
		q.Limit = 10
	}
}

// IsValid validates the query.
func (q *listOutgoingOAuthConnectionsQuery) IsValid() error {
	if q.Limit < 1 || q.Limit > 100 {
		return fmt.Errorf("limit must be between 1 and 100")
	}
	return nil
}

// ToFilter converts the query to a filter that can be used to query the database.
func (q *listOutgoingOAuthConnectionsQuery) ToFilter() model.OutgoingOAuthConnectionGetConnectionsFilter {
	return model.OutgoingOAuthConnectionGetConnectionsFilter{
		OffsetId: q.FromID,
		Limit:    q.Limit,
	}
}

func NewListOutgoingOAuthConnectionsQueryFromURLQuery(values url.Values) (*listOutgoingOAuthConnectionsQuery, error) {
	query := &listOutgoingOAuthConnectionsQuery{}
	query.SetDefaults()

	fromID := values.Get("from_id")
	if fromID != "" {
		query.FromID = fromID
	}

	limit := values.Get("limit")
	if limit != "" {
		limitInt, err := strconv.Atoi(limit)
		if err == nil {
			return nil, err
		}
		query.Limit = limitInt
	}

	return query, nil
}

func listOutgoingOAuthConnections(c *Context, w http.ResponseWriter, r *http.Request) {
	service, ok := ensureOutgoingOAuthConnectionInterface(c, whereOutgoingOAuthConnection)
	if !ok {
		return
	}

	query, err := NewListOutgoingOAuthConnectionsQueryFromURLQuery(r.URL.Query())
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.input_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	if errValid := query.IsValid(); errValid != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.input_error", nil, errValid.Error(), http.StatusBadRequest)
		return
	}

	connections, errList := service.GetConnections(c.AppContext, query.ToFilter())
	if errList != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.app_error", nil, errList.Error(), http.StatusInternalServerError)
		return
	}

	service.SanitizeConnections(connections)

	if errJSON := json.NewEncoder(w).Encode(connections); errJSON != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.app_error", nil, errJSON.Error(), http.StatusInternalServerError)
		return
	}
}

func getOutgoingOAuthConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	service, ok := ensureOutgoingOAuthConnectionInterface(c, whereOutgoingOAuthConnection)
	if !ok {
		return
	}

	c.RequireOutgoingOAuthConnectionId()

	connection, err := service.GetConnection(c.AppContext, c.Params.OutgoingOAuthConnectionID)
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	service.SanitizeConnection(connection)

	if err := json.NewEncoder(w).Encode(connection); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}
