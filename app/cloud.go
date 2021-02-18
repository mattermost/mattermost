// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) getSysAdminsEmailRecipients() ([]*model.User, *model.AppError) {
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SYSTEM_ADMIN_ROLE_ID,
		Inactive: false,
	}
	return a.GetUsers(userOptions)
}

// SendAdminUpgradeRequestEmail takes the username of user trying to alert admins and then applies rate limit of n (number of admins) emails per user per day
// before sending the emails.
func (a *App) SendAdminUpgradeRequestEmail(username string, subscription *model.Subscription) *model.AppError {
	if a.Srv().License() == nil || (a.Srv().License() != nil && !*a.Srv().License().Features.Cloud) {
		return nil
	}

	if subscription != nil && subscription.IsPaidTier == "true" {
		return nil
	}

	if a.Srv().EmailService.PerDayEmailRateLimiter == nil {
		return model.NewAppError("app.SendAdminUpgradeRequestEmail", "app.email.no_rate_limiter.app_error", nil, fmt.Sprintf("for username=%s", username), http.StatusInternalServerError)
	}

	// rate limit based on username as key
	rateLimited, result, err := a.Srv().EmailService.PerDayEmailRateLimiter.RateLimit(username, 1)
	if err != nil {
		return model.NewAppError("app.SendAdminUpgradeRequestEmail", "app.email.setup_rate_limiter.app_error", nil, fmt.Sprintf("username=%s, error=%v", username, err), http.StatusInternalServerError)
	}

	if rateLimited {
		return model.NewAppError("app.SendAdminUpgradeRequestEmail",
			"app.email.rate_limit_exceeded.app_error", map[string]interface{}{"RetryAfter": result.RetryAfter.String(), "ResetAfter": result.ResetAfter.String()},
			fmt.Sprintf("username=%s, retry_after_secs=%f, reset_after_secs=%f",
				username, result.RetryAfter.Seconds(), result.ResetAfter.Seconds()),
			http.StatusRequestEntityTooLarge)
	}

	sysAdmins, e := a.getSysAdminsEmailRecipients()
	if e != nil {
		return e
	}

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for admin := range sysAdmins {
		ok, err := a.Srv().EmailService.SendUpgradeEmail(username, sysAdmins[admin].Email, sysAdmins[admin].Locale, *a.Config().ServiceSettings.SiteURL)
		if !ok || err != nil {
			a.Log().Error("Error sending upgrade request email", mlog.Err(err))
			countNotOks++
		}
	}

	// if not even one admin got an email, we consider that this operation errored
	if countNotOks == len(sysAdmins) {
		return model.NewAppError("app.SendAdminUpgradeRequestEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (a *App) CheckAndSendUserLimitWarningEmails() *model.AppError {
	if a.Srv().License() == nil || (a.Srv().License() != nil && !*a.Srv().License().Features.Cloud) {
		// Not cloud instance, do nothing
		return nil
	}

	subscription, subErr := a.Cloud().GetSubscription()
	if subErr != nil {
		return subErr
	}

	if subscription != nil && subscription.IsPaidTier == "true" {
		// Paid subscription, do nothing
		return nil
	}

	cloudUserLimit := *a.Config().ExperimentalSettings.CloudUserLimit
	systemUserCount, _ := a.Srv().Store.User().Count(model.UserCountOptions{})
	remainingUsers := cloudUserLimit - systemUserCount

	if remainingUsers > 0 {
		return nil
	}
	sysAdmins, err := a.getSysAdminsEmailRecipients()
	if err != nil {
		return err
	}

	// -1 means they are 1 user over the limit - we only want to send the email for the 11th user
	if remainingUsers == -1 {
		// Over limit by 1 user
		for admin := range sysAdmins {
			a.Srv().EmailService.SendOverUserLimitWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *a.Config().ServiceSettings.SiteURL)
		}
	} else if remainingUsers == 0 {
		// At limit
		for admin := range sysAdmins {
			a.Srv().EmailService.SendAtUserLimitWarningEmail(sysAdmins[admin].Email, sysAdmins[admin].Locale, *a.Config().ServiceSettings.SiteURL)
		}
	}
	return nil
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
