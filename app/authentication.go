// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

type TokenLocation int

const (
	TokenLocationNotFound = iota
	TokenLocationHeader
	TokenLocationCookie
	TokenLocationQueryString
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
	default:
		return "Unknown"
	}
}

func (a *App) IsPasswordValid(password string) *model.AppError {
	return utils.IsPasswordValidWithSettings(password, &a.Config().PasswordSettings)
}

func (a *App) CheckPasswordAndAllCriteria(user *model.User, password string, mfaToken string) *model.AppError {
	if err := a.CheckUserPreflightAuthenticationCriteria(user, mfaToken); err != nil {
		return err
	}

	if err := a.checkUserPassword(user, password); err != nil {
		return err
	}

	if err := a.CheckUserPostflightAuthenticationCriteria(user); err != nil {
		return err
	}

	return nil
}

// This to be used for places we check the users password when they are already logged in
func (a *App) doubleCheckPassword(user *model.User, password string) *model.AppError {
	if err := checkUserLoginAttempts(user, *a.Config().ServiceSettings.MaximumLoginAttempts); err != nil {
		return err
	}

	if err := a.checkUserPassword(user, password); err != nil {
		return err
	}

	return nil
}

func (a *App) checkUserPassword(user *model.User, password string) *model.AppError {
	if !model.ComparePassword(user.Password, password) {
		if result := <-a.Srv.Store.User().UpdateFailedPasswordAttempts(user.Id, user.FailedAttempts+1); result.Err != nil {
			return result.Err
		}

		return model.NewAppError("checkUserPassword", "api.user.check_user_password.invalid.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}

	if result := <-a.Srv.Store.User().UpdateFailedPasswordAttempts(user.Id, 0); result.Err != nil {
		return result.Err
	}

	return nil
}

func (a *App) checkLdapUserPasswordAndAllCriteria(ldapId *string, password string, mfaToken string) (*model.User, *model.AppError) {
	if a.Ldap == nil || ldapId == nil {
		err := model.NewAppError("doLdapAuthentication", "api.user.login_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
		return nil, err
	}

	ldapUser, err := a.Ldap.DoLogin(*ldapId, password)
	if err != nil {
		err.StatusCode = http.StatusUnauthorized
		return nil, err
	}

	if err := a.CheckUserMfa(ldapUser, mfaToken); err != nil {
		return nil, err
	}

	if err := checkUserNotDisabled(ldapUser); err != nil {
		return nil, err
	}

	// user successfully authenticated
	return ldapUser, nil
}

func (a *App) CheckUserAllAuthenticationCriteria(user *model.User, mfaToken string) *model.AppError {
	if err := a.CheckUserPreflightAuthenticationCriteria(user, mfaToken); err != nil {
		return err
	}

	if err := a.CheckUserPostflightAuthenticationCriteria(user); err != nil {
		return err
	}

	return nil
}

func (a *App) CheckUserPreflightAuthenticationCriteria(user *model.User, mfaToken string) *model.AppError {
	if err := a.CheckUserMfa(user, mfaToken); err != nil {
		return err
	}

	if err := checkUserNotDisabled(user); err != nil {
		return err
	}

	if err := checkUserLoginAttempts(user, *a.Config().ServiceSettings.MaximumLoginAttempts); err != nil {
		return err
	}

	return nil
}

func (a *App) CheckUserPostflightAuthenticationCriteria(user *model.User) *model.AppError {
	if !user.EmailVerified && a.Config().EmailSettings.RequireEmailVerification {
		return model.NewAppError("Login", "api.user.login.not_verified.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}

	return nil
}

func (a *App) CheckUserMfa(user *model.User, token string) *model.AppError {
	if license := a.License(); !user.MfaActive || license == nil || !*license.Features.MFA || !*a.Config().ServiceSettings.EnableMultifactorAuthentication {
		return nil
	}

	if a.Mfa == nil {
		return model.NewAppError("checkUserMfa", "api.user.check_user_mfa.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	ok, err := a.Mfa.ValidateToken(user.MfaSecret, token)
	if err != nil {
		return err
	}

	if !ok {
		return model.NewAppError("checkUserMfa", "api.user.check_user_mfa.bad_code.app_error", nil, "", http.StatusUnauthorized)
	}

	return nil
}

func checkUserLoginAttempts(user *model.User, max int) *model.AppError {
	if user.FailedAttempts >= max {
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

func (a *App) authenticateUser(user *model.User, password, mfaToken string) (*model.User, *model.AppError) {
	license := a.License()
	ldapAvailable := *a.Config().LdapSettings.Enable && a.Ldap != nil && license != nil && *license.Features.LDAP

	if user.AuthService == model.USER_AUTH_SERVICE_LDAP {
		if !ldapAvailable {
			err := model.NewAppError("login", "api.user.login_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
			return user, err
		}

		ldapUser, err := a.checkLdapUserPasswordAndAllCriteria(user.AuthData, password, mfaToken)
		if err != nil {
			err.StatusCode = http.StatusUnauthorized
			return user, err
		}

		// slightly redundant to get the user again, but we need to get it from the LDAP server
		return ldapUser, nil
	}

	if user.AuthService != "" {
		authService := user.AuthService
		if authService == model.USER_AUTH_SERVICE_SAML {
			authService = strings.ToUpper(authService)
		}
		err := model.NewAppError("login", "api.user.login.use_auth_service.app_error", map[string]interface{}{"AuthService": authService}, "", http.StatusBadRequest)
		return user, err
	}

	if err := a.CheckPasswordAndAllCriteria(user, password, mfaToken); err != nil {
		err.StatusCode = http.StatusUnauthorized
		return user, err
	}

	return user, nil
}

func ParseAuthTokenFromRequest(r *http.Request) (string, TokenLocation) {
	authHeader := r.Header.Get(model.HEADER_AUTH)

	// Attempt to parse the token from the cookie
	if cookie, err := r.Cookie(model.SESSION_COOKIE_TOKEN); err == nil {
		return cookie.Value, TokenLocationCookie
	}

	// Parse the token from the header
	if len(authHeader) > 6 && strings.ToUpper(authHeader[0:6]) == model.HEADER_BEARER {
		// Default session token
		return authHeader[7:], TokenLocationHeader
	}

	if len(authHeader) > 5 && strings.ToLower(authHeader[0:5]) == model.HEADER_TOKEN {
		// OAuth token
		return authHeader[6:], TokenLocationHeader
	}

	// Attempt to parse token out of the query string
	if token := r.URL.Query().Get("access_token"); token != "" {
		return token, TokenLocationQueryString
	}

	return "", TokenLocationNotFound
}
