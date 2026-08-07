// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestUpdateScheduledPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.RecurringScheduledPosts = true
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	t.Run("should not allow updating a scheduled post not belonging to the user", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000,
		}
		createdScheduledPost, _, err := th.Client.CreateScheduledPost(context.Background(), scheduledPost)
		require.NoError(t, err)
		require.NotNil(t, createdScheduledPost)

		originalMessage := createdScheduledPost.Message
		originalScheduledAt := createdScheduledPost.ScheduledAt

		createdScheduledPost.ScheduledAt = model.GetMillis() + 9999999
		createdScheduledPost.Message = "Updated Message!!!"

		// Switch to BasicUser2
		th.LoginBasic2(t)

		_, resp, err := th.Client.UpdateScheduledPost(context.Background(), createdScheduledPost)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Switch back to original user and verify the post wasn't modified
		th.LoginBasic(t)

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(createdScheduledPost.Id)
		require.NoError(t, err)
		require.NotNil(t, fetchedPost)
		require.Equal(t, originalMessage, fetchedPost.Message)
		require.Equal(t, originalScheduledAt, fetchedPost.ScheduledAt)
	})

	t.Run("should clear error state when rescheduling an existing scheduled post", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "weekly recurring scheduled post",
			},
			ScheduledAt:    model.GetMillis() + 100000,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "UTC",
		}
		createdScheduledPost, _, err := th.Client.CreateScheduledPost(context.Background(), scheduledPost)
		require.NoError(t, err)
		require.NotNil(t, createdScheduledPost)

		createdScheduledPost.ErrorCode = model.ScheduledPostErrorUnableToSend
		createdScheduledPost.ProcessedAt = model.GetMillis()
		require.NoError(t, th.App.Srv().Store().ScheduledPost().UpdatedScheduledPost(createdScheduledPost))

		createdScheduledPost.ScheduledAt = model.GetMillis() + 300000
		createdScheduledPost.RepeatTimezone = "America/New_York"

		updatedScheduledPost, _, err := th.Client.UpdateScheduledPost(context.Background(), createdScheduledPost)
		require.NoError(t, err)
		require.NotNil(t, updatedScheduledPost)
		require.Empty(t, updatedScheduledPost.ErrorCode)
		require.Zero(t, updatedScheduledPost.ProcessedAt)
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, updatedScheduledPost.RepeatType)
		require.Equal(t, "America/New_York", updatedScheduledPost.RepeatTimezone)
	})
}

func TestDeleteScheduledPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	t.Run("should not allow deleting a scheduled post not belonging to the user", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000,
		}
		createdScheduledPost, _, err := th.Client.CreateScheduledPost(context.Background(), scheduledPost)
		require.NoError(t, err)
		require.NotNil(t, createdScheduledPost)

		// Switch to BasicUser2
		th.LoginBasic2(t)

		_, resp, err := th.Client.DeleteScheduledPost(context.Background(), createdScheduledPost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Switch back to original user and verify the post wasn't deleted
		th.LoginBasic(t)

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(createdScheduledPost.Id)
		require.NoError(t, err)
		require.NotNil(t, fetchedPost)
		require.Equal(t, createdScheduledPost.Id, fetchedPost.Id)
		require.Equal(t, createdScheduledPost.Message, fetchedPost.Message)
	})
}

func TestCreateScheduledPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.RecurringScheduledPosts = true
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	client := th.Client

	t.Run("base case", func(t *testing.T) {
		userId := model.NewId()

		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, _, err := client.CreateScheduledPost(context.Background(), scheduledPost)
		require.NoError(t, err)
		require.NotNil(t, createdScheduledPost)
	})

	t.Run("should not allow created scheduled post in read-only channel", func(t *testing.T) {
		channel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser, channel)

		channelModerationPatches := []*model.ChannelModerationPatch{
			{
				Name: new(model.PermissionCreatePost.Id),
				Roles: &model.ChannelModeratedRolesPatch{
					Guests:  new(true),
					Members: new(false),
				},
			},
		}

		err := th.App.SetPhase2PermissionsMigrationStatus(true)
		require.NoError(t, err)

		_, appErr := th.App.PatchChannelModerationsForChannel(th.Context, channel, channelModerationPatches)
		require.Nil(t, appErr)

		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: channel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, _, httpErr := client.CreateScheduledPost(context.Background(), scheduledPost)
		require.Error(t, httpErr)
		require.Contains(t, httpErr.Error(), "You do not have the appropriate permissions.")
		require.Nil(t, createdScheduledPost)
	})

	t.Run("weekly recurring persists repeat fields", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "weekly message",
			},
			ScheduledAt:    model.GetMillis() + 100000,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "America/New_York",
		}
		created, _, err := client.CreateScheduledPost(context.Background(), scheduledPost)
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, created.RepeatType)
		require.Equal(t, "America/New_York", created.RepeatTimezone)
	})
}

func TestScheduledPostRecurringFeatureFlag(t *testing.T) {
	mainHelper.Parallel(t)
	// SetupConfig also makes feature flags writable, so the subtests below can toggle the flag.
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.RecurringScheduledPosts = false
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	setFlag := func(t *testing.T, enabled bool) {
		t.Helper()
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.RecurringScheduledPosts = enabled
		})
	}

	newScheduledPost := func(repeatType string) *model.ScheduledPost {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "recurring feature flag scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000,
			RepeatType:  repeatType,
		}
		if repeatType == model.ScheduledPostRepeatTypeWeekly {
			scheduledPost.RepeatTimezone = "UTC"
		}
		return scheduledPost
	}

	t.Run("creating a recurring scheduled post is rejected when the flag is off", func(t *testing.T) {
		setFlag(t, false)

		created, resp, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(model.ScheduledPostRepeatTypeWeekly))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.scheduled_post.recurring_disabled.app_error")
		require.Nil(t, created)
	})

	t.Run("creating a one-shot scheduled post is still allowed when the flag is off", func(t *testing.T) {
		setFlag(t, false)

		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(model.ScheduledPostRepeatTypeNone))
		require.NoError(t, err)
		require.NotNil(t, created)
	})

	t.Run("creating a recurring scheduled post succeeds when the flag is on", func(t *testing.T) {
		setFlag(t, true)

		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(model.ScheduledPostRepeatTypeWeekly))
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, created.RepeatType)
	})

	t.Run("converting a recurring scheduled post to one-shot is allowed when the flag is off", func(t *testing.T) {
		setFlag(t, true)
		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(model.ScheduledPostRepeatTypeWeekly))
		require.NoError(t, err)

		setFlag(t, false)
		created.RepeatType = model.ScheduledPostRepeatTypeNone
		created.RepeatTimezone = ""

		updated, _, err := th.Client.UpdateScheduledPost(context.Background(), created)
		require.NoError(t, err)
		require.Equal(t, model.ScheduledPostRepeatTypeNone, updated.RepeatType)
	})

	t.Run("converting a one-shot scheduled post to recurring is rejected when the flag is off", func(t *testing.T) {
		setFlag(t, false)
		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(model.ScheduledPostRepeatTypeNone))
		require.NoError(t, err)

		created.RepeatType = model.ScheduledPostRepeatTypeWeekly
		created.RepeatTimezone = "UTC"

		_, resp, err := th.Client.UpdateScheduledPost(context.Background(), created)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.scheduled_post.recurring_disabled.app_error")

		fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(created.Id)
		require.NoError(t, storeErr)
		require.Equal(t, model.ScheduledPostRepeatTypeNone, fetched.RepeatType)
	})
}
