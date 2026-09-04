// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitPlatformNotifications() {
	api.BaseRoutes.User.Handle("/platform_notifications", api.APISessionRequired(getPlatformNotifications)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/platform_notifications", api.APISessionRequired(replacePlatformNotifications)).Methods(http.MethodPut)
	api.BaseRoutes.User.Handle("/platform_notifications", api.APISessionRequired(upsertPlatformNotification)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/platform_notifications", api.APISessionRequired(clearPlatformNotifications)).Methods(http.MethodDelete)
	api.BaseRoutes.User.Handle("/platform_notifications/{notification_id:[A-Za-z0-9:_\\-]+}", api.APISessionRequired(deletePlatformNotification)).Methods(http.MethodDelete)
}

func getPlatformNotifications(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !apiCanAccessUserPlatformNotifications(c) {
		return
	}

	notifications, appErr := c.App.GetPlatformNotificationsForUser(c.AppContext, c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if notifications == nil {
		notifications = []*model.PlatformNotification{}
	}

	if err := json.NewEncoder(w).Encode(notifications); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func upsertPlatformNotification(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !apiCanAccessUserPlatformNotifications(c) {
		return
	}

	var notification model.PlatformNotification
	if jsonErr := json.NewDecoder(r.Body).Decode(&notification); jsonErr != nil {
		c.SetInvalidParam("notification")
		return
	}

	notification.UserId = c.Params.UserId
	connectionID := r.Header.Get(model.ConnectionId)

	saved, appErr := c.App.UpsertPlatformNotification(c.AppContext, &notification, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(saved); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func replacePlatformNotifications(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !apiCanAccessUserPlatformNotifications(c) {
		return
	}

	var notifications []*model.PlatformNotification
	if jsonErr := json.NewDecoder(r.Body).Decode(&notifications); jsonErr != nil {
		c.SetInvalidParam("notifications")
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)
	saved, appErr := c.App.ReplacePlatformNotificationsForUser(c.AppContext, c.Params.UserId, notifications, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(saved); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePlatformNotification(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !apiCanAccessUserPlatformNotifications(c) {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)
	if appErr := c.App.DeletePlatformNotification(c.AppContext, c.Params.UserId, c.Params.NotificationId, connectionID); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func clearPlatformNotifications(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !apiCanAccessUserPlatformNotifications(c) {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)
	if appErr := c.App.ClearPlatformNotificationsForUser(c.AppContext, c.Params.UserId, connectionID); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func apiCanAccessUserPlatformNotifications(c *Context) bool {
	if c.AppContext.Session().UserId != c.Params.UserId {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return false
	}

	return true
}
