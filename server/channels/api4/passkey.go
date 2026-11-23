// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

func (api *API) InitPasskey() {
	api.BaseRoutes.User.Handle("/passkeys", api.APISessionRequired(getPasskeys)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/passkeys/{passkey_id:[A-Za-z0-9]+}", api.APISessionRequired(deletePasskey)).Methods(http.MethodDelete)
}

// requirePasskeys sets c.Err and returns false unless the caller is the user in the URL and
// passkeys are enabled for the server. The caller check comes first so another user's request
// learns nothing about the flag or license. It deliberately ignores the enrollment and login
// settings and the Site URL, so users can still list and delete passkeys they already have.
func requirePasskeys(c *Context) bool {
	c.RequireUserId()
	if c.Err != nil {
		return false
	}

	if c.Params.UserId != c.AppContext.Session().UserId {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return false
	}

	if !c.App.Config().FeatureFlags.Passkeys {
		c.Err = model.NewAppError("requirePasskeys", "api.passkey.feature_disabled.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	if !model.MinimumProfessionalLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("requirePasskeys", "api.passkey.license.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	return true
}

func getPasskeys(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeys(c) {
		return
	}

	passkeys, appErr := c.App.GetPasskeysForUser(c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(passkeys); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePasskey(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeys(c) {
		return
	}

	passkeyID := mux.Vars(r)["passkey_id"]
	if !model.IsValidId(passkeyID) {
		c.SetInvalidURLParam("passkey_id")
		return
	}

	if appErr := c.App.DeletePasskey(c.Params.UserId, passkeyID); appErr != nil {
		c.Err = appErr
		return
	}

	web.ReturnStatusOK(w)
}
