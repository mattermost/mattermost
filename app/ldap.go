// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func (a *App) SyncLdap() {
	a.Srv.Go(func() {

		if license := a.License(); license != nil && *license.Features.LDAP && *a.Config().LdapSettings.EnableSync {
			if ldapI := a.Ldap; ldapI != nil {
				ldapI.StartSynchronizeJob(false)
			} else {
				mlog.Error("Not executing ldap sync because ldap is not available")
			}
		}
	})
}

func (a *App) TestLdap() *model.AppError {
	license := a.License()
	if ldapI := a.Ldap; ldapI != nil && license != nil && *license.Features.LDAP && (*a.Config().LdapSettings.Enable || *a.Config().LdapSettings.EnableSync) {
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

// GetLdapGroup retrieves a single LDAP group by the given LDAP group id.
func (a *App) GetLdapGroup(ldapGroupID string) (*model.Group, *model.AppError) {
	var group *model.Group

	if a.Ldap != nil {
		var err *model.AppError
		group, err = a.Ldap.GetGroup(ldapGroupID)
		if err != nil {
			return nil, err
		}
	} else {
		ae := model.NewAppError("GetLdapGroup", "ent.ldap.app_error", nil, "", http.StatusNotImplemented)
		mlog.Error("Unable to use ldap", mlog.String("ldap_group_id", ldapGroupID), mlog.Err(ae))
		return nil, ae
	}

	return group, nil
}

// GetAllLdapGroupsPage retrieves all LDAP groups under the configured base DN using the default or configured group
// filter.
func (a *App) GetAllLdapGroupsPage(page int, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError) {
	var groups []*model.Group
	var total int

	if a.Ldap != nil {
		var err *model.AppError
		groups, total, err = a.Ldap.GetAllGroupsPage(page, perPage, opts)
		if err != nil {
			return nil, 0, err
		}
	} else {
		ae := model.NewAppError("GetAllLdapGroupsPage", "ent.ldap.app_error", nil, "", http.StatusNotImplemented)
		mlog.Error("Unable to use ldap", mlog.Err(ae))
		return nil, 0, ae
	}

	return groups, total, nil
}

func (a *App) SwitchEmailToLdap(email, password, code, ldapLoginId, ldapPassword string) (string, *model.AppError) {
	if a.License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
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

	if err := ldapInterface.SwitchToLdap(user.Id, ldapLoginId, ldapPassword); err != nil {
		return "", err
	}

	a.Srv.Go(func() {
		if err := a.SendSignInChangeEmail(user.Email, "AD/LDAP", user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error(err.Error())
		}
	})

	return "/login?extra=signin_change", nil
}

func (a *App) SwitchLdapToEmail(ldapPassword, code, email, newPassword string) (string, *model.AppError) {
	if a.License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
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

	if err := ldapInterface.CheckPasswordAuthData(*user.AuthData, ldapPassword); err != nil {
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

	a.Srv.Go(func() {
		if err := a.SendSignInChangeEmail(user.Email, T("api.templates.signin_change_email.body.method_email"), user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error(err.Error())
		}
	})

	return "/login?extra=signin_change", nil
}
