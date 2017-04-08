// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitOAuth() {
	l4g.Debug(utils.T("api.oauth.init.debug"))

	BaseRoutes.OAuth.Handle("/apps", ApiSessionRequired(createOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/apps", ApiSessionRequired(getOAuthApps)).Methods("GET")
}

func createOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	oauthApp := model.OAuthAppFromJson(r.Body)

	if oauthApp == nil {
		c.SetInvalidParam("oauth_app")
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	oauthApp.CreatorId = c.Session.UserId

	rapp, err := app.CreateOAuthApp(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("client_id=" + rapp.Id)
	w.Write([]byte(rapp.ToJson()))
}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	var apps []*model.OAuthApp
	var err *model.AppError
	if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		apps, err = app.GetOAuthApps(c.Params.Page, c.Params.PerPage)
	} else if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		apps, err = app.GetOAuthAppsByCreator(c.Session.UserId, c.Params.Page, c.Params.PerPage)
	} else {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.OAuthAppListToJson(apps)))
}
