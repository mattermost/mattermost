// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) NotifySystemAdminsToUpgrade(c *request.Context, currentUserTeamID string) *model.AppError {
	userId := c.Session().Id

	fakeId := strings.ReplaceAll(model.CloudNotifyAdminInfo, "_", "") + "123456"

	// check if already notified
	notificationPref, err := a.Srv().Store.Preference().Get(fakeId, model.PreferenceCloudUserEphemeralInfo, model.CloudNotifyAdminInfo)
	if err != nil {
		mlog.Warn("Unable to get preference cloud_user_ephemeral_info", mlog.Err(err))
	}

	if notificationPref != nil {
		info := &model.AdminNotificationUserInfo{}
		err = json.Unmarshal([]byte(notificationPref.Value), info)
		if err != nil {
			mlog.Warn("Unable to Unmarshal", mlog.Err(err))
		}

		if !model.CanNotify(info.LastNotificationTimestamp) {
			return model.NewAppError("app.NotifySystemAdminsToUpgrade", "api.cloud.notify_admin_to_upgrade_error.already_notified", nil, "", http.StatusForbidden)
		}
	}

	team, appErr := a.GetTeam(currentUserTeamID)
	if appErr != nil {
		return appErr
	}

	sysadmins, appErr := a.GetUsersFromProfiles(&model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SystemAdminRoleId,
		Inactive: false,
	})

	if appErr != nil {
		return appErr
	}

	systemBot, appErr := a.GetSystemBot()
	if appErr != nil {
		return appErr
	}

	for _, admin := range sysadmins {
		T := i18n.GetUserTranslations(admin.Locale)
		channel, appErr := a.GetOrCreateDirectChannel(c, systemBot.UserId, admin.Id)
		if appErr != nil {
			mlog.Warn("Error getting direct channel", mlog.Err(appErr))
			continue
		}

		post := &model.Post{
			Message:   T("api.cloud.upgrade_plan_bot_message", map[string]any{"TeamName": team.Name}),
			UserId:    systemBot.UserId,
			ChannelId: channel.Id,
			Type:      fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), // webapp will have to create renderer for this custom post type
		}

		_, appErr = a.CreatePost(c, post, channel, false, true)
		if appErr != nil {
			mlog.Warn("Error creating post", mlog.Err(appErr))
			continue
		}
	}

	// mark as done for current user until end of cool off period
	out, err := json.Marshal(&model.AdminNotificationUserInfo{
		LastUserIDToNotify:        userId,
		LastNotificationTimestamp: model.GetMillis(),
	})
	if err != nil {
		mlog.Warn("Unable to Marshal", mlog.Err(err))
	}

	pref := model.Preference{
		UserId:   fakeId, // to only have one preference for now and not a preference per user
		Category: model.PreferenceCloudUserEphemeralInfo,
		Name:     model.CloudNotifyAdminInfo,
		Value:    string(out),
	}

	if err := a.Srv().Store.Preference().Save(model.Preferences{pref}); err != nil {
		mlog.Warn("Encountered error saving cloud_user_ephemeral_info preference", mlog.Err(err))
	}

	return nil
}

// Ensure cloud service wrapper implements `product.CloudService`
var _ product.CloudService = (*cloudWrapper)(nil)

// cloudWrapper provides an implementation of `product.CloudService` for use by products.
type cloudWrapper struct {
	cloud einterfaces.CloudInterface
}

func (c *cloudWrapper) GetCloudLimits() (*model.ProductLimits, error) {
	if c.cloud != nil {
		return c.cloud.GetCloudLimits("")
	}

	return &model.ProductLimits{}, nil
}

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

func (a *App) AdjustInProductLimits(limits *model.ProductLimits, subscription *model.Subscription) *model.AppError {
	if limits.Teams != nil && limits.Teams.Active != nil && *limits.Teams.Active > 0 {
		err := a.AdjustTeamsFromProductLimits(limits.Teams)
		if err != nil {
			return err
		}
	}

	return nil
}

func getNextBillingDateString() string {
	now := time.Now()
	t := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	return fmt.Sprintf("%s %d, %d", t.Month(), t.Day(), t.Year())
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

	billingDate := getNextBillingDateString()

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for _, admin := range sysAdmins {
		name := admin.FirstName
		if name == "" {
			name = admin.Username
		}

		err := a.Srv().EmailService.SendCloudUpgradeConfirmationEmail(admin.Email, name, billingDate, admin.Locale, *a.Config().ServiceSettings.SiteURL, subscription.GetWorkSpaceNameFromDNS())
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
