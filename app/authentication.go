// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	"net/http"
	"strings"
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

		return model.NewLocAppError("checkUserPassword", "api.user.check_user_password.invalid.app_error", nil, "user_id="+user.Id)
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
		err := model.NewLocAppError("doLdapAuthentication", "api.user.login_ldap.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
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
	if !user.MfaActive || !utils.IsLicensed || !*utils.License.Features.MFA || !*utils.Cfg.ServiceSettings.EnableMultifactorAuthentication {
		return nil
	}

	mfaInterface := einterfaces.GetMfaInterface()
	if mfaInterface == nil {
		return model.NewLocAppError("checkUserMfa", "api.user.check_user_mfa.not_available.app_error", nil, "")
	}

	if ok, err := mfaInterface.ValidateToken(user.MfaSecret, token); err != nil {
		return err
	} else if !ok {
		return model.NewLocAppError("checkUserMfa", "api.user.check_user_mfa.bad_code.app_error", nil, "")
	}

	return nil
}

func checkUserLoginAttempts(user *model.User) *model.AppError {
	if user.FailedAttempts >= utils.Cfg.ServiceSettings.MaximumLoginAttempts {
		return model.NewLocAppError("checkUserLoginAttempts", "api.user.check_user_login_attempts.too_many.app_error", nil, "user_id="+user.Id)
	}

	return nil
}

func checkEmailVerified(user *model.User) *model.AppError {
	if !user.EmailVerified && utils.Cfg.EmailSettings.RequireEmailVerification {
		return model.NewLocAppError("Login", "api.user.login.not_verified.app_error", nil, "user_id="+user.Id)
	}
	return nil
}

func checkUserNotDisabled(user *model.User) *model.AppError {
	if user.DeleteAt > 0 {
		return model.NewLocAppError("Login", "api.user.login.inactive.app_error", nil, "user_id="+user.Id)
	}
	return nil
}

func authenticateUser(user *model.User, password, mfaToken string) (*model.User, *model.AppError) {
	ldapAvailable := *utils.Cfg.LdapSettings.Enable && einterfaces.GetLdapInterface() != nil && utils.IsLicensed && *utils.License.Features.LDAP

	if user.AuthService == model.USER_AUTH_SERVICE_LDAP {
		if !ldapAvailable {
			err := model.NewLocAppError("login", "api.user.login_ldap.not_available.app_error", nil, "")
			err.StatusCode = http.StatusNotImplemented
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
		if authService == model.USER_AUTH_SERVICE_SAML || authService == model.USER_AUTH_SERVICE_LDAP {
			authService = strings.ToUpper(authService)
		}
		err := model.NewLocAppError("login", "api.user.login.use_auth_service.app_error", map[string]interface{}{"AuthService": authService}, "")
		err.StatusCode = http.StatusBadRequest
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
