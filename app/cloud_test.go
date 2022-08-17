package app

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func Test_SendNotifyAdminPosts(t *testing.T) {
	cloud := mocks.CloudInterface{}
	cloud.Mock.On("GetSubscription", mock.Anything).Return(&model.Subscription{DNS: "test.dns.server"}, nil)

	t.Run("error sending upgrade post when do notifications are available", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
		err := th.App.SendNotifyAdminPosts(ctx, false)
		require.Equal(t, err.Error(), "SendNotifyAdminPosts: Unable to send notification post., No notification data available")
		require.NotNil(t, err)
	})

	t.Run("error sending trial post when do notifications are available", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
		err := th.App.SendNotifyAdminPosts(ctx, true)
		require.Equal(t, err.Error(), "SendNotifyAdminPosts: Unable to send notification post., No notification data available")
		require.NotNil(t, err)
	})

	t.Run("successfully send upgrade notification", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		// some some notifications
		requestedData, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "All Professional features",
		})
		require.Nil(t, appErr)

		ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
		appErr = th.App.SendNotifyAdminPosts(ctx, false)
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
			channel, err = th.App.Srv().Store.Channel().GetByName("", model.GetDMNameFromIds(bot.UserId, th.SystemAdminUser.Id), false)
			if err == nil && channel != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		require.NoError(t, err, "Expected message to have been sent within %d seconds", timeout)

		postList, err := th.App.Srv().Store.Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 1}, false, map[string]bool{})
		require.NoError(t, err)

		require.Equal(t, len(postList.Order), 1)
		post := postList.Posts[postList.Order[0]]
		require.Equal(t, fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), post.Type)
		require.Equal(t, bot.UserId, post.UserId)
		require.Equal(t, "1 member of the test workspace has requested a workspace upgrade for: ", post.Message)

		flattenedData := th.App.FeatureBasedFlatten([]*model.NotifyAdminData{
			requestedData,
		})

		props := make(model.StringInterface)
		props["requested_features"] = flattenedData

		postProps := post.GetProps()
		require.Equal(t, postProps["trial"], false)
		require.Equal(t, props["requested_features"], props["requested_features"])
	})

	t.Run("successfully send trial notification", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		// some some notifications
		requestedData, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "All Professional features",
			Trial:           true,
		})
		require.Nil(t, appErr)

		ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
		appErr = th.App.SendNotifyAdminPosts(ctx, true)
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
			channel, err = th.App.Srv().Store.Channel().GetByName("", model.GetDMNameFromIds(bot.UserId, th.SystemAdminUser.Id), false)
			if err == nil && channel != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		require.NoError(t, err, "Expected message to have been sent within %d seconds", timeout)

		postList, err := th.App.Srv().Store.Post().GetPosts(model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 1}, false, map[string]bool{})
		require.NoError(t, err)

		require.Equal(t, len(postList.Order), 1)
		post := postList.Posts[postList.Order[0]]
		require.Equal(t, fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), post.Type)
		require.Equal(t, bot.UserId, post.UserId)
		require.Equal(t, "1 member of the test workspace has requested starting the Enterprise trial for access to: ", post.Message)

		flattenedData := th.App.FeatureBasedFlatten([]*model.NotifyAdminData{
			requestedData,
		})

		props := make(model.StringInterface)
		props["requested_features"] = flattenedData

		postProps := post.GetProps()
		require.Equal(t, postProps["trial"], true)
		require.Equal(t, props["requested_features"], props["requested_features"])
	})

	t.Run("error when trying to send post before end of cool off period", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		// some some notifications
		_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "All Professional features",
		})
		require.Nil(t, appErr)

		ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
		appErr = th.App.SendNotifyAdminPosts(ctx, false)
		require.Nil(t, appErr)

		// add some more notifications while in cool off
		_, appErr = th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Custom User groups",
		})
		require.Nil(t, appErr)

		// second time trying to notify is forbidden
		appErr = th.App.SendNotifyAdminPosts(ctx, false)
		require.NotNil(t, appErr)
		require.Equal(t, appErr.Error(), "SendNotifyAdminPosts: Unable to send notification post., Cannot notify yet")
	})

	t.Run("can send post at the end of cool off period", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		os.Setenv("MM_CLOUD_NOTIFY_ADMIN_COOL_OFF_DAYS", "0.00003472222222") // set to 3 seconds
		defer os.Unsetenv("MM_CLOUD_NOTIFY_ADMIN_COOL_OFF_DAYS")

		// some some notifications
		_, appErr := th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "All Professional features",
		})
		require.Nil(t, appErr)

		ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
		appErr = th.App.SendNotifyAdminPosts(ctx, false)
		require.Nil(t, appErr)

		// add some more notifications while in cool off
		_, appErr = th.App.SaveAdminNotifyData(&model.NotifyAdminData{
			UserId:          th.BasicUser.Id,
			RequiredPlan:    "cloud-professional",
			RequiredFeature: "Custom User groups",
		})
		require.Nil(t, appErr)

		time.Sleep(5 * time.Second)

		// no error sending second time
		appErr = th.App.SendNotifyAdminPosts(ctx, false)
		require.Nil(t, appErr)
	})
}
