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

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/mattermost/mattermost/server/public/model"
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

// passkeyUser adapts a user and their existing passkeys to the WebAuthn library's User interface.
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
		cred := webauthn.Credential{ID: p.CredentialId, PublicKey: p.PublicKey}
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
