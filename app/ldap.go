// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) SyncLdap() {
	a.Go(func() {

		if utils.IsLicensed() && *utils.License().Features.LDAP && *a.Config().LdapSettings.EnableSync {
			if ldapI := a.Ldap; ldapI != nil {
				ldapI.StartSynchronizeJob(false)
			} else {
				l4g.Error("%v", model.NewAppError("SyncLdap", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented).Error())
			}
		}
	})
}

func (a *App) TestLdap() *model.AppError {
	if ldapI := a.Ldap; ldapI != nil && utils.IsLicensed() && *utils.License().Features.LDAP && (*a.Config().LdapSettings.Enable || *a.Config().LdapSettings.EnableSync) {
		if err := ldapI.RunTest(); err != nil {
			err.StatusCode = 500
			return err
		}
	} else {
		err := model.NewAppError("TestLdap", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
		return err
	}

	return nil
}

func (a *App) SwitchEmailToLdap(email, password, code, ldapId, ldapPassword string) (string, *model.AppError) {
	if utils.IsLicensed() && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("emailToLdap", "api.user.email_to_ldap.not_available.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if err := a.CheckPasswordAndAllCriteria(user, password, code); err != nil {
		return "", err
	}

	if err := a.RevokeAllSessions(user.Id); err != nil {
		return "", err
	}

	ldapInterface := a.Ldap
	if ldapInterface == nil {
		return "", model.NewAppError("SwitchEmailToLdap", "api.user.email_to_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := ldapInterface.SwitchToLdap(user.Id, ldapId, ldapPassword); err != nil {
		return "", err
	}

	a.Go(func() {
		if err := a.SendSignInChangeEmail(user.Email, "AD/LDAP", user.Locale, utils.GetSiteURL()); err != nil {
			l4g.Error(err.Error())
		}
	})

	return "/login?extra=signin_change", nil
}

func (a *App) SwitchLdapToEmail(ldapPassword, code, email, newPassword string) (string, *model.AppError) {
	if utils.IsLicensed() && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("ldapToEmail", "api.user.ldap_to_email.not_available.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		return "", model.NewAppError("SwitchLdapToEmail", "api.user.ldap_to_email.not_ldap_account.app_error", nil, "", http.StatusBadRequest)
	}

	ldapInterface := a.Ldap
	if ldapInterface == nil || user.AuthData == nil {
		return "", model.NewAppError("SwitchLdapToEmail", "api.user.ldap_to_email.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := ldapInterface.CheckPassword(*user.AuthData, ldapPassword); err != nil {
		return "", err
	}

	if err := a.CheckUserMfa(user, code); err != nil {
		return "", err
	}

	if err := a.UpdatePassword(user, newPassword); err != nil {
		return "", err
	}

	if err := a.RevokeAllSessions(user.Id); err != nil {
		return "", err
	}

	T := utils.GetUserTranslations(user.Locale)

	a.Go(func() {
		if err := a.SendSignInChangeEmail(user.Email, T("api.templates.signin_change_email.body.method_email"), user.Locale, utils.GetSiteURL()); err != nil {
			l4g.Error(err.Error())
		}
	})

	return "/login?extra=signin_change", nil
}
