// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"path"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mfa"
)

type TokenLocation int

const (
	TokenLocationNotFound TokenLocation = iota
	TokenLocationHeader
	TokenLocationCookie
	TokenLocationQueryString
	TokenLocationCloudHeader
	TokenLocationRemoteClusterHeader
)

func (tl TokenLocation) String() string {
	switch tl {
	case TokenLocationNotFound:
		return "Not Found"
	case TokenLocationHeader:
		return "Header"
	case TokenLocationCookie:
		return "Cookie"
	case TokenLocationQueryString:
		return "QueryString"
	case TokenLocationCloudHeader:
		return "CloudHeader"
	case TokenLocationRemoteClusterHeader:
		return "RemoteClusterHeader"
	default:
		return "Unknown"
	}
}

func (a *App) IsPasswordValid(rctx request.CTX, password string) *model.AppError {
	if err := users.IsPasswordValidWithSettings(password, &a.Config().PasswordSettings); err != nil {
		var invErr *users.ErrInvalidPassword
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("User.IsValid", invErr.Id(), map[string]any{"Min": *a.Config().PasswordSettings.MinimumLength}, "", http.StatusBadRequest).Wrap(err)
		default:
			return model.NewAppError("User.IsValid", "app.valid_password_generic.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) CheckPasswordAndAllCriteria(rctx request.CTX, userID string, password string, mfaToken string) *model.AppError {
	// MM-37585
	// Use locks to avoid concurrently checking AND updating the failed login attempts.
	a.ch.loginAttemptsMut.Lock()
	defer a.ch.loginAttemptsMut.Unlock()

	user, err := a.GetUser(userID)
	if err != nil {
		if err.Id != MissingAccountError {
			err.StatusCode = http.StatusInternalServerError
			return err
		}
		err.StatusCode = http.StatusBadRequest
		return err
	}

	if err := a.CheckUserPreflightAuthenticationCriteria(rctx, user, mfaToken); err != nil {
		return err
	}

	if err := users.CheckUserPassword(user, password); err != nil {
		if passErr := a.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, user.FailedAttempts+1); passErr != nil {
			return model.NewAppError("CheckPasswordAndAllCriteria", "app.user.update_failed_pwd_attempts.app_error", nil, "", http.StatusInternalServerError).Wrap(passErr)
		}

		var invErr *users.ErrInvalidPassword
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("checkUserPassword", "api.user.check_user_password.invalid.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized).Wrap(err)
		default:
			return model.NewAppError("checkUserPassword", "app.valid_password_generic.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if err := a.CheckUserMfa(rctx, user, mfaToken); err != nil {
		// If the mfaToken is not set, we assume the client used this as a pre-flight request to query the server
		// about the MFA state of the user in question
		if mfaToken != "" {
			if passErr := a.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, user.FailedAttempts+1); passErr != nil {
				return model.NewAppError("CheckPasswordAndAllCriteria", "app.user.update_failed_pwd_attempts.app_error", nil, "", http.StatusInternalServerError).Wrap(passErr)
			}
		}

		return err
	}

	if passErr := a.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, 0); passErr != nil {
		return model.NewAppError("CheckPasswordAndAllCriteria", "app.user.update_failed_pwd_attempts.app_error", nil, "", http.StatusInternalServerError).Wrap(passErr)
	}

	if err := a.CheckUserPostflightAuthenticationCriteria(rctx, user); err != nil {
		return err
	}

	return nil
}

// This to be used for places we check the users password when they are already logged in
func (a *App) DoubleCheckPassword(rctx request.CTX, user *model.User, password string) *model.AppError {
	if err := checkUserLoginAttempts(user, *a.Config().ServiceSettings.MaximumLoginAttempts); err != nil {
		return err
	}

	if err := users.CheckUserPassword(user, password); err != nil {
		if passErr := a.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, user.FailedAttempts+1); passErr != nil {
			return model.NewAppError("DoubleCheckPassword", "app.user.update_failed_pwd_attempts.app_error", nil, "", http.StatusInternalServerError).Wrap(passErr)
		}

		a.InvalidateCacheForUser(user.Id)

		var invErr *users.ErrInvalidPassword
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("DoubleCheckPassword", "api.user.check_user_password.invalid.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized).Wrap(err)
		default:
			return model.NewAppError("DoubleCheckPassword", "app.valid_password_generic.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if passErr := a.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, 0); passErr != nil {
		return model.NewAppError("DoubleCheckPassword", "app.user.update_failed_pwd_attempts.app_error", nil, "", http.StatusInternalServerError).Wrap(passErr)
	}

	a.InvalidateCacheForUser(user.Id)

	return nil
}

func (a *App) checkLdapUserPasswordAndAllCriteria(rctx request.CTX, ldapId *string, password string, mfaToken string) (*model.User, *model.AppError) {
	if a.Ldap() == nil || ldapId == nil {
		err := model.NewAppError("doLdapAuthentication", "api.user.login_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
		return nil, err
	}

	ldapUser, err := a.Ldap().DoLogin(rctx, *ldapId, password)
	if err != nil {
		// Log a info to make it easier to admin to spot that a user tried to log in with a legitimate user name.
		if err.Id == "ent.ldap.do_login.invalid_password.app_error" {
			rctx.Logger().LogM(mlog.MlvlLDAPInfo, "A user tried to sign in, which matched an LDAP account, but the password was incorrect.", mlog.String("ldap_id", *ldapId))
		}

		err.StatusCode = http.StatusUnauthorized
		return nil, err
	}

	if err := a.CheckUserMfa(rctx, ldapUser, mfaToken); err != nil {
		return nil, err
	}

	if err := checkUserNotDisabled(ldapUser); err != nil {
		return nil, err
	}

	// user successfully authenticated
	return ldapUser, nil
}

func (a *App) CheckUserAllAuthenticationCriteria(rctx request.CTX, user *model.User, mfaToken string) *model.AppError {
	if err := a.CheckUserPreflightAuthenticationCriteria(rctx, user, mfaToken); err != nil {
		return err
	}

	if err := a.CheckUserPostflightAuthenticationCriteria(rctx, user); err != nil {
		return err
	}

	return nil
}

func (a *App) CheckUserPreflightAuthenticationCriteria(rctx request.CTX, user *model.User, mfaToken string) *model.AppError {
	if err := checkUserNotDisabled(user); err != nil {
		return err
	}

	if err := checkUserNotBot(user); err != nil {
		return err
	}

	if err := checkUserLoginAttempts(user, *a.Config().ServiceSettings.MaximumLoginAttempts); err != nil {
		return err
	}

	return nil
}

func (a *App) CheckUserPostflightAuthenticationCriteria(rctx request.CTX, user *model.User) *model.AppError {
	if !user.EmailVerified && *a.Config().EmailSettings.RequireEmailVerification {
		return model.NewAppError("Login", "api.user.login.not_verified.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}

	return nil
}

func (a *App) CheckUserMfa(rctx request.CTX, user *model.User, token string) *model.AppError {
	if !user.MfaActive || !*a.Config().ServiceSettings.EnableMultifactorAuthentication {
		return nil
	}

	if !*a.Config().ServiceSettings.EnableMultifactorAuthentication {
		return model.NewAppError("CheckUserMfa", "mfa.mfa_disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	ok, err := mfa.New(a.Srv().Store().User()).ValidateToken(user, token)
	if err != nil {
		return model.NewAppError("CheckUserMfa", "mfa.validate_token.authenticate.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if !ok {
		return model.NewAppError("checkUserMfa", "api.user.check_user_mfa.bad_code.app_error", nil, "", http.StatusUnauthorized)
	}

	return nil
}

func (a *App) MFARequired(rctx request.CTX) *model.AppError {
	if license := a.Channels().License(); license == nil || !*license.Features.MFA || !*a.Config().ServiceSettings.EnableMultifactorAuthentication || !*a.Config().ServiceSettings.EnforceMultifactorAuthentication {
		return nil
	}

	session := rctx.Session()
	// Session cannot be nil or empty if MFA is to be enforced.
	if session == nil || session.Id == "" {
		return model.NewAppError("MfaRequired", "api.context.get_session.app_error", nil, "", http.StatusUnauthorized)
	}

	// OAuth integrations are excepted
	if session.IsOAuth {
		return nil
	}

	user, err := a.GetUser(session.UserId)
	if err != nil {
		return model.NewAppError("MfaRequired", "api.context.get_user.app_error", nil, "", http.StatusUnauthorized).Wrap(err)
	}

	if user.IsGuest() && !*a.Config().GuestAccountsSettings.EnforceMultifactorAuthentication {
		return nil
	}
	// Only required for email and ldap accounts
	if user.AuthService != "" &&
		user.AuthService != model.UserAuthServiceEmail &&
		user.AuthService != model.UserAuthServiceLdap {
		return nil
	}

	// Special case to let user get themself
	subpath, _ := utils.GetSubpathFromConfig(a.Config())
	if rctx.Path() == path.Join(subpath, "/api/v4/users/me") {
		return nil
	}

	// Bots are exempt
	if user.IsBot {
		return nil
	}

	if !user.MfaActive {
		return model.NewAppError("MfaRequired", "api.context.mfa_required.app_error", nil, "", http.StatusForbidden)
	}

	return nil
}

func checkUserLoginAttempts(user *model.User, maxAttempts int) *model.AppError {
	if user.FailedAttempts >= maxAttempts {
		return model.NewAppError("checkUserLoginAttempts", "api.user.check_user_login_attempts.too_many.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}

	return nil
}

func checkUserNotDisabled(user *model.User) *model.AppError {
	if user.DeleteAt > 0 {
		return model.NewAppError("Login", "api.user.login.inactive.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}
	return nil
}

func checkUserNotBot(user *model.User) *model.AppError {
	if user.IsBot {
		return model.NewAppError("Login", "api.user.login.bot_login_forbidden.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}
	return nil
}

func (a *App) authenticateUser(rctx request.CTX, user *model.User, password, mfaToken string) (*model.User, *model.AppError) {
	license := a.Srv().License()
	ldapAvailable := *a.Config().LdapSettings.Enable && a.Ldap() != nil && license != nil && *license.Features.LDAP

	if user.AuthService == model.UserAuthServiceLdap {
		if !ldapAvailable {
			err := model.NewAppError("login", "api.user.login_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
			return user, err
		}

		ldapUser, err := a.checkLdapUserPasswordAndAllCriteria(rctx, user.AuthData, password, mfaToken)
		if err != nil {
			err.StatusCode = http.StatusUnauthorized
			return user, err
		}

		// slightly redundant to get the user again, but we need to get it from the LDAP server
		return ldapUser, nil
	}

	if user.AuthService != "" {
		authService := user.AuthService
		if authService == model.UserAuthServiceSaml {
			authService = strings.ToUpper(authService)
		}
		err := model.NewAppError("login", "api.user.login.use_auth_service.app_error", map[string]any{"AuthService": authService}, "", http.StatusBadRequest)
		return user, err
	}

	if err := a.CheckPasswordAndAllCriteria(rctx, user.Id, password, mfaToken); err != nil {
		if err.Id == "api.user.check_user_password.invalid.app_error" {
			rctx.Logger().LogM(mlog.MlvlLDAPInfo, "A user tried to sign in, which matched a Mattermost account, but the password was incorrect.", mlog.String("username", user.Username))
		}

		err.StatusCode = http.StatusUnauthorized
		return user, err
	}

	return user, nil
}

func ParseAuthTokenFromRequest(r *http.Request) (token string, loc TokenLocation) {
	defer func() {
		// Stripping off tokens of large sizes
		// to prevent logging a large string.
		if len(token) > 50 {
			token = token[:50]
		}
	}()

	authHeader := r.Header.Get(model.HeaderAuth)

	// Attempt to parse the token from the cookie
	if cookie, err := r.Cookie(model.SessionCookieToken); err == nil {
		return cookie.Value, TokenLocationCookie
	}

	// Parse the token from the header
	if len(authHeader) > 6 && strings.ToUpper(authHeader[0:6]) == model.HeaderBearer {
		// Default session token
		return authHeader[7:], TokenLocationHeader
	}

	if len(authHeader) > 5 && strings.ToLower(authHeader[0:5]) == model.HeaderToken {
		// OAuth token
		return authHeader[6:], TokenLocationHeader
	}

	// Attempt to parse token out of the query string
	if token := r.URL.Query().Get("access_token"); token != "" {
		return token, TokenLocationQueryString
	}

	if token := r.Header.Get(model.HeaderCloudToken); token != "" {
		return token, TokenLocationCloudHeader
	}

	if token := r.Header.Get(model.HeaderRemoteclusterToken); token != "" {
		return token, TokenLocationRemoteClusterHeader
	}

	return "", TokenLocationNotFound
}
