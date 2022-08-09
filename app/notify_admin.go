// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const lastTrialNotificationTimeStamp = "LAST_TRIAL_NOTIFICATION_TIMESTAMP"
const lastUpgradeNotificationTimeStamp = "LAST_UPGRADE_NOTIFICATION_TIMESTAMP"

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
	systemVarName := lastUpgradeNotificationTimeStamp
	if trial {
		systemVarName = lastTrialNotificationTimeStamp
	}

	sysVal, sysValErr := a.Srv().Store.System().GetByName(systemVarName)
	if sysValErr == nil && sysVal != nil { // better handle error
		timeStamp, _ := strconv.ParseFloat(sysVal.Value, 64)
		if !model.CanNotify(int64(timeStamp)) {
			return model.NewAppError("", "", nil, "", http.StatusForbidden)
		}
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
		return model.NewAppError("", "", nil, "", http.StatusInternalServerError)
	}

	userBasedData := a.UserBasedFlatten(data)
	featureBasedData := a.FeatureBasedFlatten(data)
	props := make(model.StringInterface)

	for _, admin := range sysadmins {
		// T := i18n.GetUserTranslations(admin.Locale)
		channel, appErr := a.GetOrCreateDirectChannel(c, systemBot.UserId, admin.Id)
		if appErr != nil {
			mlog.Warn("Error getting direct channel", mlog.Err(appErr))
			continue
		}

		message := fmt.Sprintf("%d members of the Acme workspace have requested a workspace upgrade for: ", len(userBasedData))
		if trial {
			message = fmt.Sprintf("%d members of the Acme workspace have requested starting the Enterprise trial for access to: ", len(userBasedData))
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

	a.Srv().Store.NotifyAdmin().DeleteAll(trial)

	return nil
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

func (a *App) GetNotifyAdminData(trial bool) ([]*model.NotifyAdminData, *model.AppError) {
	data, err := a.Srv().Store.NotifyAdmin().Get(trial)
	if err != nil {
		return nil, model.NewAppError("", "", nil, "", http.StatusInternalServerError)
	}

	return data, nil
}

// func (a *App) ZZZDATA() []*model.NotifyAdminData {
// 	d := []*model.NotifyAdminData{
// 		&model.NotifyAdminData{
// 			Id:              "test_id1",
// 			UserId:          "8mcagrxjitnetpczgp5xk94taw",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Guest Accounts",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id2",
// 			UserId:          "tgaqxj4nybr4zbh8q7q4mht8ta",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Guest Accounts",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id3",
// 			UserId:          "4m6ynd1zy3ys7crs1a8io15emc",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Guest Accounts",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id4",
// 			UserId:          "s6apf9muhtft5b1dfm6773ak6a",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Guest Accounts",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id5",
// 			UserId:          "yh4gx8tp9brzpj8p9hz67ekabe",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Guest Accounts",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id6",
// 			UserId:          "userid6",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Create Multiple Teams",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id7",
// 			UserId:          "userid7",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Create Multiple Teams",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id8",
// 			UserId:          "userid8",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Create Multiple Teams",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id9",
// 			UserId:          "8mcagrxjitnetpczgp5xk94taw",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "All Professional features",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id10",
// 			UserId:          "4chdbexzniywxbggceyx7sprko",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "All Professional features",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id11",
// 			UserId:          "userid1",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "Create Multiple Teams",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id12",
// 			UserId:          "userid8",
// 			RequiredPlan:    "cloud-professional",
// 			RequiredFeature: "All Professional features",
// 		},
// 		&model.NotifyAdminData{
// 			Id:              "test_id13",
// 			UserId:          "8mcagrxjitnetpczgp5xk94taw",
// 			RequiredPlan:    "cloud-enterprise",
// 			RequiredFeature: "Custom user groups",
// 		},
// 	}

// 	return d
// }
