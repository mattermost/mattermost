// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) SendIPFiltersChangedEmail(c request.CTX, userID string) error {
	cloudWorkspaceOwnerEmailAddress := ""
	if a.License().IsCloud() {
		portalUserCustomer, cErr := a.Cloud().GetCloudCustomer(userID)
		if cErr != nil {
			c.Logger().Error("Failed to get portal user customer", mlog.Err(cErr))
		}
		if cErr == nil && portalUserCustomer != nil {
			cloudWorkspaceOwnerEmailAddress = portalUserCustomer.Email
		}
	}

	initiatingUser, err := a.Srv().Store().User().GetProfileByIds(context.Background(), []string{userID}, nil, true)
	if err != nil {
		c.Logger().Error("Failed to get initiating user", mlog.Err(err))
	}

	users, err := a.Srv().Store().User().GetSystemAdminProfiles()
	if err != nil {
		c.Logger().Error("Failed to get system admins", mlog.Err(err))
	}

	for _, user := range users {
		if err = a.Srv().EmailService.SendIPFiltersChangedEmail(user.Email, initiatingUser[0], *a.Config().ServiceSettings.SiteURL, *a.Config().CloudSettings.CWSURL, user.Locale, cloudWorkspaceOwnerEmailAddress == user.Email); err != nil {
			c.Logger().Error("Error while sending IP filters changed email", mlog.Err(err))
		}
	}

	return nil
}
