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
	// Ticket is the enrollment ticket the ceremony was begun with; empty for one begun from a session.
	Ticket string `json:"ticket,omitempty"`
}

// passkeyEnrollmentTicket is the Extra of a passkey_enrollment_ticket token: the session that asked for
// the ticket, which is the only session whose standing the ticket may borrow.
type passkeyEnrollmentTicket struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
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
	return a.beginPasskeyRegistration(rctx, session, "")
}

// BeginPasskeyRegistrationWithTicket starts a registration ceremony for the user of the session that
// issued the enrollment ticket. The ticket is only read here, not consumed, so the browser page may
// begin again while the ticket is valid; the first successful finish spends it. The recent sign-in
// rule applies to the issuing session, not to any other session of the user.
func (a *App) BeginPasskeyRegistrationWithTicket(rctx request.CTX, ticket string) (*model.PasskeyRegistrationOptions, *model.AppError) {
	session, appErr := a.passkeyTicketSession(rctx, ticket)
	if appErr != nil {
		return nil, appErr
	}
	return a.beginPasskeyRegistration(rctx, session, ticket)
}

// passkeyTicketSession resolves an enrollment ticket to the session that issued it without consuming
// the ticket. Every way the ticket can be unusable (unknown, other type, expired, unreadable, or its
// session gone, expired or someone else's) gives the same ticket_invalid, so callers learn nothing
// about which.
func (a *App) passkeyTicketSession(rctx request.CTX, ticket string) (*model.Session, *model.AppError) {
	const where = "passkeyTicketSession"

	invalid := func() *model.AppError {
		return model.NewAppError(where, "app.passkey.ticket_invalid.app_error", nil, "", http.StatusBadRequest)
	}
	readFailed := func(err error) *model.AppError {
		return model.NewAppError(where, "app.passkey.get_ticket.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	token, err := a.Srv().Store().Token().GetByToken(ticket)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, invalid()
		}
		return nil, readFailed(err)
	}
	var t passkeyEnrollmentTicket
	if token.Type != model.TokenTypePasskeyEnrollmentTicket || token.IsExpired() || json.Unmarshal([]byte(token.Extra), &t) != nil {
		return nil, invalid()
	}

	session, appErr := a.GetSessionById(rctx, t.SessionID)
	if appErr != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](appErr); ok {
			return nil, invalid()
		}
		return nil, readFailed(appErr)
	}
	if session.IsExpired() || session.UserId != t.UserID {
		return nil, invalid()
	}
	return session, nil
}

