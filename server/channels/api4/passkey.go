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
	api.BaseRoutes.User.Handle("/passkeys/registration/begin", api.APISessionRequired(beginPasskeyRegistration)).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/passkeys/registration/finish", api.APISessionRequired(finishPasskeyRegistration)).Methods(http.MethodPost)
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

// requirePasskeyEnrollment is requirePasskeys plus what registering a new passkey needs: a Site URL
// that can serve as a relying party, and enrollment turned on. Login being off does not matter.
func requirePasskeyEnrollment(c *Context) bool {
	if !requirePasskeys(c) {
		return false
	}

	cfg := c.App.Config()
	if !model.PasskeysAvailable(cfg, c.App.Channels().License()) {
		c.Err = model.NewAppError("requirePasskeyEnrollment", "api.passkey.unavailable.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	if !*cfg.ServiceSettings.EnablePasskeyEnrollment {
		c.Err = model.NewAppError("requirePasskeyEnrollment", "api.passkey.enrollment_disabled.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	return true
}

// beginPasskeyRegistration and finishPasskeyRegistration pass the request's own session to the app:
// the ceremony is bound to the sign-in that started it, so it must not be looked up by user id.
func beginPasskeyRegistration(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyEnrollment(c) {
		return
	}

	options, appErr := c.App.BeginPasskeyRegistration(c.AppContext, c.AppContext.Session())
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(options); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func finishPasskeyRegistration(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyEnrollment(c) {
		return
	}

	var finish model.PasskeyRegistrationFinish
	if err := json.NewDecoder(r.Body).Decode(&finish); err != nil {
		c.SetInvalidParamWithErr("passkey", err)
		return
	}
	if finish.CeremonyId == "" {
		c.SetInvalidParam("ceremony_id")
		return
	}
	if len(finish.Credential) == 0 {
		c.SetInvalidParam("credential")
		return
	}

	passkey, appErr := c.App.FinishPasskeyRegistration(c.AppContext, c.AppContext.Session(), finish.CeremonyId, finish.Name, r.UserAgent(), finish.Credential)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(passkey); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
