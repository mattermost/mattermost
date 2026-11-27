// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/base64"
	"encoding/json"
	"net/http"

	"github.com/mattermost/rsc/qr"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreateMobileQRLoginToken creates a single-use code that lets a mobile device sign in as the
// session's user. Only interactive workstation sessions may create one, regardless of how the
// user originally authenticated.
func (a *App) CreateMobileQRLoginToken(rctx request.CTX, session *model.Session) (*model.MobileQRLoginToken, error) {
	cfg := a.Config()
	if !*cfg.ServiceSettings.EnableMobileQRLogin {
		return nil, model.NewAppError("CreateMobileQRLoginToken", "api.user.mobile_qr_login.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	siteURL := *cfg.ServiceSettings.SiteURL
	if siteURL == "" {
		return nil, model.NewAppError("CreateMobileQRLoginToken", "api.user.mobile_qr_login.site_url.app_error", nil, "", http.StatusNotImplemented)
	}

	forbidden := func(detail string) error {
		return model.NewAppError("CreateMobileQRLoginToken", "api.user.mobile_qr_login.session_not_allowed.app_error", nil, detail, http.StatusForbidden)
	}

	if session == nil || session.Local || session.IsMobileApp() || session.IsIntegration() {
		return nil, forbidden("session is not an interactive workstation session")
	}

	user, appErr := a.GetUser(rctx, session.UserId)
	if appErr != nil {
		return nil, appErr
	}
	if user.IsBot || user.IsRemote() || user.DeleteAt != 0 {
		return nil, forbidden("user is not allowed to sign in a mobile device")
	}

	expiresAt := model.GetMillis() + int64(*cfg.ServiceSettings.MobileQRLoginTokenExpirySeconds)*1000

	extra, err := json.Marshal(model.MobileQRLoginTokenExtra{
		UserId:          user.Id,
		SourceSessionId: session.Id,
		ExpiresAt:       expiresAt,
	})
	if err != nil {
		return nil, model.NewAppError("CreateMobileQRLoginToken", "api.user.mobile_qr_login.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	token := model.NewToken(model.TokenTypeMobileQRLogin, string(extra))

	link, err := model.BuildMobileQRLoginLink(siteURL, token.Token)
	if err != nil {
		return nil, model.NewAppError("CreateMobileQRLoginToken", "api.user.mobile_qr_login.site_url.app_error", nil, "", http.StatusNotImplemented).Wrap(err)
	}

	code, err := qr.Encode(link, qr.M)
	if err != nil {
		return nil, model.NewAppError("CreateMobileQRLoginToken", "api.user.mobile_qr_login.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err = a.Srv().Store().Token().Save(token); err != nil {
		return nil, model.NewAppError("CreateMobileQRLoginToken", "api.user.mobile_qr_login.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &model.MobileQRLoginToken{
		Link:      link,
		QRCode:    base64.StdEncoding.EncodeToString(code.PNG()),
		ExpiresAt: expiresAt,
	}, nil
}

// RedeemMobileQRLoginToken consumes a code created by CreateMobileQRLoginToken and logs the
// code's user in on a new mobile session. Every rejection returns the same client-facing error;
// the reason is only kept in its detailed error.
func (a *App) RedeemMobileQRLoginToken(rctx request.CTX, w http.ResponseWriter, r *http.Request, tokenString, deviceId, voipDeviceId string) (*model.Session, error) {
	invalid := func(detail string) error {
		return model.NewAppError("RedeemMobileQRLoginToken", "api.user.mobile_qr_login.invalid_token.app_error", nil, detail, http.StatusUnauthorized)
	}

	token, appErr := a.ConsumeTokenOnce(model.TokenTypeMobileQRLogin, tokenString)
	if appErr != nil {
		return nil, invalid("token not found or already used")
	}

	var extra model.MobileQRLoginTokenExtra
	if err := json.Unmarshal([]byte(token.Extra), &extra); err != nil {
		return nil, invalid("token extra is malformed")
	}

	if token.IsExpired() || model.GetMillis() > extra.ExpiresAt {
		return nil, invalid("token expired")
	}

	if !*a.Config().ServiceSettings.EnableMobileQRLogin {
		return nil, invalid("feature disabled")
	}

	user, appErr := a.GetUser(rctx, extra.UserId)
	if appErr != nil {
		return nil, invalid("user not found")
	}
	if user.DeleteAt != 0 || user.IsBot {
		return nil, invalid("user is deactivated or a bot")
	}

	sourceSession, appErr := a.GetSessionById(rctx, extra.SourceSessionId)
	if appErr != nil {
		return nil, invalid("source session not found")
	}
	if sourceSession.UserId != user.Id || sourceSession.IsExpired() {
		return nil, invalid("source session is expired or belongs to another user")
	}

	session, appErr := a.DoLogin(rctx, w, r, user, model.LoginOptions{
		DeviceId:     deviceId,
		VoIPDeviceId: voipDeviceId,
		IsMobile:     true,
		IsSaml:       sourceSession.IsSaml(),
		IsOAuthUser:  sourceSession.IsOAuthUser(),
	})
	if appErr != nil {
		return nil, appErr
	}

	if appErr = a.SetExtraSessionProps(session, map[string]string{model.SessionPropMobileQRSourceSessionId: sourceSession.Id}); appErr != nil {
		if revokeErr := a.RevokeSession(rctx, session); revokeErr != nil {
			rctx.Logger().Warn("Failed to revoke mobile session after QR login error", mlog.String("session_id", session.Id), mlog.Err(revokeErr))
		}
		return nil, appErr
	}
	a.ClearSessionCacheForUser(user.Id)

	message := model.NewWebSocketEvent(model.WebsocketEventMobileQRLoginRedeemed, "", "", user.Id, nil, "")
	message.Add("source_session_id", sourceSession.Id)
	a.Publish(message)

	return session, nil
}
