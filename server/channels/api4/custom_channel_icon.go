// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (api *API) InitCustomChannelIcon() {
	api.BaseRoutes.CustomChannelIcons.Handle("", api.APISessionRequired(getCustomChannelIcons)).Methods(http.MethodGet)
	api.BaseRoutes.CustomChannelIcons.Handle("", api.APISessionRequired(createCustomChannelIcon)).Methods(http.MethodPost)
	api.BaseRoutes.CustomChannelIcon.Handle("", api.APISessionRequired(getCustomChannelIcon)).Methods(http.MethodGet)
	api.BaseRoutes.CustomChannelIcon.Handle("", api.APISessionRequired(updateCustomChannelIcon)).Methods(http.MethodPut)
	api.BaseRoutes.CustomChannelIcon.Handle("", api.APISessionRequired(deleteCustomChannelIcon)).Methods(http.MethodDelete)
}

// getCustomChannelIcons returns all custom channel icons
func getCustomChannelIcons(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.CustomChannelIcons {
		c.Err = model.NewAppError("getCustomChannelIcons", "api.custom_channel_icon.disabled", nil, "", http.StatusForbidden)
		return
	}

	icons, err := c.App.Srv().Store().CustomChannelIcon().GetAll()
	if err != nil {
		c.Err = model.NewAppError("getCustomChannelIcons", "api.custom_channel_icon.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(icons); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getCustomChannelIcon returns a single custom channel icon by ID
func getCustomChannelIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.CustomChannelIcons {
		c.Err = model.NewAppError("getCustomChannelIcon", "api.custom_channel_icon.disabled", nil, "", http.StatusForbidden)
		return
	}

	iconId := mux.Vars(r)["icon_id"]
	if iconId == "" {
		c.SetInvalidURLParam("icon_id")
		return
	}

	icon, err := c.App.Srv().Store().CustomChannelIcon().Get(iconId)
	if err != nil {
		if _, ok := err.(*store.ErrNotFound); ok {
			c.Err = model.NewAppError("getCustomChannelIcon", "api.custom_channel_icon.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
			return
		}
		c.Err = model.NewAppError("getCustomChannelIcon", "api.custom_channel_icon.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(icon); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// createCustomChannelIcon creates a new custom channel icon (admin only)
func createCustomChannelIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.CustomChannelIcons {
		c.Err = model.NewAppError("createCustomChannelIcon", "api.custom_channel_icon.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Only system admins can create custom icons
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	var icon model.CustomChannelIcon
	if jsonErr := json.NewDecoder(r.Body).Decode(&icon); jsonErr != nil {
		c.SetInvalidParamWithErr("custom_channel_icon", jsonErr)
		return
	}

	// Set the creator
	icon.CreatedBy = c.AppContext.Session().UserId

	savedIcon, err := c.App.Srv().Store().CustomChannelIcon().Save(&icon)
	if err != nil {
		c.Err = model.NewAppError("createCustomChannelIcon", "api.custom_channel_icon.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Broadcast WebSocket event to all users
	message := model.NewWebSocketEvent(model.WebsocketEventCustomChannelIconAdded, "", "", "", nil, "")
	message.Add("icon", savedIcon)
	c.App.Publish(message)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(savedIcon); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// updateCustomChannelIcon updates an existing custom channel icon (admin only)
func updateCustomChannelIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.CustomChannelIcons {
		c.Err = model.NewAppError("updateCustomChannelIcon", "api.custom_channel_icon.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Only system admins can update custom icons
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	iconId := mux.Vars(r)["icon_id"]
	if iconId == "" {
		c.SetInvalidURLParam("icon_id")
		return
	}

	var patch model.CustomChannelIconPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&patch); jsonErr != nil {
		c.SetInvalidParamWithErr("custom_channel_icon", jsonErr)
		return
	}

	if appErr := patch.IsValidPatch(); appErr != nil {
		c.Err = appErr
		return
	}

	// Get existing icon
	icon, err := c.App.Srv().Store().CustomChannelIcon().Get(iconId)
	if err != nil {
		if _, ok := err.(*store.ErrNotFound); ok {
			c.Err = model.NewAppError("updateCustomChannelIcon", "api.custom_channel_icon.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
			return
		}
		c.Err = model.NewAppError("updateCustomChannelIcon", "api.custom_channel_icon.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Apply patch
	icon.Patch(&patch)

	updatedIcon, err := c.App.Srv().Store().CustomChannelIcon().Update(icon)
	if err != nil {
		c.Err = model.NewAppError("updateCustomChannelIcon", "api.custom_channel_icon.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Broadcast WebSocket event to all users
	message := model.NewWebSocketEvent(model.WebsocketEventCustomChannelIconUpdated, "", "", "", nil, "")
	message.Add("icon", updatedIcon)
	c.App.Publish(message)

	if err := json.NewEncoder(w).Encode(updatedIcon); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// deleteCustomChannelIcon deletes a custom channel icon (admin only)
func deleteCustomChannelIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.CustomChannelIcons {
		c.Err = model.NewAppError("deleteCustomChannelIcon", "api.custom_channel_icon.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Only system admins can delete custom icons
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	iconId := mux.Vars(r)["icon_id"]
	if iconId == "" {
		c.SetInvalidURLParam("icon_id")
		return
	}

	deleteAt := model.GetMillis()
	if err := c.App.Srv().Store().CustomChannelIcon().Delete(iconId, deleteAt); err != nil {
		if _, ok := err.(*store.ErrNotFound); ok {
			c.Err = model.NewAppError("deleteCustomChannelIcon", "api.custom_channel_icon.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
			return
		}
		c.Err = model.NewAppError("deleteCustomChannelIcon", "api.custom_channel_icon.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Broadcast WebSocket event to all users
	message := model.NewWebSocketEvent(model.WebsocketEventCustomChannelIconDeleted, "", "", "", nil, "")
	message.Add("icon_id", iconId)
	c.App.Publish(message)

	ReturnStatusOK(w)
}
