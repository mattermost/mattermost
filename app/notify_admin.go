// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

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

func (a *App) SendNotifyAdminPosts(c *request.Context) {
	// team, _ := a.GetTeam(currentUserTeamID)
	// if appErr != nil {
	// 	return appErr
	// }

	sysadmins, _ := a.GetUsersFromProfiles(&model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SystemAdminRoleId,
		Inactive: false,
	})

	// if appErr != nil {
	// 	return appErr
	// }

	systemBot, _ := a.GetSystemBot()
	// if appErr != nil {
	// 	return appErr
	// }

	fla := a.UserBasedFlatten()
	feaFla := a.FeatureBasedFlatten()
	props := make(model.StringInterface)

	for _, admin := range sysadmins {
		// T := i18n.GetUserTranslations(admin.Locale)
		channel, appErr := a.GetOrCreateDirectChannel(c, systemBot.UserId, admin.Id)
		if appErr != nil {
			mlog.Warn("Error getting direct channel", mlog.Err(appErr))
			continue
		}

		post := &model.Post{
			Message:   fmt.Sprintf("%d members of the Acme workspace have requested a workspace upgrade for: ", len(fla)),
			UserId:    systemBot.UserId,
			ChannelId: channel.Id,
			Type:      fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), // webapp will have to create renderer for this custom post type

		}

		// props["total_users"] = len(fla)
		props["requested_features"] = feaFla
		post.SetProps(props)

		_, appErr = a.CreatePost(c, post, channel, false, true)
		if appErr != nil {
			mlog.Warn("Error creating post", mlog.Err(appErr))
			continue
		}
	}
}

func (a *App) UserBasedFlatten() map[string][]*model.NotifyAdminData {
	myMapp := make(map[string][]*model.NotifyAdminData)
	zData := a.ZZZDATA()
	for _, d := range zData {
		myMapp[d.UserId] = append(myMapp[d.UserId], d)
	}

	return myMapp
}

func (a *App) FeatureBasedFlatten() map[string][]*model.NotifyAdminData {
	myMapp := make(map[string][]*model.NotifyAdminData)
	zData := a.ZZZDATA()
	for _, d := range zData {
		myMapp[d.RequiredFeature] = append(myMapp[d.RequiredFeature], d)
	}

	return myMapp
}

func (a *App) ZZZDATA() []*model.NotifyAdminData {
	d := []*model.NotifyAdminData{
		&model.NotifyAdminData{
			Id:              "test_id1",
			UserId:          "userid1",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Guest Accounts",
		},
		&model.NotifyAdminData{
			Id:              "test_id2",
			UserId:          "userid2",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Guest Accounts",
		},
		&model.NotifyAdminData{
			Id:              "test_id3",
			UserId:          "userid3",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Guest Accounts",
		},
		&model.NotifyAdminData{
			Id:              "test_id4",
			UserId:          "userid4",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Guest Accounts",
		},
		&model.NotifyAdminData{
			Id:              "test_id5",
			UserId:          "userid5",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Guest Accounts",
		},
		&model.NotifyAdminData{
			Id:              "test_id6",
			UserId:          "userid6",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Create Multiple Teams",
		},
		&model.NotifyAdminData{
			Id:              "test_id7",
			UserId:          "userid7",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Create Multiple Teams",
		},
		&model.NotifyAdminData{
			Id:              "test_id8",
			UserId:          "userid8",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Create Multiple Teams",
		},
		&model.NotifyAdminData{
			Id:              "test_id9",
			UserId:          "userid9",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "All",
		},
		&model.NotifyAdminData{
			Id:              "test_id10",
			UserId:          "userid10",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "All",
		},
		&model.NotifyAdminData{
			Id:              "test_id11",
			UserId:          "userid1",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Create Multiple Teams",
		},
		&model.NotifyAdminData{
			Id:              "test_id12",
			UserId:          "userid8",
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "All",
		},
	}

	return d
}