// beginPasskeyRegistration is the begin step for both entry points. ticket is stored in the ceremony
// so finish can tell which entry point began it; it is empty for a ceremony begun from a session.
func (a *App) beginPasskeyRegistration(rctx request.CTX, session *model.Session, ticket string) (*model.PasskeyRegistrationOptions, *model.AppError) {
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
	extra, err := json.Marshal(passkeyCeremony{UserID: user.Id, SessionID: session.Id, SessionData: sessionData, Ticket: ticket})
	if err != nil {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.save_ceremony.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	token := model.NewToken(model.TokenTypePasskeyRegistration, string(extra))
	if err := a.Srv().Store().Token().Save(token); err != nil {
		return nil, model.NewAppError("BeginPasskeyRegistration", "app.passkey.save_ceremony.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &model.PasskeyRegistrationOptions{CeremonyId: token.Token, Options: options}, nil
}

// CreatePasskeyEnrollmentTicket issues a single-use ticket that lets the system browser enroll a
// passkey for the session's user. The ticket is tied to the given session, which must be the
// request's own. It checks no recent-sign-in window (registering through the ticket does, against
// the issuing session) and, like BeginPasskeyRegistration, no feature flag or license.
func (a *App) CreatePasskeyEnrollmentTicket(rctx request.CTX, session *model.Session) (*model.PasskeyEnrollmentTicket, *model.AppError) {
	user, appErr := a.GetUser(rctx, session.UserId)
	if appErr != nil {
		return nil, appErr
	}
	if user.IsBot || user.IsRemote() {
		return nil, model.NewAppError("CreatePasskeyEnrollmentTicket", "app.passkey.user_not_allowed.app_error", nil, "", http.StatusForbidden)
	}

	extra, err := json.Marshal(passkeyEnrollmentTicket{UserID: user.Id, SessionID: session.Id})
	if err != nil {
		return nil, model.NewAppError("CreatePasskeyEnrollmentTicket", "app.passkey.save_ticket.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	token := model.NewToken(model.TokenTypePasskeyEnrollmentTicket, string(extra))
	if err := a.Srv().Store().Token().Save(token); err != nil {
		return nil, model.NewAppError("CreatePasskeyEnrollmentTicket", "app.passkey.save_ticket.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &model.PasskeyEnrollmentTicket{Ticket: token.Token, ExpireAt: token.CreateAt + model.PasskeyEnrollmentTicketExpiryTime}, nil
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

	name, ceremony, appErr := a.takePasskeyCeremony(where, ceremonyID, name, userAgent)
	if appErr != nil {
		return nil, appErr
	}
	// A ceremony begun with a ticket must finish through the ticket, or the ticket would outlive it.
	if ceremony.Ticket != "" || ceremony.UserID != session.UserId || ceremony.SessionID != session.Id {
		return nil, model.NewAppError(where, "app.passkey.ceremony_invalid.app_error", nil, "", http.StatusBadRequest)
	}
	return a.completePasskeyRegistration(rctx, where, session, ceremony, name, credential)
}

// FinishPasskeyRegistrationWithTicket verifies the authenticator's response to a ceremony begun by
// BeginPasskeyRegistrationWithTicket and stores the new passkey. The issuing session is resolved again
// from the ticket and must still be a recent sign-in. The ticket is spent once the library accepts
// the credential, before the passkey is saved: a refused credential leaves the ticket usable, and
// two finishes on one ticket save at most one passkey.
func (a *App) FinishPasskeyRegistrationWithTicket(rctx request.CTX, ceremonyID, name, userAgent string, credential []byte) (*model.Passkey, *model.AppError) {
	const where = "FinishPasskeyRegistrationWithTicket"

	name, ceremony, appErr := a.takePasskeyCeremony(where, ceremonyID, name, userAgent)
	if appErr != nil {
		return nil, appErr
	}
	invalidCeremony := model.NewAppError(where, "app.passkey.ceremony_invalid.app_error", nil, "", http.StatusBadRequest)
	if ceremony.Ticket == "" {
		return nil, invalidCeremony
	}
	session, appErr := a.passkeyTicketSession(rctx, ceremony.Ticket)
	if appErr != nil {
		return nil, appErr
	}
	if ceremony.UserID != session.UserId || ceremony.SessionID != session.Id {
		return nil, invalidCeremony
	}
	return a.completePasskeyRegistration(rctx, where, session, ceremony, name, credential)
}

// takePasskeyCeremony validates the name, then consumes the registration ceremony and decodes it.
func (a *App) takePasskeyCeremony(where, ceremonyID, name, userAgent string) (string, *passkeyCeremony, *model.AppError) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > model.PasskeyNameMaxRunes {
		return "", nil, model.NewAppError(where, "app.passkey.name_too_long.app_error", nil, "", http.StatusBadRequest)
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
			return "", nil, invalidCeremony()
		}
		return "", nil, model.NewAppError(where, "app.passkey.finish_registration.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}
	var ceremony passkeyCeremony
	if token.IsExpired() || json.Unmarshal([]byte(token.Extra), &ceremony) != nil || ceremony.SessionData == nil {
		return "", nil, invalidCeremony()
	}
	return name, &ceremony, nil
}

// completePasskeyRegistration is the part of finishing that both entry points share, once the
// ceremony is consumed and the session it is bound to is known.
func (a *App) completePasskeyRegistration(rctx request.CTX, where string, session *model.Session, ceremony *passkeyCeremony, name string, credential []byte) (*model.Passkey, *model.AppError) {
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

	if ceremony.Ticket != "" {
		ticket, appErr := a.ConsumeTokenOnce(model.TokenTypePasskeyEnrollmentTicket, ceremony.Ticket)
		if appErr != nil && appErr.StatusCode != http.StatusNotFound {
			return nil, model.NewAppError(where, "app.passkey.finish_registration.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		}
		if appErr != nil || ticket.IsExpired() {
			return nil, model.NewAppError(where, "app.passkey.ticket_invalid.app_error", nil, "", http.StatusBadRequest)
		}
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
