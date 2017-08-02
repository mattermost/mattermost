// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"strings"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func CheckPasswordAndAllCriteria(user *model.User, password string, mfaToken string) *model.AppError {
	if err := CheckUserAdditionalAuthenticationCriteria(user, mfaToken); err != nil {
		return err
	}

	if err := checkUserPassword(user, password); err != nil {
		return err
	}

	return nil
}

// This to be used for places we check the users password when they are already logged in
func doubleCheckPassword(user *model.User, password string) *model.AppError {
	if err := checkUserLoginAttempts(user); err != nil {
		return err
	}

	if err := checkUserPassword(user, password); err != nil {
		return err
	}

	return nil
}

func checkUserPassword(user *model.User, password string) *model.AppError {
	if !model.ComparePassword(user.Password, password) {
		if result := <-Srv.Store.User().UpdateFailedPasswordAttempts(user.Id, user.FailedAttempts+1); result.Err != nil {
			return result.Err
		}

		return model.NewAppError("checkUserPassword", "api.user.check_user_password.invalid.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	} else {
		if result := <-Srv.Store.User().UpdateFailedPasswordAttempts(user.Id, 0); result.Err != nil {
			return result.Err
		}

		return nil
	}
}

func checkLdapUserPasswordAndAllCriteria(ldapId *string, password string, mfaToken string) (*model.User, *model.AppError) {
	ldapInterface := einterfaces.GetLdapInterface()

	if ldapInterface == nil || ldapId == nil {
		err := model.NewAppError("doLdapAuthentication", "api.user.login_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
		return nil, err
	}

	var user *model.User
	if ldapUser, err := ldapInterface.DoLogin(*ldapId, password); err != nil {
		err.StatusCode = http.StatusUnauthorized
		return nil, err
	} else {
		user = ldapUser
	}

	if err := CheckUserMfa(user, mfaToken); err != nil {
		return nil, err
	}

	if err := checkUserNotDisabled(user); err != nil {
		return nil, err
	}

	// user successfully authenticated
	return user, nil
}

func CheckUserAdditionalAuthenticationCriteria(user *model.User, mfaToken string) *model.AppError {
	if err := CheckUserMfa(user, mfaToken); err != nil {
		return err
	}

	if err := checkEmailVerified(user); err != nil {
		return err
	}

	if err := checkUserNotDisabled(user); err != nil {
		return err
	}

	if err := checkUserLoginAttempts(user); err != nil {
		return err
	}

	return nil
}

func CheckUserMfa(user *model.User, token string) *model.AppError {
	if !user.MfaActive || !utils.IsLicensed() || !*utils.License().Features.MFA || !*utils.Cfg.ServiceSettings.EnableMultifactorAuthentication {
		return nil
	}

	mfaInterface := einterfaces.GetMfaInterface()
	if mfaInterface == nil {
		return model.NewAppError("checkUserMfa", "api.user.check_user_mfa.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if ok, err := mfaInterface.ValidateToken(user.MfaSecret, token); err != nil {
		return err
	} else if !ok {
		return model.NewAppError("checkUserMfa", "api.user.check_user_mfa.bad_code.app_error", nil, "", http.StatusUnauthorized)
	}

	return nil
}

func checkUserLoginAttempts(user *model.User) *model.AppError {
	if user.FailedAttempts >= utils.Cfg.ServiceSettings.MaximumLoginAttempts {
		return model.NewAppError("checkUserLoginAttempts", "api.user.check_user_login_attempts.too_many.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}

	return nil
}

func checkEmailVerified(user *model.User) *model.AppError {
	if !user.EmailVerified && utils.Cfg.EmailSettings.RequireEmailVerification {
		return model.NewAppError("Login", "api.user.login.not_verified.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}
	return nil
}

func checkUserNotDisabled(user *model.User) *model.AppError {
	if user.DeleteAt > 0 {
		return model.NewAppError("Login", "api.user.login.inactive.app_error", nil, "user_id="+user.Id, http.StatusUnauthorized)
	}
	return nil
}

func authenticateUser(user *model.User, password, mfaToken string) (*model.User, *model.AppError) {
	ldapAvailable := *utils.Cfg.LdapSettings.Enable && einterfaces.GetLdapInterface() != nil && utils.IsLicensed() && *utils.License().Features.LDAP

	if user.AuthService == model.USER_AUTH_SERVICE_LDAP {
		if !ldapAvailable {
			err := model.NewAppError("login", "api.user.login_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
			return user, err
		} else if ldapUser, err := checkLdapUserPasswordAndAllCriteria(user.AuthData, password, mfaToken); err != nil {
			err.StatusCode = http.StatusUnauthorized
			return user, err
		} else {
			// slightly redundant to get the user again, but we need to get it from the LDAP server
			return ldapUser, nil
		}
	} else if user.AuthService != "" {
		authService := user.AuthService
		if authService == model.USER_AUTH_SERVICE_SAML {
			authService = strings.ToUpper(authService)
		}
		err := model.NewAppError("login", "api.user.login.use_auth_service.app_error", map[string]interface{}{"AuthService": authService}, "", http.StatusBadRequest)
		return user, err
	} else {
		if err := CheckPasswordAndAllCriteria(user, password, mfaToken); err != nil {
			err.StatusCode = http.StatusUnauthorized
			return user, err
		} else {
			return user, nil
		}
	}
}
