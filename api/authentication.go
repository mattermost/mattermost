// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func checkPasswordAndAllCriteria(user *model.User, password string, mfaToken string) *model.AppError {
	if err := checkUserPassword(user, password); err != nil {
		return err
	}

	if err := checkUserAdditionalAuthenticationCriteria(user, mfaToken); err != nil {
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

func checkUserAdditionalAuthenticationCriteria(user *model.User, mfaToken string) *model.AppError {
	if err := checkUserMfa(user, mfaToken); err != nil {
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

func checkUserMfa(user *model.User, token string) *model.AppError {
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
