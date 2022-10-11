// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func Test_SendNotifyAdminPosts(t *testing.T) {

	t.Run("no error sending upgrade post when no notifications are available", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		err := th.App.SendNotifyAdminPosts(th.Context, "", "", false)
		require.Nil(t, err)
	})

	t.Run("no error sending trial post when do notifications are available", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		err := th.App.SendNotifyAdminPosts(th.Context, "", "", true)
		require.Nil(t, err)
	})

	t.Run("successfully send upgrade notification", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		// some some notifications
		_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureGuestAccounts,
		})
		require.Nil(t, appErr)

		_, appErr = th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser2.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureGuestAccounts,
		})
		require.Nil(t, appErr)

		appErr = th.App.SendNotifyAdminPosts(th.Context, "test", "", false)
		require.Nil(t, appErr)

		bot, appErr := th.App.GetSystemBot()
		require.Nil(t, appErr)

		// message sending is async, wait time for it
		var channel *model.Channel
		var err error
		var timeout = 5 * time.Second
		begin := time.Now()
		for {
			if time.Since(begin) > timeout {
				break
			}
			channel, err = th.App.Srv().Store().Channel().GetByName("", model.GetDMNameFromIds(bot.UserId, th.SystemAdminUser.Id), false)
			if err == nil && channel != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		require.NoError(t, err, "Expected message to have been sent within %d seconds", timeout)

		postList, err := th.App.Srv().Store().Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 1}, false, map[string]bool{})
		require.NoError(t, err)

		post := postList.Posts[postList.Order[0]]
		require.Equal(t, fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), post.Type)
		require.Equal(t, bot.UserId, post.UserId)
		require.Equal(t, "2 members of the test workspace have requested a workspace upgrade for: ", post.Message)
	})

	t.Run("successfully send trial notification", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		// some some notifications
		_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
			Trial:           true,
		})
		require.Nil(t, appErr)

		appErr = th.App.SendNotifyAdminPosts(th.Context, "test", "", true)
		require.Nil(t, appErr)

		bot, appErr := th.App.GetSystemBot()
		require.Nil(t, appErr)

		// message sending is async, wait time for it
		var channel *model.Channel
		var err error
		var timeout = 5 * time.Second
		begin := time.Now()
		for {
			if time.Since(begin) > timeout {
				break
			}
			channel, err = th.App.Srv().Store().Channel().GetByName("", model.GetDMNameFromIds(bot.UserId, th.SystemAdminUser.Id), false)
			if err == nil && channel != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		require.NoError(t, err, "Expected message to have been sent within %d seconds", timeout)

		postList, err := th.App.Srv().Store().Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 1}, false, map[string]bool{})
		require.NoError(t, err)

		post := postList.Posts[postList.Order[0]]
		require.Equal(t, fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), post.Type)
		require.Equal(t, bot.UserId, post.UserId)
		require.Equal(t, "1 member of the test workspace has requested starting the Enterprise trial for access to: ", post.Message)
	})

	t.Run("error when trying to send post before end of cool off period", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		// some some notifications
		_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
		})
		require.Nil(t, appErr)

		appErr = th.App.SendNotifyAdminPosts(th.Context, "", "", false)
		require.Nil(t, appErr)

		// add some more notifications while in cool off
		_, appErr = th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureCustomUsergroups,
		})
		require.Nil(t, appErr)

		// second time trying to notify is forbidden
		appErr = th.App.SendNotifyAdminPosts(th.Context, "", "", false)
		require.NotNil(t, appErr)
		require.Equal(t, appErr.Error(), "SendNotifyAdminPosts: Unable to send notification post., Cannot notify yet")
	})

	t.Run("can send post at the end of cool off period", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		os.Setenv("MM_NOTIFY_ADMIN_COOL_OFF_DAYS", "0.00003472222222") // set to 3 seconds
		defer os.Unsetenv("MM_NOTIFY_ADMIN_COOL_OFF_DAYS")

		// some some notifications
		_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
		})
		require.Nil(t, appErr)

		appErr = th.App.SendNotifyAdminPosts(th.Context, "", "", false)
		require.Nil(t, appErr)

		// add some more notifications while in cool off
		_, appErr = th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureCustomUsergroups,
		})
		require.Nil(t, appErr)

		time.Sleep(5 * time.Second)

		// no error sending second time
		appErr = th.App.SendNotifyAdminPosts(th.Context, "", "", false)
		require.Nil(t, appErr)
	})

	t.Run("can filter notifications when plan changes within cool off period", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		// some some notifications
		_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
			Trial:           false,
		})
		require.Nil(t, appErr)

		_, appErr = th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser2.Id,
			RequiredPlan:    model.LicenseShortSkuEnterprise,
			RequiredFeature: model.PaidFeatureAllEnterprisefeatures,
			Trial:           false,
		})
		require.Nil(t, appErr)

		appErr = th.App.SendNotifyAdminPosts(th.Context, "test", model.LicenseShortSkuProfessional, false) // try and send notification but workspace currentSKU has since changed to cloud-professional
		require.Nil(t, appErr)

		bot, appErr := th.App.GetSystemBot()
		require.Nil(t, appErr)

		// message sending is async, wait time for it
		var channel *model.Channel
		var err error
		var timeout = 5 * time.Second
		begin := time.Now()
		for {
			if time.Since(begin) > timeout {
				break
			}
			channel, err = th.App.Srv().Store().Channel().GetByName("", model.GetDMNameFromIds(bot.UserId, th.SystemAdminUser.Id), false)
			if err == nil && channel != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		require.NoError(t, err, "Expected message to have been sent within %d seconds", timeout)

		postList, err := th.App.Srv().Store().Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 1}, false, map[string]bool{})
		require.NoError(t, err)

		post := postList.Posts[postList.Order[0]]
		require.Equal(t, fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), post.Type)
		require.Equal(t, bot.UserId, post.UserId)
		require.Equal(t, "1 member of the test workspace has requested a workspace upgrade for: ", post.Message) // expect only one member's notification even though 2 were added
	})
}
