// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io"
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// SyncLdap starts an LDAP sync job.
func (a *App) SyncLdap(rctx request.CTX) {
	a.Srv().Go(func() {
		if license := a.Srv().License(); license != nil && *license.Features.LDAP {
			if !*a.Config().LdapSettings.EnableSync {
				rctx.Logger().Error("LdapSettings.EnableSync is set to false. Skipping LDAP sync.")
				return
			}

			ldapI := a.Ldap()
			if ldapI == nil {
				rctx.Logger().Error("Not executing ldap sync because ldap is not available")
				return
			}
			if _, appErr := ldapI.StartSynchronizeJob(rctx, false); appErr != nil {
				rctx.Logger().Error("Failed to start LDAP sync job")
			}
		}
	})
}

func (a *App) TestLdap(rctx request.CTX) *model.AppError {
	license := a.Srv().License()
	if ldapI := a.LdapDiagnostic(); ldapI != nil && license != nil && *license.Features.LDAP && (*a.Config().LdapSettings.Enable || *a.Config().LdapSettings.EnableSync) {
		return ldapI.RunTest(rctx)
	}

	return model.NewAppError("TestLdap",
		"ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
}

func (a *App) TestLdapConnection(rctx request.CTX, settings model.LdapSettings) *model.AppError {
	license := a.Srv().License()
	ldapI := a.LdapDiagnostic()

	// NOTE: normally we would test (*a.Config().LdapSettings.Enable || *a.Config().LdapSettings.EnableSync),
	// but we want to allow sysadmins to test the connection without enabling and saving the config first.
	if ldapI != nil && license != nil && model.SafeDereference(license.Features.LDAP) {
		return ldapI.RunTestConnection(rctx, settings)
	}

	return model.NewAppError("TestLdapConnection",
		"ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
}

func (a *App) TestLdapDiagnostics(rctx request.CTX, testType model.LdapDiagnosticTestType, settings model.LdapSettings) ([]model.LdapDiagnosticResult, *model.AppError) {
	license := a.Srv().License()
	ldapI := a.LdapDiagnostic()

	// NOTE: normally we would test (*a.Config().LdapSettings.Enable || *a.Config().LdapSettings.EnableSync),
	// but we want to allow sysadmins to test the connection without enabling and saving the config first.
	if ldapI != nil && license != nil && *license.Features.LDAP {
		return ldapI.RunTestDiagnostics(rctx, testType, settings)
	}

	return nil, model.NewAppError("TestLdapDiagnostics", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
}

// GetLdapGroup retrieves a single LDAP group by the given LDAP group id.
func (a *App) GetLdapGroup(rctx request.CTX, ldapGroupID string) (*model.Group, *model.AppError) {
	var group *model.Group

	if a.Ldap() != nil {
		var err *model.AppError
		group, err = a.Ldap().GetGroup(rctx, ldapGroupID)
		if err != nil {
			return nil, err
		}
	} else {
		ae := model.NewAppError("GetLdapGroup", "ent.ldap.app_error", map[string]any{"ldap_group_id": ldapGroupID}, "", http.StatusNotImplemented)
		return nil, ae
	}

	return group, nil
}

// GetAllLdapGroupsPage retrieves all LDAP groups under the configured base DN using the default or configured group
// filter.
func (a *App) GetAllLdapGroupsPage(rctx request.CTX, page int, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError) {
	var groups []*model.Group
	var total int

	if a.Ldap() != nil {
		var err *model.AppError
		groups, total, err = a.Ldap().GetAllGroupsPage(rctx, page, perPage, opts)
		if err != nil {
			return nil, 0, err
		}
	} else {
		ae := model.NewAppError("GetAllLdapGroupsPage", "ent.ldap.app_error", nil, "", http.StatusNotImplemented)
		return nil, 0, ae
	}

	return groups, total, nil
}

func (a *App) SwitchEmailToLdap(rctx request.CTX, email, password, code, ldapLoginId, ldapPassword string) (string, *model.AppError) {
	if a.Srv().License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("emailToLdap", "api.user.email_to_ldap.not_available.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if err := a.CheckPasswordAndAllCriteria(rctx, user.Id, password, code); err != nil {
		return "", err
	}

	if err := a.RevokeAllSessions(rctx, user.Id); err != nil {
		return "", err
	}

	ldapInterface := a.Ldap()
	if ldapInterface == nil {
		return "", model.NewAppError("SwitchEmailToLdap", "api.user.email_to_ldap.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := ldapInterface.SwitchToLdap(rctx, user.Id, ldapLoginId, ldapPassword); err != nil {
		return "", err
	}

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.SendSignInChangeEmail(user.Email, "AD/LDAP", user.Locale, a.GetSiteURL()); err != nil {
			rctx.Logger().Error("Could not send sign in method changed e-mail", mlog.Err(err))
		}
	})

	return "/login?extra=signin_change", nil
}

func (a *App) SwitchLdapToEmail(rctx request.CTX, ldapPassword, code, email, newPassword string) (string, *model.AppError) {
	if a.Srv().License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("ldapToEmail", "api.user.ldap_to_email.not_available.app_error", nil, "", http.StatusForbidden)
	}

	if !*a.Config().EmailSettings.EnableSignUpWithEmail {
		return "", model.NewAppError("SwitchEmailToLdap", "api.user.auth_switch.not_available.email_signup_disabled.app_error", nil, "", http.StatusForbidden)
	}

	if !*a.Config().EmailSettings.EnableSignInWithEmail && !*a.Config().EmailSettings.EnableSignInWithUsername {
		return "", model.NewAppError("SwitchEmailToLdap", "api.user.auth_switch.not_available.login_disabled.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if user.AuthService != model.UserAuthServiceLdap {
		return "", model.NewAppError("SwitchLdapToEmail", "api.user.ldap_to_email.not_ldap_account.app_error", nil, "", http.StatusBadRequest)
	}

	ldapInterface := a.Ldap()
	if ldapInterface == nil || user.AuthData == nil {
		return "", model.NewAppError("SwitchLdapToEmail", "api.user.ldap_to_email.not_available.app_error", nil, "", http.StatusNotImplemented)
	}

	user, err = a.checkLdapUserPasswordAndAllCriteria(rctx, user, ldapPassword, code)
	if err != nil {
		return "", err
	}

	if err := a.UpdatePassword(rctx, user, newPassword); err != nil {
		return "", err
	}

	if err := a.RevokeAllSessions(rctx, user.Id); err != nil {
		return "", err
	}

	T := i18n.GetUserTranslations(user.Locale)

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.SendSignInChangeEmail(user.Email, T("api.templates.signin_change_email.body.method_email"), user.Locale, a.GetSiteURL()); err != nil {
			rctx.Logger().Error("Could not send sign in method changed e-mail", mlog.Err(err))
		}
	})

	return "/login?extra=signin_change", nil
}

