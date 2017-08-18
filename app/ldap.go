// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func SyncLdap() {
	go func() {
		if utils.IsLicensed() && *utils.License().Features.LDAP && *utils.Cfg.LdapSettings.Enable {
			if ldapI := einterfaces.GetLdapInterface(); ldapI != nil {
				ldapI.SyncNow()
			} else {
				l4g.Error("%v", model.NewLocAppError("SyncLdap", "ent.ldap.disabled.app_error", nil, "").Error())
			}
		}
	}()
}

func TestLdap() *model.AppError {
	if ldapI := einterfaces.GetLdapInterface(); ldapI != nil && utils.IsLicensed() && *utils.License().Features.LDAP && *utils.Cfg.LdapSettings.Enable {
		if err := ldapI.RunTest(); err != nil {
			err.StatusCode = 500
			return err
		}
	} else {
		err := model.NewLocAppError("TestLdap", "ent.ldap.disabled.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	return nil
}

func SwitchEmailToLdap(email, password, code, ldapId, ldapPassword string) (string, *model.AppError) {
	user, err := GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if err := CheckPasswordAndAllCriteria(user, password, code); err != nil {
		return "", err
	}

	if err := RevokeAllSessions(user.Id); err != nil {
		return "", err
	}

	ldapInterface := einterfaces.GetLdapInterface()
	if ldapInterface == nil {
		return "", model.NewAppError("SwitchEmailToLdap", "api.user.email_to_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := ldapInterface.SwitchToLdap(user.Id, ldapId, ldapPassword); err != nil {
		return "", err
	}

	go func() {
		if err := SendSignInChangeEmail(user.Email, "AD/LDAP", user.Locale, utils.GetSiteURL()); err != nil {
			l4g.Error(err.Error())
		}
	}()

	return "/login?extra=signin_change", nil
}

func SwitchLdapToEmail(ldapPassword, code, email, newPassword string) (string, *model.AppError) {
	user, err := GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		return "", model.NewAppError("SwitchLdapToEmail", "api.user.ldap_to_email.not_ldap_account.app_error", nil, "", http.StatusBadRequest)
	}

	ldapInterface := einterfaces.GetLdapInterface()
	if ldapInterface == nil || user.AuthData == nil {
		return "", model.NewAppError("SwitchLdapToEmail", "api.user.ldap_to_email.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := ldapInterface.CheckPassword(*user.AuthData, ldapPassword); err != nil {
		return "", err
	}

	if err := CheckUserMfa(user, code); err != nil {
		return "", err
	}

	if err := UpdatePassword(user, newPassword); err != nil {
		return "", err
	}

	if err := RevokeAllSessions(user.Id); err != nil {
		return "", err
	}

	T := utils.GetUserTranslations(user.Locale)

	go func() {
		if err := SendSignInChangeEmail(user.Email, T("api.templates.signin_change_email.body.method_email"), user.Locale, utils.GetSiteURL()); err != nil {
			l4g.Error(err.Error())
		}
	}()

	return "/login?extra=signin_change", nil
}
