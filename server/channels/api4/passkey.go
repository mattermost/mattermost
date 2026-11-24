// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

func (api *API) InitPasskey() {
	api.BaseRoutes.User.Handle("/passkeys", api.APISessionRequired(getPasskeys)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/passkeys/registration/begin", api.RateLimitedHandler(api.APISessionRequired(beginPasskeyRegistration), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/passkeys/registration/finish", api.RateLimitedHandler(api.APISessionRequired(finishPasskeyRegistration), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.User.Handle("/passkeys/enrollment/ticket", api.RateLimitedHandler(api.APISessionRequired(createPasskeyEnrollmentTicket), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/passkeys/enrollment/registration/begin", api.RateLimitedHandler(api.APIHandler(beginPasskeyRegistrationWithTicket), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/passkeys/enrollment/registration/finish", api.RateLimitedHandler(api.APIHandler(finishPasskeyRegistrationWithTicket), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/passkeys/enrollment/verification/begin", api.RateLimitedHandler(api.APIHandler(beginPasskeyVerificationWithTicket), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/passkeys/enrollment/verification/finish", api.RateLimitedHandler(api.APIHandler(finishPasskeyVerificationWithTicket), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/login/passkey/begin", api.RateLimitedHandler(api.APIHandler(beginPasskeyLogin), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/login/passkey/finish", api.RateLimitedHandler(api.APIHandler(finishPasskeyLogin), loginRateLimit())).Methods(http.MethodPost)
	api.BaseRoutes.Users.Handle("/sessions/revoke/passkey", api.APISessionRequired(revokePasskeySessions)).Methods(http.MethodPost)
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

	return requirePasskeyFlagAndLicense(c)
}

// requirePasskeyFlagAndLicense is the part of the gate that needs no caller: the Passkeys feature
// flag and a Professional license.
func requirePasskeyFlagAndLicense(c *Context) bool {
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

	return requirePasskeyEnrollmentEnabled(c)
}

// requirePasskeyEnrollmentEnabled gates the ticket enrollment endpoints, which have no caller: flag,
// license, a usable Site URL, then the enrollment setting. Login being on or off does not matter.
func requirePasskeyEnrollmentEnabled(c *Context) bool {
	if !requirePasskeyFlagAndLicense(c) {
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

// requirePasskeyLogin gates the sign-in endpoints, which have no caller: flag, license, a usable
// Site URL, then the login setting. Enrollment being on or off does not matter.
func requirePasskeyLogin(c *Context) bool {
	if !requirePasskeyFlagAndLicense(c) {
		return false
	}

	cfg := c.App.Config()
	if !model.PasskeysAvailable(cfg, c.App.Channels().License()) {
		c.Err = model.NewAppError("requirePasskeyLogin", "api.passkey.unavailable.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	if !*cfg.ServiceSettings.EnablePasskeyLogin {
		c.Err = model.NewAppError("requirePasskeyLogin", "api.passkey.login_disabled.app_error", nil, "", http.StatusNotImplemented)
		return false
	}

	return true
}

func beginPasskeyLogin(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyLogin(c) {
		return
	}

	options, appErr := c.App.BeginPasskeyLogin(c.AppContext)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(options); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// finishPasskeyLogin passes the app layer's errors through unmasked: none of them says anything about
// an account the caller does not already hold a passkey for.
func finishPasskeyLogin(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyLogin(c) {
		return
	}

	var finish model.PasskeyLoginFinish
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

	user, appErr := c.App.FinishPasskeyLogin(c.AppContext, finish.CeremonyId, finish.Credential)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if appErr = checkUserMaySignIn(c, user); appErr != nil {
		c.Err = appErr
		return
	}

	var session *model.Session
	session, appErr = c.App.DoLogin(c.AppContext, w, r, user, model.LoginOptions{
		IsMobile:    utils.IsMobileRequest(r),
		IsOAuthUser: user.IsOAuthUser(),
		IsSaml:      user.IsSAMLUser(),
		IsPasskey:   true,
	})
	if appErr != nil {
		c.Err = appErr
		return
	}
	c.AppContext = c.AppContext.WithSession(session)

	if r.Header.Get(model.HeaderRequestedWith) == model.HeaderRequestedWithXML {
		c.App.AttachSessionCookies(c.AppContext, w, r)
	}

	userTermsOfService, appErr := c.App.GetUserTermsOfService(user.Id)
	if appErr != nil && appErr.StatusCode != http.StatusNotFound {
		c.Err = appErr
		return
	}
	if userTermsOfService != nil {
		user.TermsOfServiceId = userTermsOfService.TermsOfServiceId
		user.TermsOfServiceCreateAt = userTermsOfService.CreateAt
	}

	user.Sanitize(map[string]bool{})

	if err := json.NewEncoder(w).Encode(user); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	finish := decodePasskeyRegistrationFinish(c, r)
	if finish == nil {
		return
	}

	passkey, appErr := c.App.FinishPasskeyRegistration(c.AppContext, c.AppContext.Session(), finish.CeremonyId, finish.Name, r.UserAgent(), finish.Credential)
	writePasskeyRegistered(c, w, passkey, appErr)
}

// decodePasskeyRegistrationFinish reads and validates the finish body, returning nil with c.Err set
// when it is unusable.
func decodePasskeyRegistrationFinish(c *Context, r *http.Request) *model.PasskeyRegistrationFinish {
	var finish model.PasskeyRegistrationFinish
	if err := json.NewDecoder(r.Body).Decode(&finish); err != nil {
		c.SetInvalidParamWithErr("passkey", err)
		return nil
	}
	if finish.CeremonyId == "" {
		c.SetInvalidParam("ceremony_id")
		return nil
	}
	if len(finish.Credential) == 0 {
		c.SetInvalidParam("credential")
		return nil
	}
	return &finish
}

func writePasskeyRegistered(c *Context, w http.ResponseWriter, passkey *model.Passkey, appErr *model.AppError) {
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(passkey); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// beginPasskeyRegistrationWithTicket and finishPasskeyRegistrationWithTicket never read the request's
// session: the browser page may be signed out or signed in as anyone, and the ticket alone decides
// which account gets the passkey.
func beginPasskeyRegistrationWithTicket(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyEnrollmentEnabled(c) {
		return
	}

	var body model.PasskeyEnrollmentTicket
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.SetInvalidParamWithErr("ticket", err)
		return
	}
	if body.Ticket == "" {
		c.SetInvalidParam("ticket")
		return
	}

	options, appErr := c.App.BeginPasskeyRegistrationWithTicket(c.AppContext, body.Ticket)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(options); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func finishPasskeyRegistrationWithTicket(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyEnrollmentEnabled(c) {
		return
	}

	finish := decodePasskeyRegistrationFinish(c, r)
	if finish == nil {
		return
	}

	passkey, appErr := c.App.FinishPasskeyRegistrationWithTicket(c.AppContext, finish.CeremonyId, finish.Name, r.UserAgent(), finish.Credential)
	writePasskeyRegistered(c, w, passkey, appErr)
}

// beginPasskeyVerificationWithTicket and finishPasskeyVerificationWithTicket check that the device holds
// one of the ticket user's passkeys. Finishing starts no session, so nothing here needs login enabled.
func beginPasskeyVerificationWithTicket(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyEnrollmentEnabled(c) {
		return
	}

	var body model.PasskeyEnrollmentTicket
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.SetInvalidParamWithErr("ticket", err)
		return
	}
	if body.Ticket == "" {
		c.SetInvalidParam("ticket")
		return
	}

	options, appErr := c.App.BeginPasskeyVerificationWithTicket(c.AppContext, body.Ticket)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(options); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func finishPasskeyVerificationWithTicket(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyEnrollmentEnabled(c) {
		return
	}

	var finish model.PasskeyLoginFinish
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

	if appErr := c.App.FinishPasskeyVerificationWithTicket(c.AppContext, finish.CeremonyId, finish.Credential); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

// createPasskeyEnrollmentTicket hands the app the request's own session: the ticket borrows that
// session's standing when it is later redeemed, so it must not be tied to another session of the user.
func createPasskeyEnrollmentTicket(c *Context, w http.ResponseWriter, r *http.Request) {
	if !requirePasskeyEnrollment(c) {
		return
	}

	ticket, appErr := c.App.CreatePasskeyEnrollmentTicket(c.AppContext, c.AppContext.Session())
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(ticket); err != nil {
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

// revokePasskeySessions checks the permission before the flag and license so a non-admin learns
// nothing about them. It ignores the login and enrollment settings: the moment an admin needs it is
// right after turning passkey sign-in off, when sessions started while it was on still exist.
func revokePasskeySessions(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !requirePasskeyFlagAndLicense(c) {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRevokePasskeySessions, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if appErr := c.App.RevokePasskeySessions(c.AppContext); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}