func (a *App) MigrateIdLDAP(rctx request.CTX, toAttribute string) *model.AppError {
	if ldapI := a.Ldap(); ldapI != nil {
		if err := ldapI.MigrateIDAttribute(rctx, toAttribute); err != nil {
			switch err := err.(type) {
			case *model.AppError:
				return err
			default:
				return model.NewAppError("IdMigrateLDAP", "ent.ldap_id_migrate.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		return nil
	}
	return model.NewAppError("IdMigrateLDAP", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
}

func (a *App) writeLdapFile(filename string, fileData *multipart.FileHeader) *model.AppError {
	file, err := fileData.Open()
	if err != nil {
		return model.NewAppError("AddLdapCertificate", "api.admin.add_certificate.open.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return model.NewAppError("AddLdapCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	err = a.Srv().platform.SetConfigFile(filename, data)
	if err != nil {
		return model.NewAppError("AddLdapCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) AddLdapPublicCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := a.writeLdapFile(model.LdapPublicCertificateName, fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.LdapSettings.PublicCertificateFile = model.LdapPublicCertificateName

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}

func (a *App) AddLdapPrivateCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := a.writeLdapFile(model.LdapPrivateKeyName, fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.LdapSettings.PrivateKeyFile = model.LdapPrivateKeyName

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}

func (a *App) removeLdapFile(filename string) *model.AppError {
	if err := a.Srv().platform.RemoveConfigFile(filename); err != nil {
		return model.NewAppError("RemoveLdapFile", "api.admin.remove_certificate.delete.app_error", map[string]any{"Filename": filename}, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) RemoveLdapPublicCertificate() *model.AppError {
	if err := a.removeLdapFile(*a.Config().LdapSettings.PublicCertificateFile); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.LdapSettings.PublicCertificateFile = ""

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}

func (a *App) RemoveLdapPrivateCertificate() *model.AppError {
	if err := a.removeLdapFile(*a.Config().LdapSettings.PrivateKeyFile); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.LdapSettings.PrivateKeyFile = ""

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}
