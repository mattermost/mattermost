// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"crypto/subtle"
	"errors"
	"math"
	"net/http"
	"os"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// maxSessionsLimit prevents a potential DOS caused by creating an unbounded number of sessions; MM-55320
const maxSessionsLimit = 500

func (a *App) CreateSession(rctx request.CTX, session *model.Session) (*model.Session, *model.AppError) {
	if appErr := a.limitNumberOfSessions(rctx, session.UserId); appErr != nil {
		return nil, appErr
	}

	// remote/synthetic users cannot create sessions. This lookup will already be cached.
	// Some unit tests rely on sessions being created for users that don't exist, therefore
	// missing users are allowed.
	user, appErr := a.GetUser(session.UserId)
	if appErr != nil && appErr.StatusCode != http.StatusNotFound {
		return nil, appErr
	}
	if user != nil && user.IsRemote() {
		return nil, model.NewAppError("login", "api.user.login.remote_users.login.error", nil, "", http.StatusUnauthorized)
	}

	session, err := a.ch.srv.platform.CreateSession(rctx, session)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateSession", "app.session.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateSession", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return session, nil
}

func (a *App) GetCloudSession(token string) (*model.Session, *model.AppError) {
	apiKey := os.Getenv("MM_CLOUD_API_KEY")
	if apiKey != "" && subtle.ConstantTimeCompare([]byte(apiKey), []byte(token)) == 1 {
		// Need a bare-bones session object for later checks
		session := &model.Session{
			Token:   token,
			IsOAuth: false,
		}

		session.AddProp(model.SessionPropType, model.SessionTypeCloudKey)
		return session, nil
	}
	return nil, model.NewAppError("GetCloudSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "The provided token is invalid", http.StatusUnauthorized)
}

func (a *App) GetRemoteClusterSession(token string, remoteId string) (*model.Session, *model.AppError) {
	rc, appErr := a.GetRemoteCluster(remoteId, false)
	if appErr == nil && subtle.ConstantTimeCompare([]byte(rc.Token), []byte(token)) == 1 {
		// Need a bare-bones session object for later checks
		session := &model.Session{
			Token:   token,
			IsOAuth: false,
		}

		session.AddProp(model.SessionPropType, model.SessionTypeRemoteclusterToken)
		return session, nil
	}
	return nil, model.NewAppError("GetRemoteClusterSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "The provided token is invalid", http.StatusUnauthorized)
}

func (a *App) GetSession(token string) (*model.Session, *model.AppError) {
	// Create a context as GetSession is used in a lot of places where no context is current present.
	// Once more of the codebase is migrated to use a context, GetSession should accept one.
	rctx := request.EmptyContext(a.Log())

	var session *model.Session
	// We intentionally skip the error check here, we only want to check if the token is valid.
	// If we don't have the session we are going to create one with the token eventually.
	if session, _ = a.ch.srv.platform.GetSession(rctx, token); session != nil {
		if session.Token != token {
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "session token is different from the one in DB", http.StatusUnauthorized)
		}

		if !session.IsExpired() {
			if err := a.ch.srv.platform.AddSessionToCache(session); err != nil {
				rctx.Logger().Error("Failed to add session to cache", mlog.Err(err))
			}
		}
	}

	var appErr *model.AppError
	if session == nil || session.Id == "" {
		session, appErr = a.createSessionForUserAccessToken(rctx, token)
		if appErr != nil {
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token}, "", appErr.StatusCode).Wrap(appErr)
		}
	}

	if session.Id == "" || session.IsExpired() {
		return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "session is either nil or expired", http.StatusUnauthorized)
	}

	if *a.Config().ServiceSettings.SessionIdleTimeoutInMinutes > 0 &&
		!session.IsOAuth && !session.IsMobileApp() &&
		session.Props[model.SessionPropType] != model.SessionTypeUserAccessToken &&
		!*a.Config().ServiceSettings.ExtendSessionLengthWithActivity {
		timeout := int64(*a.Config().ServiceSettings.SessionIdleTimeoutInMinutes) * 1000 * 60
		if (model.GetMillis() - session.LastActivityAt) > timeout {
			// Revoking the session is an asynchronous task anyways since we are not checking
			// for the return value of the call before returning the error.
			// So moving this to a goroutine has 2 advantages:
			// 1. We are treating this as a proper asynchronous task.
			// 2. This also fixes a race condition in the web hub, where GetSession
			// gets called from (*WebConn).isMemberOfTeam and revoking a session involves
			// clearing the webconn cache, which needs the hub again.
			a.Srv().Go(func() {
				err := a.RevokeSessionById(rctx, session.Id)
				if err != nil {
					rctx.Logger().Warn("Error while revoking session", mlog.Err(err))
				}
			})
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "idle timeout", http.StatusUnauthorized)
		}
	}

	return session, nil
}

