// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (a *App) getSysAdminsEmailRecipients() ([]*model.User, *model.AppError) {
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SystemAdminRoleId,
		Inactive: false,
	}
	return a.GetUsersFromProfiles(userOptions)
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

func (a *App) SendUpgradeConfirmationEmail() *model.AppError {
	sysAdmins, e := a.getSysAdminsEmailRecipients()
	if e != nil {
		return e
	}

	if len(sysAdmins) == 0 {
		return model.NewAppError("app.SendCloudUpgradeConfirmationEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	subscription, err := a.Cloud().GetSubscription("")
	if err != nil {
		return model.NewAppError("app.SendCloudUpgradeConfirmationEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	// Build readable trial end date
	endTimeStamp := subscription.TrialEndAt
	t := time.Unix(endTimeStamp, 0)
	trialEndDate := fmt.Sprintf("%s %d, %d", t.Month(), t.Day(), t.Year())

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for _, admin := range sysAdmins {
		name := admin.FirstName
		if name == "" {
			name = admin.Username
		}

		err := a.Srv().EmailService.SendCloudUpgradeConfirmationEmail(admin.Email, name, trialEndDate, admin.Locale, *a.Config().ServiceSettings.SiteURL, subscription.GetWorkSpaceNameFromDNS())
		if err != nil {
			a.Log().Error("Error sending trial ended email to", mlog.String("email", admin.Email), mlog.Err(err))
			countNotOks++
		}
	}

	// if not even one admin got an email, we consider that this operation errored
	if countNotOks == len(sysAdmins) {
		return model.NewAppError("app.SendCloudUpgradeConfirmationEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
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

// GetCloudUsageForMessages returns posts usage percentage against total available limit on Cloud.
// Usage percentage is returned in multiples of 10 eg. 0, 10, 20
func (a *App) GetCloudUsageForMessages(userID string) (int, *model.AppError) {
	// Fetch limit
	limits, err := a.Cloud().GetCloudLimits(userID)
	if err != nil {
		return 0, model.NewAppError("GetCloudUsageForMessages", "app.channel.GetCloudLimits.internal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Fetch messages count
	c, err := a.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeDeleted: true})
	if err != nil {
		return 0, model.NewAppError("GetCloudUsageForMessages", "app.channel.AnalyticsPostCount.internal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Return usage %
	max := float64(*limits.Messages.History)
	count := float64(c)

	if count >= max {
		return 100, nil
	}

	usage := (count / max) * 100
	return utils.FloorToNearest10(usage), nil
}
