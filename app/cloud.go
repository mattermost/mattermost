// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const lastTrialNotificationTimeStamp = "LAST_TRIAL_NOTIFICATION_TIMESTAMP"
const lastUpgradeNotificationTimeStamp = "LAST_UPGRADE_NOTIFICATION_TIMESTAMP"
const defaultCloudNotifyAdminCoolOffDays = 30

// Ensure cloud service wrapper implements `product.CloudService`
var _ product.CloudService = (*cloudWrapper)(nil)

// cloudWrapper provides an implementation of `product.CloudService` for use by products.
type cloudWrapper struct {
	cloud einterfaces.CloudInterface
}

func (a *App) SaveAdminNotification(userId string, notifyData *model.NotifyAdminToUpgradeRequest) *model.AppError {
	requiredFeature := notifyData.RequiredFeature
	requiredPlan := notifyData.RequiredPlan
	trial := notifyData.TrialNotification

	if a.UserAlreadyNotifiedOnRequiredFeature(userId, requiredFeature) {
		return model.NewAppError("app.SaveAdminNotification", "api.cloud.notify_admin_to_upgrade_error.already_notified", nil, "", http.StatusForbidden)
	}

	_, appErr := a.SaveAdminNotifyData(&model.NotifyAdminData{
		UserId:          userId,
		RequiredPlan:    requiredPlan,
		RequiredFeature: requiredFeature,
		Trial:           trial,
	})
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) doCheckForAdminUpgradeNotifications() {
	ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
	a.SendNotifyAdminPosts(ctx, false)
}

func (a *App) doCheckForAdminTrialNotifications() {
	ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
	a.SendNotifyAdminPosts(ctx, true)
}

func (a *App) SaveAdminNotifyData(data *model.NotifyAdminData) (*model.NotifyAdminData, *model.AppError) {
	d, err := a.Srv().Store.NotifyAdmin().Save(data)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("SaveAdminNotifyData", "app.notify_admin.save.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("SaveAdminNotifyData", "app.notify_admin.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return d, nil
}

func (a *App) SendNotifyAdminPosts(c *request.Context, trial bool) *model.AppError {
	if !a.CanNotify(trial) {
		return model.NewAppError("SendNotifyAdminPosts", "app.notify_admin.send_notification_post.app_error", nil, "Cannot notify yet", http.StatusForbidden)
	}

	workspaceName := ""

	subscription, _ := a.Cloud().GetSubscription("")
	if subscription != nil {
		workspaceName = subscription.GetWorkSpaceNameFromDNS()
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

	data, err := a.Srv().Store.NotifyAdmin().Get(trial)
	if err != nil {
		return model.NewAppError("SendNotifyAdminPosts", "app.notify_admin.send_notification_post.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(data) == 0 {
		return model.NewAppError("SendNotifyAdminPosts", "app.notify_admin.send_notification_post.app_error", nil, "No notification data available", http.StatusInternalServerError)
	}

	userBasedData := a.UserBasedFlatten(data)
	featureBasedData := a.FeatureBasedFlatten(data)
	props := make(model.StringInterface)

	for _, admin := range sysadmins {
		T := i18n.GetUserTranslations(admin.Locale)
		message := T("app.cloud.upgrade_plan_bot_message", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName})
		if len(userBasedData) == 1 {
			message = T("app.cloud.upgrade_plan_bot_message_single", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName}) // todo (allan): investigate if translations library can do this
		}
		if trial {
			message = T("app.cloud.trial_plan_bot_message", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName})
			if len(userBasedData) == 1 {
				message = T("app.cloud.trial_plan_bot_message_single", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName})
			}
		}

		channel, appErr := a.GetOrCreateDirectChannel(c, systemBot.UserId, admin.Id)
		if appErr != nil {
			mlog.Warn("Error getting direct channel", mlog.Err(appErr))
			continue
		}

		post := &model.Post{
			Message:   message,
			UserId:    systemBot.UserId,
			ChannelId: channel.Id,
			Type:      fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), // webapp will have to create renderer for this custom post type

		}

		props["requested_features"] = featureBasedData
		props["trial"] = trial
		post.SetProps(props)

		_, appErr = a.CreatePost(c, post, channel, false, true)
		if appErr != nil {
			mlog.Warn("Error creating post", mlog.Err(appErr))
			continue
		}
	}

	a.FinishSendAdminNotifyPost(trial)

	return nil
}

func (a *App) UserAlreadyNotifiedOnRequiredFeature(user, feature string) bool {
	data, err := a.Srv().Store.NotifyAdmin().GetDataByUserIdAndFeature(user, feature)
	if err != nil {
		return true // any error should flag as already notified to avoid data corruption like duplicates
	}
	if len(data) > 0 {
		return true // if we find data, it means this user already notified on the need for this feature
	}

	return false
}

func (a *App) CanNotify(trial bool) bool {
	systemVarName := lastUpgradeNotificationTimeStamp
	if trial {
		systemVarName = lastTrialNotificationTimeStamp
	}

	sysVal, sysValErr := a.Srv().Store.System().GetByName(systemVarName)
	if sysValErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(sysValErr, &nfErr) { // if no timestamps have been recorded before, system is free to notify
			return true
		}
		mlog.Error("Cannot notify", mlog.Err(sysValErr))
		return false
	}

	lastNotificationTimestamp, err := strconv.ParseFloat(sysVal.Value, 64)
	if err != nil {
		mlog.Error("Cannot notify", mlog.Err(err))
		return false
	}

	coolOffPeriodDaysEnv := os.Getenv("MM_CLOUD_NOTIFY_ADMIN_COOL_OFF_DAYS")
	coolOffPeriodDays, parseError := strconv.ParseFloat(coolOffPeriodDaysEnv, 64)
	if parseError != nil {
		coolOffPeriodDays = defaultCloudNotifyAdminCoolOffDays
	}
	daysToMillis := coolOffPeriodDays * 24 * 60 * 60 * 1000
	timeDiff := model.GetMillis() - int64(lastNotificationTimestamp)
	return timeDiff >= int64(daysToMillis)
}

func (a *App) FinishSendAdminNotifyPost(trial bool) {
	systemVarName := lastUpgradeNotificationTimeStamp
	if trial {
		systemVarName = lastTrialNotificationTimeStamp
	}

	val := strconv.FormatInt(model.GetMillis(), 10)
	sysVar := &model.System{Name: systemVarName, Value: val}
	if err := a.Srv().Store.System().SaveOrUpdate(sysVar); err != nil {
		mlog.Error("Unable to finish send admin notify post job", mlog.Err(err))
	}

	// all the notifications are now sent in a post and can safely be removed
	if err := a.Srv().Store.NotifyAdmin().DeleteAll(trial); err != nil {
		mlog.Error("Unable to finish send admin notify post job", mlog.Err(err))
	}

}

func (a *App) UserBasedFlatten(data []*model.NotifyAdminData) map[string][]*model.NotifyAdminData {
	myMapp := make(map[string][]*model.NotifyAdminData)
	for _, d := range data {
		myMapp[d.UserId] = append(myMapp[d.UserId], d)
	}

	return myMapp
}

func (a *App) FeatureBasedFlatten(data []*model.NotifyAdminData) map[string][]*model.NotifyAdminData {
	myMapp := make(map[string][]*model.NotifyAdminData)
	for _, d := range data {
		myMapp[d.RequiredFeature] = append(myMapp[d.RequiredFeature], d)
	}

	return myMapp
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
