// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const lastTrialNotificationTimeStamp = "LAST_TRIAL_NOTIFICATION_TIMESTAMP"
const lastUpgradeNotificationTimeStamp = "LAST_UPGRADE_NOTIFICATION_TIMESTAMP"
const defaultNotifyAdminCoolOffDays = 14

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

func (a *App) DoCheckForAdminNotifications(trial bool) *model.AppError {
	ctx := request.EmptyContext(a.Srv().Log())
	license := a.Srv().License()
	if license == nil {
		return model.NewAppError("DoCheckForAdminNotifications", "app.notify_admin.send_notification_post.app_error", nil, "No license found", http.StatusInternalServerError)
	}

	currentSKU := license.SkuShortName
	workspaceName := ""

	return a.SendNotifyAdminPosts(ctx, workspaceName, currentSKU, trial)
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

func filterNotificationData(data []*model.NotifyAdminData, test func(*model.NotifyAdminData) bool) (ret []*model.NotifyAdminData) {
	for _, d := range data {
		if test(d) {
			ret = append(ret, d)
		}
	}
	return
}

func (a *App) SendNotifyAdminPosts(c *request.Context, workspaceName string, currentSKU string, trial bool) *model.AppError {
	if !a.CanNotifyAdmin(trial) {
		return model.NewAppError("SendNotifyAdminPosts", "app.notify_admin.send_notification_post.app_error", nil, "Cannot notify yet", http.StatusForbidden)
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

	now := model.GetMillis()

	data, err := a.Srv().Store.NotifyAdmin().Get(trial)
	if err != nil {
		return model.NewAppError("SendNotifyAdminPosts", "app.notify_admin.send_notification_post.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	data = filterNotificationData(data, func(nad *model.NotifyAdminData) bool { return nad.RequiredPlan != currentSKU })

	if len(data) == 0 {
		mlog.Warn("No notification data available")
		return nil
	}

	userBasedData := a.groupNotifyAdminByUser(data)
	featureBasedData := a.groupNotifyAdminByFeature(data)
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

	a.FinishSendAdminNotifyPost(trial, now)

	return nil
}

func (a *App) UserAlreadyNotifiedOnRequiredFeature(user string, feature model.MattermostPaidFeature) bool {
	data, err := a.Srv().Store.NotifyAdmin().GetDataByUserIdAndFeature(user, feature)
	if err != nil {
		return false
	}
	if len(data) > 0 {
		return true // if we find data, it means this user already notified on the need for this feature
	}

	return false
}

func (a *App) CanNotifyAdmin(trial bool) bool {
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

	coolOffPeriodDaysEnv := os.Getenv("MM_NOTIFY_ADMIN_COOL_OFF_DAYS")
	coolOffPeriodDays, parseError := strconv.ParseFloat(coolOffPeriodDaysEnv, 64)
	if parseError != nil {
		coolOffPeriodDays = defaultNotifyAdminCoolOffDays
	}
	daysToMillis := coolOffPeriodDays * 24 * 60 * 60 * 1000
	timeDiff := model.GetMillis() - int64(lastNotificationTimestamp)
	return timeDiff >= int64(daysToMillis)
}

func (a *App) FinishSendAdminNotifyPost(trial bool, now int64) {
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
	if err := a.Srv().Store.NotifyAdmin().DeleteBefore(trial, now); err != nil {
		mlog.Error("Unable to finish send admin notify post job", mlog.Err(err))
	}

}

func (a *App) groupNotifyAdminByUser(data []*model.NotifyAdminData) map[string][]*model.NotifyAdminData {
	myMap := make(map[string][]*model.NotifyAdminData)
	for _, d := range data {
		myMap[d.UserId] = append(myMap[d.UserId], d)
	}

	return myMap
}

func (a *App) groupNotifyAdminByFeature(data []*model.NotifyAdminData) map[model.MattermostPaidFeature][]*model.NotifyAdminData {
	myMap := make(map[model.MattermostPaidFeature][]*model.NotifyAdminData)
	for _, d := range data {
		myMap[d.RequiredFeature] = append(myMap[d.RequiredFeature], d)
	}

	return myMap
}
