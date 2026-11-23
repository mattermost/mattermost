// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/avct/uasurfer"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// GetPasskeysForUser returns the user's passkeys, oldest first. It is not gated on the Passkeys
// feature flag or license: the API layer decides who may call it.
func (a *App) GetPasskeysForUser(userID string) ([]*model.Passkey, *model.AppError) {
	passkeys, err := a.Srv().Store().Passkey().GetForUser(userID)
	if err != nil {
		return nil, model.NewAppError("GetPasskeysForUser", "app.passkey.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return passkeys, nil
}

// DeletePasskey removes one of the user's passkeys. A passkey that does not exist and one that
// belongs to someone else give the same 404, so callers learn nothing about other users' passkeys.
func (a *App) DeletePasskey(userID, passkeyID string) *model.AppError {
	if err := a.Srv().Store().Passkey().Delete(userID, passkeyID); err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return model.NewAppError("DeletePasskey", "app.passkey.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeletePasskey", "app.passkey.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// passkeyRelyingParty builds the WebAuthn relying party from the current config. It is rebuilt on
// every call because the Site URL can change at runtime and construction is cheap. Any reason the
// library or PasskeyRPID rejects the Site URL is reported as 501, never 500: the server is
// correctly configured to refuse, not broken.
func (a *App) passkeyRelyingParty() (*webauthn.WebAuthn, *model.AppError) {
	cfg := a.Config()
	siteURL := *cfg.ServiceSettings.SiteURL

	rpID, ok := model.PasskeyRPID(siteURL)
	if !ok {
		return nil, model.NewAppError("passkeyRelyingParty", "app.passkey.unavailable.app_error", nil, "", http.StatusNotImplemented)
	}

	// The origin is built from the ASCII RP ID, not the raw Site URL host, so an internationalized
	// host matches the punycode origin browsers report. PasskeyRPID already parsed siteURL.
	u, _ := url.Parse(siteURL)
	origin := u.Scheme + "://" + rpID
	if port := u.Port(); port != "" {
		origin += ":" + port
	}

	timeout := webauthn.TimeoutConfig{Enforce: true, Timeout: time.Duration(model.PasskeyCeremonyExpiryTime) * time.Millisecond}
	requireResidentKey := true
	rp, err := webauthn.New(&webauthn.Config{
		RPID:                  rpID,
		RPDisplayName:         *cfg.TeamSettings.SiteName,
		RPOrigins:             []string{origin},
		AttestationPreference: protocol.PreferNoAttestation,
		// Sign-in is usernameless, so every passkey must be discoverable.
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			RequireResidentKey: &requireResidentKey,
			ResidentKey:        protocol.ResidentKeyRequirementRequired,
			UserVerification:   protocol.VerificationRequired,
		},
		Timeouts: webauthn.TimeoutsConfig{Registration: timeout, Login: timeout},
	})
	if err != nil {
		return nil, model.NewAppError("passkeyRelyingParty", "app.passkey.unavailable.app_error", nil, "", http.StatusNotImplemented).Wrap(err)
	}
	return rp, nil
}

type passkeyUser struct {
	user     *model.User
	handle   []byte
	passkeys []*model.Passkey
}

func (u *passkeyUser) WebAuthnID() []byte { return u.handle }

func (u *passkeyUser) WebAuthnName() string { return u.user.Username }

func (u *passkeyUser) WebAuthnDisplayName() string {
	if name := u.user.GetFullName(); name != "" {
		return name
	}
	return u.user.Username
}

func (u *passkeyUser) WebAuthnCredentials() []webauthn.Credential {
	creds := make([]webauthn.Credential, 0, len(u.passkeys))
	for _, p := range u.passkeys {
		// The flags and counter are what sign-in checks the authenticator's response against: without
		// them a synced passkey is refused as inconsistent and a cloned one is never noticed.
		cred := webauthn.Credential{
			ID:        p.CredentialId,
			PublicKey: p.PublicKey,
			Flags:     webauthn.CredentialFlags{BackupEligible: p.BackupEligible, BackupState: p.BackupState},
			Authenticator: webauthn.Authenticator{
				AAGUID:    p.AAGUID,
				SignCount: uint32(p.SignCount),
			},
		}
		if p.Transports != "" {
			for t := range strings.SplitSeq(p.Transports, ",") {
				cred.Transport = append(cred.Transport, protocol.AuthenticatorTransport(t))
			}
		}
		creds = append(creds, cred)
	}
	return creds
}

// passkeyCeremony is the server-side state of a registration ceremony, stored in the Extra field of
// a passkey_registration token. The challenge lives here and never travels through the client.
type passkeyCeremony struct {
	UserID      string                `json:"user_id"`
	SessionID   string                `json:"session_id"`
	SessionData *webauthn.SessionData `json:"session_data"`
}

// passkeySignedInRecently reports whether the session was started by an interactive, non-passkey
// sign-in within the recent-login window. Sessions without the login_method prop (created before
// passkeys existed, or by access tokens, OAuth apps or plugins) are never recent.
func passkeySignedInRecently(session *model.Session) bool {
	return session.Props[model.SessionPropLoginMethod] == model.SessionLoginMethodStandard &&
		model.GetMillis()-session.CreateAt <= model.PasskeyRecentLoginWindow
}

// BeginPasskeyRegistration starts a registration ceremony for the session's user. It does not check
// the Passkeys feature flag or license: the API layer decides whether the caller may get here.
func (a *App) BeginPasskeyRegistration(rctx request.CTX, session *model.Session) (*model.PasskeyRegistrationOptions, *model.AppError) {
	user, appErr := a.GetUser(rctx, session.UserId)
	if appErr != nil {
		return nil, appErr
	}
	if user.IsBot || user.IsRemote() {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.user_not_allowed.app_error", nil, "", http.StatusForbidden)
	}
	if !passkeySignedInRecently(session) {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.recent_login_required.app_error", nil, "", http.StatusForbidden)
	}

	passkeys, appErr := a.GetPasskeysForUser(user.Id)
	if appErr != nil {
		return nil, appErr
	}
	if len(passkeys) >= model.PasskeyMaxPerUser {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.limit_reached.app_error", nil, "", http.StatusBadRequest)
	}

	rp, appErr := a.passkeyRelyingParty()
	if appErr != nil {
		return nil, appErr
	}

	// All of a user's passkeys share one handle, so a second authenticator maps to the same account.
	handle := make([]byte, model.PasskeyUserHandleSize)
	if len(passkeys) > 0 {
		handle = passkeys[0].UserHandle
	} else if _, err := rand.Read(handle); err != nil {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.begin_registration.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	wu := &passkeyUser{user: user, handle: handle, passkeys: passkeys}
	creds := wu.WebAuthnCredentials()
	exclusions := make([]protocol.CredentialDescriptor, len(creds))
	for i := range creds {
		exclusions[i] = creds[i].Descriptor()
	}

	creation, sessionData, err := rp.BeginRegistration(wu, webauthn.WithExclusions(exclusions))
	if err != nil {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.begin_registration.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	options, err := json.Marshal(creation)
	if err != nil {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.begin_registration.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	extra, err := json.Marshal(passkeyCeremony{UserID: user.Id, SessionID: session.Id, SessionData: sessionData})
	if err != nil {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.save_ceremony.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	token := model.NewToken(model.TokenTypePasskeyRegistration, string(extra))
	if err := a.Srv().Store().Token().Save(token); err != nil {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.save_ceremony.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &model.PasskeyRegistrationOptions{CeremonyId: token.Token, Options: options}, nil
}

// BeginPasskeyLogin starts a usernameless sign-in ceremony. It does not check the Passkeys feature
// flag, license or settings: the API layer decides whether the caller may get here.
func (a *App) BeginPasskeyLogin(rctx request.CTX) (*model.PasskeyLoginOptions, *model.AppError) {
	rp, appErr := a.passkeyRelyingParty()
	if appErr != nil {
		return nil, appErr
	}

	assertion, sessionData, err := rp.BeginDiscoverableLogin()
	if err != nil {
		return nil, model.NewAppError("BeginPasskeyLogin", "app.passkey.begin_login.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	options, err := json.Marshal(assertion)
	if err != nil {
		return nil, model.NewAppError("BeginPasskeyLogin", "app.passkey.begin_login.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	// No user or session exists yet; the authenticator names the user when it answers.
	extra, err := json.Marshal(passkeyCeremony{SessionData: sessionData})
	if err != nil {
		return nil, model.NewAppError("BeginPasskeyLogin", "app.passkey.save_ceremony.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	token := model.NewToken(model.TokenTypePasskeyLogin, string(extra))
	if err := a.Srv().Store().Token().Save(token); err != nil {
		return nil, model.NewAppError("BeginPasskeyLogin", "app.passkey.save_ceremony.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &model.PasskeyLoginOptions{CeremonyId: token.Token, Options: options}, nil
}

func defaultPasskeyName(userAgent string) string {
	ua := uasurfer.Parse(userAgent)
	browser := getBrowserName(ua, userAgent)
	os := getOSName(ua, userAgent)
	switch {
	case browser == "Unknown":
		return "Passkey"
	case os == "":
		return browser
	}
	return browser + " on " + os
}

// FinishPasskeyRegistration verifies the authenticator's response to a ceremony begun by
// BeginPasskeyRegistration and stores the new passkey. Like begin, it leaves the feature flag and
// license to the API layer. The ceremony is bound to the session that began it, and that same
// session must still be a recent sign-in: another session of the same user does not qualify.
func (a *App) FinishPasskeyRegistration(rctx request.CTX, session *model.Session, ceremonyID, name, userAgent string, credential []byte) (*model.Passkey, *model.AppError) {
	const where = "FinishPasskeyRegistration"

	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > model.PasskeyNameMaxRunes {
		return nil, model.NewAppError(where, "app.passkey.name_too_long.app_error", nil, "", http.StatusBadRequest)
	}
	if name == "" {
		name = defaultPasskeyName(userAgent)
	}

	invalidCeremony := func() *model.AppError {
		return model.NewAppError(where, "app.passkey.ceremony_invalid.app_error", nil, "", http.StatusBadRequest)
	}
	token, appErr := a.ConsumeTokenOnce(model.TokenTypePasskeyRegistration, ceremonyID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return nil, invalidCeremony()
		}
		return nil, model.NewAppError(where, "app.passkey.finish_registration.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}
	var ceremony passkeyCeremony
	if token.IsExpired() || json.Unmarshal([]byte(token.Extra), &ceremony) != nil ||
		ceremony.SessionData == nil || ceremony.UserID != session.UserId || ceremony.SessionID != session.Id {
		return nil, invalidCeremony()
	}

	// Checked again here: the session may have been recent when the ceremony began but not by now.
	if !passkeySignedInRecently(session) {
		return nil, model.NewAppError(where, "app.passkey.recent_login_required.app_error", nil, "", http.StatusForbidden)
	}

	invalidCredential := func(err error) *model.AppError {
		return model.NewAppError(where, "app.passkey.invalid_credential.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	parsed, err := protocol.ParseCredentialCreationResponseBytes(credential)
	if err != nil {
		return nil, invalidCredential(err)
	}

	user, appErr := a.GetUser(rctx, session.UserId)
	if appErr != nil {
		return nil, appErr
	}
	passkeys, appErr := a.GetPasskeysForUser(user.Id)
	if appErr != nil {
		return nil, appErr
	}
	rp, appErr := a.passkeyRelyingParty()
	if appErr != nil {
		return nil, appErr
	}
	// The library checks origin, RP ID hash, challenge and that user verification was performed.
	cred, err := rp.CreateCredential(&passkeyUser{user: user, handle: ceremony.SessionData.UserID, passkeys: passkeys}, *ceremony.SessionData, parsed)
	if err != nil {
		return nil, invalidCredential(err)
	}

	transports := make([]string, len(cred.Transport))
	for i, t := range cred.Transport {
		transports[i] = string(t)
	}
	saved, err := a.Srv().Store().Passkey().SaveIfUnderLimit(&model.Passkey{
		UserId:         user.Id,
		UserHandle:     ceremony.SessionData.UserID,
		CredentialId:   cred.ID,
		PublicKey:      cred.PublicKey,
		AAGUID:         cred.Authenticator.AAGUID,
		Transports:     strings.Join(transports, ","),
		SignCount:      int64(cred.Authenticator.SignCount),
		BackupEligible: cred.Flags.BackupEligible,
		BackupState:    cred.Flags.BackupState,
		Name:           name,
	}, model.PasskeyMaxPerUser)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrLimitExceeded](err); ok {
			return nil, model.NewAppError(where, "app.passkey.limit_reached.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if _, ok := errors.AsType[*store.ErrConflict](err); ok {
			return nil, model.NewAppError(where, "app.passkey.already_registered.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if validationErr, ok := errors.AsType[*model.AppError](err); ok {
			return nil, validationErr
		}
		return nil, model.NewAppError(where, "app.passkey.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().EmailService.SendPasskeyAddedEmail(user.Email, user.Locale, a.GetSiteURL(), saved.Name); err != nil {
		rctx.Logger().Error("Unable to send passkey added email", mlog.Err(err), mlog.String("user_id", user.Id))
	}
	return saved, nil
}

// FinishPasskeyLogin verifies the authenticator's response to a ceremony begun by BeginPasskeyLogin
// and returns the passkey's user after the account checks password sign-in applies. It creates no
// session, checks no MFA code and leaves the user's failed-attempt count alone: a failed assertion is
// not a failed password attempt, and a passkey sign-in is not a reason to forgive earlier ones.
func (a *App) FinishPasskeyLogin(rctx request.CTX, ceremonyID string, credential []byte) (*model.User, *model.AppError) {
	const where = "FinishPasskeyLogin"

	invalidCeremony := func() *model.AppError {
		return model.NewAppError(where, "app.passkey.ceremony_invalid.app_error", nil, "", http.StatusBadRequest)
	}
	token, appErr := a.ConsumeTokenOnce(model.TokenTypePasskeyLogin, ceremonyID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return nil, invalidCeremony()
		}
		return nil, model.NewAppError(where, "app.passkey.finish_login.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}
	var ceremony passkeyCeremony
	if token.IsExpired() || json.Unmarshal([]byte(token.Extra), &ceremony) != nil || ceremony.SessionData == nil {
		return nil, invalidCeremony()
	}

	invalidCredential := func(err error) *model.AppError {
		return model.NewAppError(where, "app.passkey.invalid_credential.app_error", nil, "", http.StatusUnauthorized).Wrap(err)
	}
	counterRegressed := func(err error) *model.AppError {
		return model.NewAppError(where, "app.passkey.counter_regressed.app_error", nil, "", http.StatusUnauthorized).Wrap(err)
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(credential)
	if err != nil {
		return nil, model.NewAppError(where, "app.passkey.invalid_credential.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rp, appErr := a.passkeyRelyingParty()
	if appErr != nil {
		return nil, appErr
	}

	// The library wraps whatever the handler returns, so the reason is carried out in these.
	var passkey *model.Passkey
	var unknownCredential bool
	var handlerAppErr *model.AppError
	handler := func(rawID, _ []byte) (webauthn.User, error) {
		var getErr error
		if passkey, getErr = a.Srv().Store().Passkey().GetByCredentialId(rawID); getErr != nil {
			if _, ok := errors.AsType[*store.ErrNotFound](getErr); ok {
				unknownCredential = true
			} else {
				handlerAppErr = model.NewAppError(where, "app.passkey.finish_login.app_error", nil, "", http.StatusInternalServerError).Wrap(getErr)
			}
			return nil, getErr
		}
		user, appErr := a.GetUser(rctx, passkey.UserId)
		if appErr != nil {
			handlerAppErr = appErr
			return nil, appErr
		}
		return &passkeyUser{user: user, handle: passkey.UserHandle, passkeys: []*model.Passkey{passkey}}, nil
	}
	// The library checks that the user handle belongs to the passkey, the origin, RP ID hash,
	// challenge, signature and that user verification was performed.
	wu, cred, err := rp.ValidatePasskeyLogin(handler, *ceremony.SessionData, parsed)
	if err != nil {
		switch {
		case handlerAppErr != nil:
			return nil, handlerAppErr
		case unknownCredential:
			return nil, model.NewAppError(where, "app.passkey.unknown_credential.app_error", nil, "", http.StatusUnauthorized).Wrap(err)
		}
		return nil, invalidCredential(err)
	}
	user := wu.(*passkeyUser).user

	// A counter that does not increase means the authenticator may have been cloned. The library flags
	// it; the explicit comparison is kept because UpdateUsage only compares the previous value, so a
	// flag the library stopped raising would let a replayed counter through. A counter that stays at 0
	// is normal for synced passkeys.
	presented := parsed.Response.AuthenticatorData.Counter
	if cred.Authenticator.CloneWarning || (presented != 0 && int64(presented) <= passkey.SignCount) {
		return nil, counterRegressed(errors.New("authenticator counter did not increase"))
	}

	maxAttempts := *a.Config().ServiceSettings.MaximumLoginAttempts
	if user.AuthService == model.UserAuthServiceLdap {
		maxAttempts = *a.Config().LdapSettings.MaximumLoginAttempts
	}
	for _, err := range []error{
		checkUserNotDisabled(user),
		checkUserNotBot(user),
		checkUserLoginAttempts(user, maxAttempts),
		a.CheckUserPostflightAuthenticationCriteria(rctx, user),
	} {
		if err == nil {
			continue
		}
		if appErr, ok := errors.AsType[*model.AppError](err); ok {
			return nil, appErr
		}
		return nil, model.NewAppError(where, "app.passkey.finish_login.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Passkey().UpdateUsage(passkey.Id, passkey.SignCount, int64(cred.Authenticator.SignCount), model.GetMillis()); err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, counterRegressed(err)
		}
		return nil, model.NewAppError(where, "app.passkey.update_usage.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return user, nil
}
