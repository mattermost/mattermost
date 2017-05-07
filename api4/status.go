// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitStatus() {
	l4g.Debug(utils.T("api.status.init.debug"))

	BaseRoutes.User.Handle("/status", ApiHandler(getUserStatus)).Methods("GET")
	BaseRoutes.Users.Handle("/status/ids", ApiHandler(getUserStatusesByIds)).Methods("POST")
	BaseRoutes.User.Handle("/status", ApiHandler(updateUserStatus)).Methods("PUT")
}

func getUserStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	// No permission check required

	if statusMap, err := app.GetUserStatusesByIds([]string{c.Params.UserId}); err != nil {
		c.Err = err
		return
	} else {
		if len(statusMap) == 0 {
			c.Err = model.NewAppError("UserStatus", "api.status.user_not_found.app_error", nil, "", http.StatusNotFound)
			return
		} else {
			w.Write([]byte(statusMap[0].ToJson()))
		}
	}
}

func getUserStatusesByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	// No permission check required

	if statusMap, err := app.GetUserStatusesByIds(userIds); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.StatusListToJson(statusMap)))
	}
}

func updateUserStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	status := model.StatusFromJson(r.Body)
	if status == nil {
		c.SetInvalidParam("status")
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	switch status.Status {
	case "online":
		app.SetStatusOnline(c.Params.UserId, "", true)
	case "offline":
		app.SetStatusOffline(c.Params.UserId, true)
	case "away":
		app.SetStatusAwayIfNeeded(c.Params.UserId, true)
	default:
		c.SetInvalidParam("status")
		return
	}

	getUserStatus(c, w, r)
}
