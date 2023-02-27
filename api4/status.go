// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitStatus() {
	api.BaseRoutes.User.Handle("/status", api.APISessionRequired(getUserStatus)).Methods("GET")
	api.BaseRoutes.Users.Handle("/status/ids", api.APISessionRequired(getUserStatusesByIds)).Methods("POST")
	api.BaseRoutes.User.Handle("/status", api.APISessionRequired(updateUserStatus)).Methods("PUT")
	api.BaseRoutes.User.Handle("/status/custom", api.APISessionRequired(updateUserCustomStatus)).Methods("PUT")
	api.BaseRoutes.User.Handle("/status/custom", api.APISessionRequired(removeUserCustomStatus)).Methods("DELETE")

	// Both these handlers are for removing the recent custom status but the one with the POST method should be preferred
	// as DELETE method doesn't support request body in the mobile app.
	api.BaseRoutes.User.Handle("/status/custom/recent", api.APISessionRequired(removeUserRecentCustomStatus)).Methods("DELETE")
	api.BaseRoutes.User.Handle("/status/custom/recent/delete", api.APISessionRequired(removeUserRecentCustomStatus)).Methods("POST")
}

func getUserStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	// No permission check required

	statusMap, err := c.App.GetUserStatusesByIds([]string{c.Params.UserId})
	if err != nil {
		c.Err = err
		return
	}

	if len(statusMap) == 0 {
		c.Err = model.NewAppError("UserStatus", "api.status.user_not_found.app_error", nil, "", http.StatusNotFound)
		return
	}

	if err := json.NewEncoder(w).Encode(statusMap[0]); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getUserStatusesByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJSON(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	for _, userId := range userIds {
		if len(userId) != 26 {
			c.SetInvalidParam("user_ids")
			return
		}
	}

	// No permission check required
	statuses, appErr := c.App.GetUserStatusesByIds(userIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(statuses)
	if err != nil {
		c.Err = model.NewAppError("getUserStatusesByIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func updateUserStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	var status model.Status
	if jsonErr := json.NewDecoder(r.Body).Decode(&status); jsonErr != nil {
		c.SetInvalidParamWithErr("status", jsonErr)
		return
	}

	// The user being updated in the payload must be the same one as indicated in the URL.
	if status.UserId != c.Params.UserId {
		c.SetInvalidParam("user_id")
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	currentStatus, err := c.App.GetStatus(c.Params.UserId)
	if err == nil && currentStatus.Status == model.StatusOutOfOffice && status.Status != model.StatusOutOfOffice {
		c.App.DisableAutoResponder(c.AppContext, c.Params.UserId, c.IsSystemAdmin())
	}

	switch status.Status {
	case "online":
		c.App.SetStatusOnline(c.Params.UserId, true)
	case "offline":
		c.App.SetStatusOffline(c.Params.UserId, true)
	case "away":
		c.App.SetStatusAwayIfNeeded(c.Params.UserId, true)
	case "dnd":
		c.App.SetStatusDoNotDisturbTimed(c.Params.UserId, status.DNDEndTime)
	default:
		c.SetInvalidParam("status")
		return
	}

	getUserStatus(c, w, r)
}

func updateUserCustomStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().TeamSettings.EnableCustomUserStatuses {
		c.Err = model.NewAppError("updateUserCustomStatus", "api.custom_status.disabled", nil, "", http.StatusNotImplemented)
		return
	}

	var customStatus model.CustomStatus
	jsonErr := json.NewDecoder(r.Body).Decode(&customStatus)
	if jsonErr != nil || (customStatus.Emoji == "" && customStatus.Text == "") || !customStatus.AreDurationAndExpirationTimeValid() {
		c.SetInvalidParamWithErr("custom_status", jsonErr)
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	customStatus.PreSave()
	err := c.App.SetCustomStatus(c.AppContext, c.Params.UserId, &customStatus)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeUserCustomStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().TeamSettings.EnableCustomUserStatuses {
		c.Err = model.NewAppError("removeUserCustomStatus", "api.custom_status.disabled", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err := c.App.RemoveCustomStatus(c.AppContext, c.Params.UserId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeUserRecentCustomStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().TeamSettings.EnableCustomUserStatuses {
		c.Err = model.NewAppError("removeUserRecentCustomStatus", "api.custom_status.disabled", nil, "", http.StatusNotImplemented)
		return
	}

	var recentCustomStatus model.CustomStatus
	if jsonErr := json.NewDecoder(r.Body).Decode(&recentCustomStatus); jsonErr != nil {
		c.SetInvalidParamWithErr("recent_custom_status", jsonErr)
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if err := c.App.RemoveRecentCustomStatus(c.Params.UserId, &recentCustomStatus); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