func (a *App) GetSessions(rctx request.CTX, userID string) ([]*model.Session, *model.AppError) {
	sessions, err := a.ch.srv.platform.GetSessions(rctx, userID)
	if err != nil {
		return nil, model.NewAppError("GetSessions", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return sessions, nil
}

// limitNumberOfSessions revokes userId's least recently used sessions to keep the number below
// maxSessionsLimit; MM-55320
func (a *App) limitNumberOfSessions(rctx request.CTX, userId string) *model.AppError {
	const returnLimit = 100
	sessions, appErr := a.GetLRUSessions(rctx, userId, returnLimit, maxSessionsLimit-1)
	if appErr != nil {
		return model.NewAppError("limitNumberOfSessions", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Revoke any sessions over the limit to make room for new sessions
	for _, sess := range sessions {
		if err := a.RevokeSession(rctx, sess); err != nil {
			return model.NewAppError("limitNumberOfSessions", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		rctx.Logger().Debug("Session revoked; user's number of sessions were over the maxSessionsLimit",
			mlog.String("user_id", userId),
			mlog.String("session_id", sess.Id))
	}

	return nil
}

// GetLRUSessions returns the Least Recently Used sessions for userID, skipping over the newest 'offset'
// number of sessions. E.g., if userID has 100 sessions, offset 98 will return the oldest 2 sessions.
func (a *App) GetLRUSessions(rctx request.CTX, userID string, limit uint64, offset uint64) ([]*model.Session, *model.AppError) {
	sessions, err := a.ch.srv.platform.GetLRUSessions(rctx, userID, limit, offset)
	if err != nil {
		return nil, model.NewAppError("GetLRUSessions", "app.session.get_lru_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return sessions, nil
}

func (a *App) sendMobileWipeSignal(rctx request.CTX, sessions ...*model.Session) {
	// detach from request context and runs async after the caller returns
	rctx = rctx.WithContext(context.Background())

	if !model.SafeDereference(a.Config().MobileEphemeralModeSettings.Enable) {
		return
	}

	if !a.canSendPushNotifications() {
		rctx.Logger().Warn("Cannot send mobile wipe signal because push notifications are disabled")
		return
	}

	for _, session := range sessions {
		if session.DeviceId == "" || session.DeviceId == session.Props[model.SessionPropLastRemovedDeviceId] {
			continue
		}

		// Send an empty push notification of type Session that will cause apps to terminate sessions and wipe data.
		// ContentAvailable and SoundNone are set to trigger a silent notification that wakes up
		// the app in the background without alerting the user.
		msg := &model.PushNotification{
			Version:          model.PushMessageV2,
			Type:             model.PushTypeSession,
			ContentAvailable: 1,
			Sound:            model.PushSoundNone,
		}

		msg.SetDeviceIdAndPlatform(session.DeviceId)
		msg.AckId = model.NewId()
		signature, signErr := jwt.NewWithClaims(jwt.SigningMethodES256, pushJWTClaims{
			AckId:    msg.AckId,
			DeviceId: msg.DeviceId,
		}).SignedString(a.AsymmetricSigningKey())
		if signErr != nil {
			rctx.Logger().Warn("Failed to sign session wipe push", mlog.String("session_id", session.Id), mlog.Err(signErr))
			continue
		}
		msg.Signature = signature
		msg.ServerId = a.ServerId()
		pushResponse, sendErr := a.rawSendToPushProxy(msg)

		reason := model.NotificationReasonPushProxySendError
		switch pushResponse[model.PushStatus] {
		case model.PushStatusRemove:
			reason = model.NotificationReasonPushProxyRemoveDevice
			sendErr = errors.New(notificationErrorRemoveDevice)
		case model.PushStatusFail:
			sendErr = errors.New(pushResponse[model.PushStatusErrorMsg])
		}

		if sendErr != nil {
			a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, reason, msg.Platform)
			rctx.Logger().Warn("Failed to send session wipe push",
				mlog.String("session_id", session.Id),
				mlog.String("reason", reason),
				mlog.Err(sendErr))
			continue
		}

		if a.Metrics() != nil {
			a.Metrics().IncrementPostSentPush()
		}
	}
}

func (a *App) RevokeAllSessions(rctx request.CTX, userID string) *model.AppError {
	sessions, err := a.ch.srv.platform.RevokeAllSessions(rctx, userID)
	if err != nil {
		switch {
		case errors.Is(err, platform.GetSessionError):
			return model.NewAppError("RevokeAllSessions", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		case errors.Is(err, platform.DeleteSessionError):
			return model.NewAppError("RevokeAllSessions", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return model.NewAppError("RevokeAllSessions", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.Srv().Go(func() {
		a.sendMobileWipeSignal(rctx, sessions...)
	})

	return nil
}

func (a *App) AddSessionToCache(session *model.Session) {
	if err := a.ch.srv.platform.AddSessionToCache(session); err != nil {
		a.Srv().Platform().Log().Error("Failed to add session to cache", mlog.String("session_id", session.Id), mlog.String("user_id", session.UserId), mlog.Err(err))
	}
}

// RevokeSessionsFromAllUsers will go through all the sessions active
// in the server and revoke them
func (a *App) RevokeSessionsFromAllUsers(rctx request.CTX) *model.AppError {
	// When Mobile Ephemeral Mode is enabled, fetch sessions with active device ids
	// before revoking them, so we can send wipe signals to the correct devices.
	var sessionsWithActiveDevices []*model.Session
	if model.SafeDereference(a.Config().MobileEphemeralModeSettings.Enable) {
		var err error
		// Sessions created between this fetch and the deletion below are revoked but won't receive a wipe signal.
		sessionsWithActiveDevices, err = a.Srv().Store().Session().GetAllSessionsWithActiveDeviceIds()
		if err != nil {
			return model.NewAppError("RevokeSessionsFromAllUsers", "app.session.remove_all_sessions_for_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if err := a.ch.srv.platform.RevokeSessionsFromAllUsers(); err != nil {
		switch {
		case errors.Is(err, users.DeleteAllAccessDataError):
			return model.NewAppError("RevokeSessionsFromAllUsers", "app.oauth.remove_access_data.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return model.NewAppError("RevokeSessionsFromAllUsers", "app.session.remove_all_sessions_for_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.Srv().Go(func() {
		a.sendMobileWipeSignal(rctx, sessionsWithActiveDevices...)
	})

	return nil
}

func (a *App) ClearSessionCacheForUser(userID string) {
	a.ch.srv.platform.ClearUserSessionCache(userID)
}

func (a *App) ClearSessionCacheForAllUsers() {
	if err := a.ch.srv.platform.ClearAllUsersSessionCache(); err != nil {
		a.Srv().Platform().Log().Error("Failed to clear session cache for all users", mlog.Err(err))
	}
}

func (a *App) ClearSessionCacheForUserSkipClusterSend(userID string) {
	a.Srv().Platform().ClearSessionCacheForUserSkipClusterSend(userID)
}

func (a *App) ClearSessionCacheForAllUsersSkipClusterSend() {
	if err := a.Srv().Platform().ClearSessionCacheForAllUsersSkipClusterSend(); err != nil {
		a.Srv().Platform().Log().Error("Failed to clear session cache for all users", mlog.Err(err))
	}
}

func (a *App) RevokeOtherSessionsForDeviceId(rctx request.CTX, userID string, deviceId string, currentSessionId string) *model.AppError {
	if err := a.ch.srv.platform.RevokeOtherSessionsForDeviceId(rctx, userID, deviceId, currentSessionId); err != nil {
		if errors.Is(err, platform.ErrEmptyDeviceId) {
			return model.NewAppError("RevokeOtherSessionsForDeviceId", "app.session.revoke_other_sessions.empty_device_id.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		return model.NewAppError("RevokeOtherSessionsForDeviceId", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) RevokeOtherSessionsForVoIPDeviceId(rctx request.CTX, userID string, voIPDeviceId string, currentSessionId string) *model.AppError {
	if err := a.ch.srv.platform.RevokeOtherSessionsForVoIPDeviceId(rctx, userID, voIPDeviceId, currentSessionId); err != nil {
		if errors.Is(err, platform.ErrEmptyVoIPDeviceId) {
			return model.NewAppError("RevokeOtherSessionsForVoIPDeviceId", "app.session.revoke_other_sessions.empty_voip_device_id.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		return model.NewAppError("RevokeOtherSessionsForVoIPDeviceId", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetSessionById(rctx request.CTX, sessionID string) (*model.Session, *model.AppError) {
	session, err := a.ch.srv.platform.GetSessionByID(rctx, sessionID)
	if err != nil {
		return nil, model.NewAppError("GetSessionById", "app.session.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return session, nil
}

func (a *App) RevokeSessionById(rctx request.CTX, sessionID string) *model.AppError {
	session, err := a.GetSessionById(rctx, sessionID)
	if err != nil {
		return model.NewAppError("RevokeSessionById", "app.session.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return a.RevokeSession(rctx, session)
}

func (a *App) RevokeSession(rctx request.CTX, session *model.Session) *model.AppError {
	if err := a.ch.srv.platform.RevokeSession(rctx, session); err != nil {
		switch {
		case errors.Is(err, platform.DeleteSessionError):
			return model.NewAppError("RevokeSession", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return model.NewAppError("RevokeSession", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.Srv().Go(func() {
		a.sendMobileWipeSignal(rctx, session)
	})

	return nil
}

func (a *App) AttachDeviceId(sessionID string, deviceId string, voIPDeviceId string, expiresAt int64) *model.AppError {
	if err := a.Srv().Store().Session().UpdateDeviceId(sessionID, deviceId, voIPDeviceId, expiresAt); err != nil {
		return model.NewAppError("AttachDeviceId", "app.session.update_device_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) SetExtraSessionProps(session *model.Session, newProps map[string]string) *model.AppError {
	changed := false
	for k, v := range newProps {
		if session.Props[k] == v {
			continue
		}

		session.AddProp(k, v)
		changed = true
	}

	if !changed {
		return nil
	}

	err := a.Srv().Store().Session().UpdateProps(session)
	if err != nil {
		return model.NewAppError("SetExtraSessionProps", "app.session.set_extra_session_prop.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// ExtendSessionExpiryIfNeeded extends Session.ExpiresAt based on session lengths in config.
// A new ExpiresAt is only written if enough time has elapsed since last update.
// Returns true only if the session was extended.
func (a *App) ExtendSessionExpiryIfNeeded(rctx request.CTX, session *model.Session) bool {
	if !*a.Config().ServiceSettings.ExtendSessionLengthWithActivity {
		return false
	}

	if session == nil || session.IsExpired() {
		return false
	}

	sessionLength := a.GetSessionLengthInMillis(session)

	// Only extend the expiry if the lessor of 1% or 1 day has elapsed within the
	// current session duration.
	threshold := max(
		int64(math.Min(float64(sessionLength)*0.01, float64(model.DayInMilliseconds))),
		// Minimum session length is 1 day as of this writing, therefore a minimum ~14 minutes threshold.
		// However we'll add a sanity check here in case that changes. Minimum 5 minute threshold,
		// meaning we won't write a new expiry more than every 5 minutes.
		5*60*1000,
	)

	now := model.GetMillis()
	elapsed := now - (session.ExpiresAt - sessionLength)
	if elapsed < threshold {
		return false
	}

	auditRec := a.MakeAuditRecord(rctx, model.AuditEventExtendSessionExpiry, model.AuditStatusFail)
	defer a.LogAuditRec(rctx, auditRec, nil)
	auditRec.AddEventPriorState(session)

	newExpiry := now + sessionLength
	if err := a.ch.srv.platform.ExtendSessionExpiry(session, newExpiry); err != nil {
		rctx.Logger().Error("Failed to update ExpiresAt", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id), mlog.Err(err))
		auditRec.AddMeta("err", err.Error())
		return false
	}

	rctx.Logger().Debug("Session extended",
		mlog.String("user_id", session.UserId),
		mlog.String("session_id", session.Id),
		mlog.Int("newExpiry", newExpiry),
		mlog.Int("session_length", sessionLength),
	)

	auditRec.Success()
	auditRec.AddEventResultState(session)
	return true
}

// GetSessionLengthInMillis returns the session length, in milliseconds,
// based on the type of session (Mobile, SSO, Web/LDAP).
func (a *App) GetSessionLengthInMillis(session *model.Session) int64 {
	if session == nil {
		return 0
	}

	// For PAT sessions with a fixed expiry, return the remaining lifetime so
	// that ExtendSessionExpiryIfNeeded never pushes ExpiresAt past the token's
	// own expiry. The elapsed threshold check collapses to zero, so extension
	// is effectively a no-op for these sessions (correct: the expiry is fixed).
	// PAT sessions with ExpiresAt == 0 (non-expiring) fall through to normal
	// web-session behavior.
	if session.Props[model.SessionPropType] == model.SessionTypeUserAccessToken && session.ExpiresAt > 0 {
		remaining := session.ExpiresAt - model.GetMillis()
		if remaining < 0 {
			return 0
		}
		return remaining
	}

	var hours int
	if session.IsMobileApp() {
		hours = *a.Config().ServiceSettings.SessionLengthMobileInHours
	} else if session.IsSSOLogin() {
		hours = *a.Config().ServiceSettings.SessionLengthSSOInHours
	} else {
		hours = *a.Config().ServiceSettings.SessionLengthWebInHours
	}
	return int64(hours * 60 * 60 * 1000)
}

// SetSessionExpireInHours sets the session's expiry the specified number of hours
// relative to either the session creation date or the current time, depending
// on the `ExtendSessionOnActivity` config setting.
func (a *App) SetSessionExpireInHours(session *model.Session, hours int) {
	a.ch.srv.platform.SetSessionExpireInHours(session, hours)
}

// validateUserAccessTokenExpiry checks a token's ExpiresAt against
// ServiceSettings.MaximumPersonalAccessTokenLifetimeDays. 0 means no policy:
// never-expiring tokens are allowed. A value > 0 requires the token to expire
// within that many days, so ExpiresAt == 0 or an expiry beyond the cap is
// rejected. Only newly created tokens are checked; existing tokens are not
// re-validated.
func (a *App) validateUserAccessTokenExpiry(token *model.UserAccessToken) *model.AppError {
	cfg := a.Config().ServiceSettings

	maxDays := int64(0)
	if cfg.MaximumPersonalAccessTokenLifetimeDays != nil {
		maxDays = int64(*cfg.MaximumPersonalAccessTokenLifetimeDays)
	}

	if token.ExpiresAt == 0 {
		// A configured maximum lifetime implies tokens must expire; never-expiring
		// tokens are only allowed when no maximum is set.
		if maxDays > 0 {
			return model.NewAppError("CreateUserAccessToken", "app.user_access_token.expires_at_required.app_error", nil, "", http.StatusBadRequest)
		}
		return nil
	}

	if token.ExpiresAt <= model.GetMillis() {
		return model.NewAppError("CreateUserAccessToken", "app.user_access_token.expires_at_in_past.app_error", nil, "", http.StatusBadRequest)
	}

	if maxDays > 0 {
		maxExpiry := model.GetMillis() + maxDays*24*60*60*1000
		if token.ExpiresAt > maxExpiry {
			return model.NewAppError(
				"CreateUserAccessToken",
				"app.user_access_token.expires_at_too_far.app_error",
				map[string]any{"Days": maxDays},
				"",
				http.StatusBadRequest,
			)
		}
	}

	return nil
}

func (a *App) CreateUserAccessToken(rctx request.CTX, token *model.UserAccessToken) (*model.UserAccessToken, *model.AppError) {
	user, nErr := a.ch.srv.userService.GetUser(token.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateUserAccessToken", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreateUserAccessToken", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if !*a.Config().ServiceSettings.EnableUserAccessTokens && !user.IsBot {
		return nil, model.NewAppError("CreateUserAccessToken", "app.user_access_token.disabled", nil, "", http.StatusNotImplemented)
	}

	// Bot accounts are exempt from the PAT expiry policy, matching the existing
	// EnableUserAccessTokens bypass above: bots are programmatic clients that
	// typically need long-lived credentials, and integrations that provision
	// them would otherwise break the moment an admin enables enforcement.
	if !user.IsBot {
		if err := a.validateUserAccessTokenExpiry(token); err != nil {
			return nil, err
		}
	}

	token.Token = model.NewId()

	token, nErr = a.Srv().Store().UserAccessToken().Save(token)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateUserAccessToken", "app.user_access_token.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// Don't send emails to bot users.
	if !user.IsBot {
		if err := a.Srv().EmailService.SendUserAccessTokenAddedEmail(user.Email, user.Locale, a.GetSiteURL()); err != nil {
			rctx.Logger().Error("Unable to send user access token added email", mlog.Err(err), mlog.String("user_id", user.Id))
		}
	}

	return token, nil
}

func (a *App) createSessionForUserAccessToken(rctx request.CTX, tokenString string) (*model.Session, *model.AppError) {
	token, nErr := a.Srv().Store().UserAccessToken().GetByToken(tokenString)
	if nErr != nil {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "", http.StatusUnauthorized).Wrap(nErr)
	}

	if !token.IsActive {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "inactive_token", http.StatusUnauthorized)
	}

	user, nErr := a.Srv().Store().User().Get(rctx.Context(), token.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("createSessionForUserAccessToken", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("createSessionForUserAccessToken", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if !*a.Config().ServiceSettings.EnableUserAccessTokens && !user.IsBot {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "EnableUserAccessTokens=false", http.StatusUnauthorized)
	}

	if token.IsExpired() {
		auditRec := a.MakeAuditRecord(rctx, model.AuditEventRejectExpiredUserAccessToken, model.AuditStatusFail)
		auditRec.AddMeta("token_id", token.Id)
		auditRec.AddMeta("user_id", token.UserId)
		auditRec.AddMeta("expires_at", token.ExpiresAt)
		a.LogAuditRec(rctx, auditRec, nil)
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.expired", nil, "expired_token", http.StatusUnauthorized)
	}

	if user.DeleteAt != 0 {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "inactive_user_id="+user.Id, http.StatusUnauthorized)
	}

	if appErr := a.limitNumberOfSessions(rctx, user.Id); appErr != nil {
		return nil, appErr
	}

	session := &model.Session{
		Token:   token.Token,
		UserId:  user.Id,
		Roles:   user.GetRawRoles(),
		IsOAuth: false,
	}

	session.AddProp(model.SessionPropUserAccessTokenId, token.Id)
	session.AddProp(model.SessionPropType, model.SessionTypeUserAccessToken)
	if user.IsBot {
		session.AddProp(model.SessionPropIsBot, model.SessionPropIsBotValue)
	}
	if user.IsGuest() {
		session.AddProp(model.SessionPropIsGuest, "true")
	} else {
		session.AddProp(model.SessionPropIsGuest, "false")
	}
	a.ch.srv.platform.SetSessionExpireInHours(session, model.SessionUserAccessTokenExpiryHours)

	// If the underlying PAT has a non-zero expiry, clamp the session expiry to
	// the token's ExpiresAt so that cached sessions honor PAT expiry as well.
	if token.ExpiresAt > 0 && (session.ExpiresAt == 0 || token.ExpiresAt < session.ExpiresAt) {
		session.ExpiresAt = token.ExpiresAt
	}

	session, nErr = a.Srv().Store().Session().Save(rctx, session)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("CreateSession", "app.session.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreateSession", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if err := a.ch.srv.platform.AddSessionToCache(session); err != nil {
		a.ch.srv.Log().Error("Failed to add session to cache", mlog.String("session_id", session.Id), mlog.Err(err))
	}

	return session, nil
}

func (a *App) RevokeUserAccessToken(rctx request.CTX, token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.ch.srv.platform.GetSessionContext(rctx, token.Token)

	if err := a.Srv().Store().UserAccessToken().Delete(token.Id); err != nil {
		return model.NewAppError("RevokeUserAccessToken", "app.user_access_token.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(rctx, session)
}

// revokeNonCompliantBatchLimit bounds both the number of rows fetched by
// GetNonCompliantExpiry and the corresponding DeleteByIds call, keeping the
// transaction footprint bounded even when a large number of tokens are
// non-compliant. revokeNonCompliantMaxBatches caps the iterations of a single
// revoke call so a runaway loop can't develop.
const (
	revokeNonCompliantBatchLimit = 1000
	revokeNonCompliantMaxBatches = 1000
)

// maxPersonalAccessTokenExpiry returns the latest ExpiresAt a token may carry to
// comply with the current ServiceSettings.MaximumPersonalAccessTokenLifetimeDays
// policy, along with whether a policy is in effect. When no maximum is
// configured (0), no policy applies and every token is compliant.
func (a *App) maxPersonalAccessTokenExpiry() (maxExpiresAt int64, enabled bool) {
	cfg := a.Config().ServiceSettings

	maxDays := int64(0)
	if cfg.MaximumPersonalAccessTokenLifetimeDays != nil {
		maxDays = int64(*cfg.MaximumPersonalAccessTokenLifetimeDays)
	}

	if maxDays <= 0 {
		return 0, false
	}

	return model.GetMillis() + maxDays*24*60*60*1000, true
}

// CountNonCompliantUserAccessTokens returns the number of active, non-bot
// personal access tokens that violate the current maximum lifetime policy. It
// lets an admin preview the blast radius before revoking. When no policy is in
// effect it returns 0 — nothing is non-compliant.
func (a *App) CountNonCompliantUserAccessTokens() (int64, *model.AppError) {
	maxExpiresAt, enabled := a.maxPersonalAccessTokenExpiry()
	if !enabled {
		return 0, nil
	}

	count, err := a.Srv().Store().UserAccessToken().CountNonCompliantExpiry(maxExpiresAt)
	if err != nil {
		return 0, model.NewAppError("CountNonCompliantUserAccessTokens", "app.user_access_token.count_non_compliant.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return count, nil
}

// RevokeNonCompliantUserAccessTokens hard-deletes every active, non-bot personal
// access token that violates the current maximum lifetime policy, along with any
// sessions minted from them. It returns the number of tokens actually deleted.
// Work is done in bounded batches to keep transactions small, and the per-user
// session cache is cleared so stale sessions aren't served from memory. When no
// policy is in effect the call is refused — there is nothing to revoke and a
// caller reaching this path likely has a stale view of the config. Auditing is
// the caller's responsibility, matching RevokeUserAccessToken.
func (a *App) RevokeNonCompliantUserAccessTokens(rctx request.CTX) (int64, *model.AppError) {
	maxExpiresAt, enabled := a.maxPersonalAccessTokenExpiry()
	if !enabled {
		return 0, model.NewAppError("RevokeNonCompliantUserAccessTokens", "app.user_access_token.revoke_non_compliant.no_policy.app_error", nil, "", http.StatusBadRequest)
	}

	var totalRevoked int64
	allRevoked := false
	for range revokeNonCompliantMaxBatches {
		userIDs, err := a.Srv().Store().UserAccessToken().DeleteNonCompliantExpiry(maxExpiresAt, revokeNonCompliantBatchLimit)
		if err != nil {
			return totalRevoked, model.NewAppError("RevokeNonCompliantUserAccessTokens", "app.user_access_token.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if len(userIDs) == 0 {
			allRevoked = true
			break
		}

		totalRevoked += int64(len(userIDs))

		seen := make(map[string]struct{}, len(userIDs))
		for _, userID := range userIDs {
			if _, ok := seen[userID]; !ok {
				seen[userID] = struct{}{}
				a.ClearSessionCacheForUser(userID)
			}
		}

		if len(userIDs) < revokeNonCompliantBatchLimit {
			allRevoked = true
			break
		}
	}

	if !allRevoked {
		return totalRevoked, model.NewAppError("RevokeNonCompliantUserAccessTokens", "app.user_access_token.revoke_non_compliant.partial.app_error", nil, "", http.StatusInternalServerError)
	}

	return totalRevoked, nil
}

func (a *App) DisableUserAccessToken(rctx request.CTX, token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.ch.srv.platform.GetSessionContext(rctx, token.Token)

	if err := a.Srv().Store().UserAccessToken().UpdateTokenDisable(token.Id); err != nil {
		return model.NewAppError("DisableUserAccessToken", "app.user_access_token.update_token_disable.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(rctx, session)
}

func (a *App) EnableUserAccessToken(rctx request.CTX, token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.ch.srv.platform.GetSessionContext(rctx, token.Token)

	err := a.Srv().Store().UserAccessToken().UpdateTokenEnable(token.Id)
	if err != nil {
		return model.NewAppError("EnableUserAccessToken", "app.user_access_token.update_token_enable.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if session == nil {
		return nil
	}

	return nil
}

func (a *App) GetUserAccessTokens(page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv().Store().UserAccessToken().GetAll(page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetUserAccessTokens", "app.user_access_token.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, token := range tokens {
		token.Token = ""
	}

	return tokens, nil
}

func (a *App) GetUserAccessTokensForUser(userID string, page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv().Store().UserAccessToken().GetByUser(userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetUserAccessTokensForUser", "app.user_access_token.get_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, token := range tokens {
		token.Token = ""
	}

	return tokens, nil
}

func (a *App) GetUserAccessToken(tokenID string, sanitize bool) (*model.UserAccessToken, *model.AppError) {
	token, err := a.Srv().Store().UserAccessToken().Get(tokenID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserAccessToken", "app.user_access_token.get_by_user.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUserAccessToken", "app.user_access_token.get_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if sanitize {
		token.Token = ""
	}
	return token, nil
}

func (a *App) SearchUserAccessTokens(term string) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv().Store().UserAccessToken().Search(term)
	if err != nil {
		return nil, model.NewAppError("SearchUserAccessTokens", "app.user_access_token.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, token := range tokens {
		token.Token = ""
	}
	return tokens, nil
}
