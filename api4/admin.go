// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (api *API) InitAdmin() {
	l4g.Debug(utils.T("api.admin.init.debug"))

	api.BaseRoutes.Admin.Handle("/users/update", api.ApiSessionRequiredTrustRequester(adminUpdateUser)).Methods("POST")
}

func adminUpdateUser(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	props := model.MapFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("parameters map")
		return
	}

	var authData = new(string)
	*authData = props["auth_data"]
	authService := props["auth_service"]
	password := props["password"]

	if authData == nil || *authData == "" || authService == "" {
		if err := c.App.IsPasswordValid(props["password"]); err != nil {
			c.SetInvalidParam("password")
			return
		}
		authData = nil
		authService = ""
	} else {
		password = ""
	}

	if result := <-c.App.Srv.Store.User().AdminUpdateAuthData(props["id"], authData, authService, password); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		updatedUser := result.Data.(*model.User)

		c.App.InvalidateCacheForUser(props["id"])
		c.App.SanitizeProfile(updatedUser, c.IsSystemAdmin())

		omitUsers := make(map[string]bool, 1)
		omitUsers[props["id"]] = true
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", omitUsers)
		message.Add("user", updatedUser)
		go c.App.Publish(message)

		updatedUser.Password = ""
		if authData != nil {
			updatedUser.AuthData = new(string)
			*updatedUser.AuthData = *authData
		}
		w.Write([]byte(updatedUser.ToJson()))
	}
}
