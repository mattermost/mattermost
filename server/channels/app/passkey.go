// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/mattermost/mattermost/server/public/model"
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
