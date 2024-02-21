// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	whereOutgoingOAuthConnection = "outgoingOAuthConnections"
)

func (api *API) InitOutgoingOAuthConnection() {
	api.BaseRoutes.OutgoingOAuthConnections.Handle("", api.APISessionRequired(listOutgoingOAuthConnections)).Methods("GET")
	api.BaseRoutes.OutgoingOAuthConnections.Handle("", api.APISessionRequired(createOutgoingOAuthConnection)).Methods("POST")
	api.BaseRoutes.OutgoingOAuthConnection.Handle("", api.APISessionRequired(getOutgoingOAuthConnection)).Methods("GET")
	api.BaseRoutes.OutgoingOAuthConnection.Handle("", api.APISessionRequired(updateOutgoingOAuthConnection)).Methods("PUT")
	api.BaseRoutes.OutgoingOAuthConnection.Handle("", api.APISessionRequired(deleteOutgoingOAuthConnection)).Methods("DELETE")
	api.BaseRoutes.OutgoingOAuthConnections.Handle("/validate", api.APISessionRequired(validateOutgoingOAuthConnectionCredentials)).Methods("POST")
}

// checkOutgoingOAuthConnectionReadPermissions checks if the user has the permissions to read outgoing oauth connections.
// An user with the permissions to manage outgoing oauth connections can read outgoing oauth connections.
// Otherwise the user needs to have the permissions to manage outgoing webhooks or slash commands in order to read outgoing
// oauth connections so that they can use them.
// This is made in this way so only users with the management permission can setup the outgoing oauth connections and then
// other users can use them in their outgoing webhooks and slash commands if they have permissions to manage those.
func checkOutgoingOAuthConnectionReadPermissions(c *Context, teamId string) bool {
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOutgoingOAuthConnections) ||
		c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageOutgoingWebhooks) ||
		c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageSlashCommands) {
		return true
	}

	c.SetPermissionError(model.PermissionManageOutgoingWebhooks, model.PermissionManageSlashCommands)
	return false
}

// checkOutgoingOAuthConnectionWritePermissions checks if the user has the permissions to write outgoing oauth connections.
// This is a more granular permissions intended for system admins to manage (setup) outgoing oauth connections.
func checkOutgoingOAuthConnectionWritePermissions(c *Context) bool {
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOutgoingOAuthConnections) {
		return true
	}

	c.SetPermissionError(model.PermissionManageOutgoingOAuthConnections)
	return false
}

func ensureOutgoingOAuthConnectionInterface(c *Context, where string) (einterfaces.OutgoingOAuthConnectionInterface, bool) {
	if c.App.Config().ServiceSettings.EnableOutgoingOAuthConnections != nil && !*c.App.Config().ServiceSettings.EnableOutgoingOAuthConnections {
		c.Err = model.NewAppError(where, "api.context.outgoing_oauth_connection.not_available.configuration_disabled", nil, "", http.StatusNotImplemented)
		return nil, false
	}

	if c.App.OutgoingOAuthConnections() == nil || c.App.License() == nil || c.App.License().SkuShortName != model.LicenseShortSkuEnterprise {
		c.Err = model.NewAppError(where, "api.license.upgrade_needed.app_error", nil, "", http.StatusNotImplemented)
		return nil, false
	}
	return c.App.OutgoingOAuthConnections(), true
}

type listOutgoingOAuthConnectionsQuery struct {
	FromID   string
	Limit    int
	Audience string
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
		Audience: q.Audience,
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
		if err != nil {
			return nil, err
		}
		query.Limit = limitInt
	}

	audience := values.Get("audience")
	if audience != "" {
		query.Audience = audience
	}

	return query, nil
}

func listOutgoingOAuthConnections(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := r.URL.Query().Get("team_id")
	if !checkOutgoingOAuthConnectionReadPermissions(c, teamId) {
		return
	}

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

	var connections []*model.OutgoingOAuthConnection
	if query.Audience != "" {
		// If the consumer expects an audience match, use the `GetConnectionByAudience` method to
		// retrieve a single connection.
		connection, err := service.GetConnectionForAudience(c.AppContext, query.Audience)
		if err != nil {
			c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
		connections = append(connections, connection)
	} else {
		// If the consumer does not expect an audience match, use the `GetConnections` method to
		// retrieve a list of connections that potentially matches the provided audience.
		var errList *model.AppError
		connections, errList = service.GetConnections(c.AppContext, query.ToFilter())
		if errList != nil {
			c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.app_error", nil, errList.Error(), http.StatusInternalServerError)
			return
		}
	}

	service.SanitizeConnections(connections)

	if errJSON := json.NewEncoder(w).Encode(connections); errJSON != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.list_connections.app_error", nil, errJSON.Error(), http.StatusInternalServerError)
		return
	}
}

func getOutgoingOAuthConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	if !checkOutgoingOAuthConnectionWritePermissions(c) {
		return
	}

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

func createOutgoingOAuthConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("createOutgoingOauthConnection", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !checkOutgoingOAuthConnectionWritePermissions(c) {
		return
	}

	service, ok := ensureOutgoingOAuthConnectionInterface(c, whereOutgoingOAuthConnection)
	if !ok {
		return
	}

	var inputConnection model.OutgoingOAuthConnection
	if err := json.NewDecoder(r.Body).Decode(&inputConnection); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.create_connection.input_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "outgoing_oauth_connection", &inputConnection)

	inputConnection.CreatorId = c.AppContext.Session().UserId

	connection, err := service.SaveConnection(c.AppContext, &inputConnection)
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.create_connection.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(connection)
	auditRec.AddEventObjectType("outgoing_oauth_connection")
	c.LogAudit("client_id=" + connection.ClientId)

	service.SanitizeConnection(connection)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(connection); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.create_connection.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}

func updateOutgoingOAuthConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("updateOutgoingOAuthConnection", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "outgoing_oauth_connection_id", c.Params.OutgoingOAuthConnectionID)
	c.LogAudit("attempt")

	if !checkOutgoingOAuthConnectionWritePermissions(c) {
		return
	}

	service, ok := ensureOutgoingOAuthConnectionInterface(c, whereOutgoingOAuthConnection)
	if !ok {
		return
	}

	c.RequireOutgoingOAuthConnectionId()
	if c.Err != nil {
		return
	}

	var inputConnection model.OutgoingOAuthConnection
	if err := json.NewDecoder(r.Body).Decode(&inputConnection); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.update_connection.input_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	if inputConnection.Id != c.Params.OutgoingOAuthConnectionID {
		c.SetInvalidParam("id")
		return
	}

	currentConnection, err := service.GetConnection(c.AppContext, c.Params.OutgoingOAuthConnectionID)
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.update_connection.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.AddEventPriorState(currentConnection)

	currentConnection.Patch(&inputConnection)

	connection, err := service.UpdateConnection(c.AppContext, currentConnection)
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.update_connection.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.AddEventObjectType("outgoing_oauth_connection")
	auditRec.AddEventResultState(connection)
	auditRec.Success()
	auditLogExtraInfo := "success"
	// Audit log changes to clientID/Client Secret
	if connection.ClientId != currentConnection.ClientId {
		auditLogExtraInfo += " new_client_id=" + connection.ClientId
	}
	if connection.ClientSecret != currentConnection.ClientSecret {
		auditLogExtraInfo += " new_client_secret"
	}
	c.LogAudit(auditLogExtraInfo)
	service.SanitizeConnection(connection)

	if err := json.NewEncoder(w).Encode(connection); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.update_connection.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}

func deleteOutgoingOAuthConnection(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("deleteOutgoingOAuthConnection", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "outgoing_oauth_connection_id", c.Params.OutgoingOAuthConnectionID)
	c.LogAudit("attempt")

	if !checkOutgoingOAuthConnectionWritePermissions(c) {
		return
	}

	service, ok := ensureOutgoingOAuthConnectionInterface(c, whereOutgoingOAuthConnection)
	if !ok {
		return
	}

	c.RequireOutgoingOAuthConnectionId()
	if c.Err != nil {
		return
	}

	connection, err := service.GetConnection(c.AppContext, c.Params.OutgoingOAuthConnectionID)
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.delete_connection.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.AddEventPriorState(connection)

	if err := service.DeleteConnection(c.AppContext, c.Params.OutgoingOAuthConnectionID); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.delete_connection.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.AddEventObjectType("outgoing_oauth_connection")
	auditRec.Success()

	ReturnStatusOK(w)
}

// validateOutgoingOAuthConnectionCredentials validates the credentials of an outgoing oauth connection by requesting a token
// with the provided connection configuration. If the credentials are valid, the request will return a 200 status code and
// if the credentials are invalid, the request will return a 400 status code.
func validateOutgoingOAuthConnectionCredentials(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("validateOutgoingOAuthConnectionCredentials", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !checkOutgoingOAuthConnectionWritePermissions(c) {
		return
	}

	service, ok := ensureOutgoingOAuthConnectionInterface(c, whereOutgoingOAuthConnection)
	if !ok {
		return
	}

	// Allow checking connections sent in the body or by id if coming from an already existing
	// connection url.
	var inputConnection *model.OutgoingOAuthConnection

	if err := json.NewDecoder(r.Body).Decode(&inputConnection); err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.validate_connection_credentials.input_error", nil, err.Error(), http.StatusBadRequest)
		w.WriteHeader(c.Err.StatusCode)
		return
	}

	if inputConnection.Id != "" && inputConnection.ClientSecret == "" {
		var err *model.AppError
		var storedConnection *model.OutgoingOAuthConnection
		storedConnection, err = service.GetConnection(c.AppContext, inputConnection.Id)
		if err != nil {
			c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.validate_connection_credentials.app_error", nil, err.Error(), http.StatusInternalServerError)
			w.WriteHeader(c.Err.StatusCode)
			return
		}

		inputConnection.ClientSecret = storedConnection.ClientSecret
	}

	audit.AddEventParameterAuditable(auditRec, "outgoing_oauth_connection", inputConnection)

	resultStatusCode := http.StatusOK

	// Try to retrieve a token with the provided credentials
	// do not store the token, just check if the credentials are valid and the request can be made
	_, err := service.RetrieveTokenForConnection(c.AppContext, inputConnection)
	if err != nil {
		c.Err = model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.validate_connection_credentials.app_error", nil, err.Error(), err.StatusCode)
		c.Logger.Error("Failed to retrieve token while validating outgoing oauth connection", logr.Err(err))
		resultStatusCode = err.StatusCode
	} else {
		ReturnStatusOK(w)
	}

	auditRec.Success()
	auditRec.AddEventResultState(inputConnection)
	auditRec.AddEventObjectType("outgoing_oauth_connection")

	w.WriteHeader(resultStatusCode)
}
