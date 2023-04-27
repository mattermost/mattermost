// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/playbooks"
	"github.com/pkg/errors"

	"github.com/gorilla/mux"
)

type ActionsHandler struct {
	*ErrorHandler
	channelActionsService app.ChannelActionService
	api                   playbooks.ServicesAPI
	permissions           *app.PermissionsService
}

func NewActionsHandler(router *mux.Router, channelActionsService app.ChannelActionService, api playbooks.ServicesAPI, permissions *app.PermissionsService) *ActionsHandler {
	handler := &ActionsHandler{
		ErrorHandler:          &ErrorHandler{},
		channelActionsService: channelActionsService,
		api:                   api,
		permissions:           permissions,
	}

	actionsRouter := router.PathPrefix("/actions").Subrouter()

	channelsActionsRouter := actionsRouter.PathPrefix("/channels").Subrouter()
	channelActionsRouter := channelsActionsRouter.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	channelActionsRouter.HandleFunc("", withContext(handler.createChannelAction)).Methods(http.MethodPost)
	channelActionsRouter.HandleFunc("", withContext(handler.getChannelActions)).Methods(http.MethodGet)
	channelActionsRouter.HandleFunc("/check-and-send-message-on-join", withContext(handler.checkAndSendMessageOnJoin)).Methods(http.MethodGet)

	channelActionRouter := channelActionsRouter.PathPrefix("/{action_id:[A-Za-z0-9]+}").Subrouter()
	channelActionRouter.HandleFunc("", withContext(handler.updateChannelAction)).Methods(http.MethodPut)

	return handler
}

func (a *ActionsHandler) createChannelAction(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	vars := mux.Vars(r)
	channelID := vars["channel_id"]

	if !a.PermissionsCheck(w, c.logger, a.permissions.ChannelActionCreate(userID, channelID)) {
		return
	}

	var channelAction app.GenericChannelAction
	if err := json.NewDecoder(r.Body).Decode(&channelAction); err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to parse action", err)
		return
	}

	// Ensure that the channel ID in both the URL and the body of the request are the same;
	// otherwise the permission check done above no longer makes sense
	if channelAction.ChannelID != channelID {
		a.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "channel ID in request body must match channel ID in URL", nil)
		return
	}

	// Validate the action type and payload
	if err := a.channelActionsService.Validate(channelAction); err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid action", err)
		return
	}

	id, err := a.channelActionsService.Create(channelAction)
	if err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to create action", err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", makeAPIURL(a.api, "actions/channel/%s/%s", channelAction.ChannelID, id))

	ReturnJSON(w, &result, http.StatusCreated)
}

func isValidTrigger(trigger string) bool {
	if trigger == "" {
		return true
	}

	for _, elem := range app.ValidTriggerTypes {
		if trigger == string(elem) {
			return true
		}
	}

	return false
}

func isValidAction(action string) bool {
	if action == "" {
		return true
	}

	for _, elem := range app.ValidActionTypes {
		if action == string(elem) {
			return true
		}
	}

	return false
}

func parseGetChannelActionsOptions(query url.Values) (*app.GetChannelActionOptions, error) {
	actionTypeStr := query.Get("action_type")
	triggerTypeStr := query.Get("trigger_type")

	if !isValidAction(actionTypeStr) {
		return nil, fmt.Errorf("action_type %q not recognized; valid values are %v", actionTypeStr, app.ValidActionTypes)
	}

	if !isValidTrigger(triggerTypeStr) {
		return nil, fmt.Errorf("trigger_type %q not recognized; valid values are %v", triggerTypeStr, app.ValidTriggerTypes)
	}

	return &app.GetChannelActionOptions{
		ActionType:  app.ActionType(actionTypeStr),
		TriggerType: app.TriggerType(triggerTypeStr),
	}, nil
}

func (a *ActionsHandler) getChannelActions(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	vars := mux.Vars(r)
	channelID := vars["channel_id"]

	if !a.PermissionsCheck(w, c.logger, a.permissions.ChannelActionView(userID, channelID)) {
		return
	}

	options, err := parseGetChannelActionsOptions(r.URL.Query())
	if err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, errors.Wrapf(err, "bad options").Error(), err)
		return
	}

	actions, err := a.channelActionsService.GetChannelActions(channelID, *options)
	if err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, fmt.Sprintf("unable to retrieve actions for channel %s", channelID), err)
		return
	}

	ReturnJSON(w, &actions, http.StatusOK)
}

// checkAndSendMessageOnJoin handles the GET /actions/channels/{channel_id}/check_and_send_message_on_join endpoint.
func (a *ActionsHandler) checkAndSendMessageOnJoin(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !a.PermissionsCheck(w, c.logger, a.permissions.ChannelActionView(userID, channelID)) {
		return
	}

	hasViewed := a.channelActionsService.CheckAndSendMessageOnJoin(userID, channelID)
	ReturnJSON(w, map[string]interface{}{"viewed": hasViewed}, http.StatusOK)
}

func (a *ActionsHandler) updateChannelAction(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	vars := mux.Vars(r)
	channelID := vars["channel_id"]

	if !a.PermissionsCheck(w, c.logger, a.permissions.ChannelActionUpdate(userID, channelID)) {
		return
	}

	var newChannelAction app.GenericChannelAction
	if err := json.NewDecoder(r.Body).Decode(&newChannelAction); err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to parse action", err)
		return
	}

	// Ensure that the channel ID in both the URL and the body of the request are the same;
	// otherwise the permission check done above no longer makes sense
	if newChannelAction.ChannelID != channelID {
		a.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "channel ID in request body must match channel ID in URL", nil)
		return
	}

	// Validate the new action type and payload
	if err := a.channelActionsService.Validate(newChannelAction); err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid action", err)
		return
	}

	err := a.channelActionsService.Update(newChannelAction, userID)
	if err != nil {
		a.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, fmt.Sprintf("unable to update action with ID %q", newChannelAction.ID), err)
		return
	}

	w.WriteHeader(http.StatusOK)
}
