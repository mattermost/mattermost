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
	user := model.UserFromJson(r.Body)

	if user == nil {
		c.SetInvalidParam("updateUser")
		return
	}

	if !c.App.SessionHasPermissionToUser(c.Session, user.Id) {
		return
	}

	if err := utils.IsPasswordValid(user.Password); user.Password != "" && err != nil {
		c.Err = err
		return
	}

	if result := <-c.App.Srv.Store.User().AdminUpdate(user, false); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("")

		rusers := result.Data.([2]*model.User)

		if rusers[0].Email != rusers[1].Email {
			c.App.Go(func() {
				if err := c.App.SendEmailChangeEmail(rusers[1].Email, rusers[0].Email, rusers[0].Locale, utils.GetSiteURL()); err != nil {
					l4g.Error(err.Error())
				}
			})

			if c.App.Config().EmailSettings.RequireEmailVerification {
				if err := c.App.SendEmailVerification(rusers[0]); err != nil {
					l4g.Error(err.Error())
				}
			}
		}

		if rusers[0].Username != rusers[1].Username {
			c.App.Go(func() {
				if err := c.App.SendChangeUsernameEmail(rusers[1].Username, rusers[0].Username, rusers[0].Email, rusers[0].Locale, utils.GetSiteURL()); err != nil {
					l4g.Error(err.Error())
				}
			})
		}

		c.App.InvalidateCacheForUser(user.Id)

		updatedUser := rusers[0]
		c.App.SanitizeProfile(updatedUser, c.IsSystemAdmin())

		omitUsers := make(map[string]bool, 1)
		omitUsers[user.Id] = true
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", omitUsers)
		message.Add("user", updatedUser)
		go c.App.Publish(message)

		rusers[0].Password = ""
		rusers[0].AuthData = new(string)
		*rusers[0].AuthData = ""
		w.Write([]byte(rusers[0].ToJson()))
	}
}
