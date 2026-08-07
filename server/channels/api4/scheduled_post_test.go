// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestUpdateScheduledPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(createdScheduledPost.Id)
		require.NoError(t, err)
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, fetchedPost.RepeatType)
		require.Equal(t, "America/New_York", fetchedPost.RepeatTimezone)
	})

	t.Run("should preserve recurrence when the update omits the repeat fields", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "weekly recurring scheduled post",
			},
			ScheduledAt:    model.GetMillis() + 100000,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "America/New_York",
		}
		createdScheduledPost, _, err := th.Client.CreateScheduledPost(context.Background(), scheduledPost)
		require.NoError(t, err)
		require.NotNil(t, createdScheduledPost)

		// Clients that predate recurring scheduled posts leave the repeat fields out of their
		// update payloads. Marshalling a model.ScheduledPost always emits them, so the payload
		// has to be built by hand to reproduce what those clients send.
		payload := fmt.Sprintf(
			`{"id":"%s","create_at":%d,"user_id":"%s","channel_id":"%s","message":"rescheduled by an old client","scheduled_at":%d}`,
			createdScheduledPost.Id,
			createdScheduledPost.CreateAt,
			th.BasicUser.Id,
			th.BasicChannel.Id,
			model.GetMillis()+300000,
		)

		httpResp, err := th.Client.DoAPIPut(context.Background(), "/posts/schedule/"+createdScheduledPost.Id, payload)
		require.NoError(t, err)
		require.Equal(t, http.StatusCreated, httpResp.StatusCode)

		var updatedScheduledPost model.ScheduledPost
		require.NoError(t, json.NewDecoder(httpResp.Body).Decode(&updatedScheduledPost))
		require.NoError(t, httpResp.Body.Close())
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, updatedScheduledPost.RepeatType)
		require.Equal(t, "America/New_York", updatedScheduledPost.RepeatTimezone)

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(createdScheduledPost.Id)
		require.NoError(t, err)
		require.Equal(t, "rescheduled by an old client", fetchedPost.Message)
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, fetchedPost.RepeatType)
		require.Equal(t, "America/New_York", fetchedPost.RepeatTimezone)
	})

	t.Run("should stop recurrence when the update sends empty repeat fields", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "weekly recurring scheduled post",
			},
			ScheduledAt:    model.GetMillis() + 100000,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "America/New_York",
		}
		createdScheduledPost, _, err := th.Client.CreateScheduledPost(context.Background(), scheduledPost)
		require.NoError(t, err)
		require.NotNil(t, createdScheduledPost)

		createdScheduledPost.RepeatType = model.ScheduledPostRepeatTypeNone
		createdScheduledPost.RepeatTimezone = ""

		updatedScheduledPost, _, err := th.Client.UpdateScheduledPost(context.Background(), createdScheduledPost)
		require.NoError(t, err)
		require.NotNil(t, updatedScheduledPost)
		require.Empty(t, updatedScheduledPost.RepeatType)
		require.Empty(t, updatedScheduledPost.RepeatTimezone)

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(createdScheduledPost.Id)
		require.NoError(t, err)
		require.Empty(t, fetchedPost.RepeatType)
		require.Empty(t, fetchedPost.RepeatTimezone)
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
	th := Setup(t).InitBasic(t)

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
