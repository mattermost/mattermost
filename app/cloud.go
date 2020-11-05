// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

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
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SYSTEM_ADMIN_ROLE_ID,
		Inactive: false,
	}
	sysAdmins, err := a.GetUsers(userOptions)
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
