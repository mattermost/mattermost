// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) getSysAdminsEmailRecipients() ([]*model.User, *model.AppError) {
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SystemAdminRoleId,
		Inactive: false,
	}
	return a.GetUsers(userOptions)
}

func (a *App) SendPaymentFailedEmail(failedPayment *model.FailedPayment) *model.AppError {
	sysAdmins, err := a.getSysAdminsEmailRecipients()
	if err != nil {
		return err
	}

	for _, admin := range sysAdmins {
		_, err := a.Srv().EmailService.SendPaymentFailedEmail(admin.Email, admin.Locale, failedPayment, *a.Config().ServiceSettings.SiteURL)
		if err != nil {
			a.Log().Error("Error sending payment failed email", mlog.Err(err))
		}
	}
	return nil
}

// SendNoCardPaymentFailedEmail
func (a *App) SendNoCardPaymentFailedEmail() *model.AppError {
	sysAdmins, err := a.getSysAdminsEmailRecipients()
	if err != nil {
		return err
	}

	for _, admin := range sysAdmins {
		err := a.Srv().EmailService.SendNoCardPaymentFailedEmail(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL)
		if err != nil {
			a.Log().Error("Error sending payment failed email", mlog.Err(err))
		}
	}
	return nil
}

func (a *App) SendCloudTrialEndWarningEmail(trialEndDate, siteURL string) *model.AppError {
	sysAdmins, e := a.getSysAdminsEmailRecipients()
	if e != nil {
		return e
	}

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for admin := range sysAdmins {
		name := sysAdmins[admin].FirstName
		if name == "" {
			name = sysAdmins[admin].Username
		}
		err := a.Srv().EmailService.SendCloudTrialEndWarningEmail(sysAdmins[admin].Email, name, trialEndDate, sysAdmins[admin].Locale, siteURL)
		if err != nil {
			a.Log().Error("Error sending trial ending warning to", mlog.String("email", sysAdmins[admin].Email), mlog.Err(err))
			countNotOks++
		}
	}

	// if not even one admin got an email, we consider that this operation errored
	if countNotOks == len(sysAdmins) {
		return model.NewAppError("app.SendCloudTrialEndWarningEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendCloudTrialEndedEmail() *model.AppError {
	sysAdmins, e := a.getSysAdminsEmailRecipients()
	if e != nil {
		return e
	}

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for admin := range sysAdmins {
		name := sysAdmins[admin].FirstName
		if name == "" {
			name = sysAdmins[admin].Username
		}

		err := a.Srv().EmailService.SendCloudTrialEndedEmail(sysAdmins[admin].Email, name, sysAdmins[admin].Locale, *a.Config().ServiceSettings.SiteURL)
		if err != nil {
			a.Log().Error("Error sending trial ended email to", mlog.String("email", sysAdmins[admin].Email), mlog.Err(err))
			countNotOks++
		}
	}

	// if not even one admin got an email, we consider that this operation errored
	if countNotOks == len(sysAdmins) {
		return model.NewAppError("app.SendCloudTrialEndedEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}
