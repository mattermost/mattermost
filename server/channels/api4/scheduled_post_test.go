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
}

// The scheduled-post job never re-checks file uploads when it sends the post,
// so scheduling and updating are where the upload_file_attachment policy applies.
func TestScheduledPostUploadFileAttachmentABACEnforcement(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupUploadFileAttachmentABAC(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	newScheduledPost := func(fileIDs ...string) *model.ScheduledPost {
		return &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
				FileIds:   fileIDs,
			},
			ScheduledAt: model.GetMillis() + 100000,
		}
	}

	t.Run("create with files is rejected when the policy denies the upload action", func(t *testing.T) {
		fileID := uploadUnattachedFile(t, th, th.BasicChannel.Id)
		mockUploadFileAttachmentPolicy(t, th, th.BasicChannel.Id)

		created, resp, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(fileID))
		require.Error(t, err)
		require.Nil(t, created)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, uploadFileAttachmentDeniedErrorID)
	})

	t.Run("create with files succeeds when the policy allows the upload action", func(t *testing.T) {
		fileID := uploadUnattachedFile(t, th, th.BasicChannel.Id)
		mockUploadFileAttachmentPolicy(t, th)

		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(fileID))
		require.NoError(t, err)
		require.Equal(t, model.StringArray{fileID}, created.FileIds)
	})

	t.Run("create without files is unaffected by the policy", func(t *testing.T) {
		mockUploadFileAttachmentPolicy(t, th, th.BasicChannel.Id)

		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost())
		require.NoError(t, err)
		require.NotNil(t, created)
	})

	t.Run("create with files is unaffected when ABAC is disabled", func(t *testing.T) {
		fileID := uploadUnattachedFile(t, th, th.BasicChannel.Id)
		mockUploadFileAttachmentPolicy(t, th, th.BasicChannel.Id)
		disableABACForTest(t, th)

		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(fileID))
		require.NoError(t, err)
		require.NotNil(t, created)
	})

	t.Run("update adding a file is rejected when the policy denies the upload action", func(t *testing.T) {
		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost())
		require.NoError(t, err)
		fileID := uploadUnattachedFile(t, th, th.BasicChannel.Id)
		mockUploadFileAttachmentPolicy(t, th, th.BasicChannel.Id)

		created.FileIds = model.StringArray{fileID}
		updated, resp, err := th.Client.UpdateScheduledPost(context.Background(), created)
		require.Error(t, err)
		require.Nil(t, updated)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, uploadFileAttachmentDeniedErrorID)

		stored, storeErr := th.App.Srv().Store().ScheduledPost().Get(created.Id)
		require.NoError(t, storeErr)
		require.Empty(t, stored.FileIds)
	})

	t.Run("update keeping the same files is allowed when the policy denies the upload action", func(t *testing.T) {
		fileID := uploadUnattachedFile(t, th, th.BasicChannel.Id)
		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(fileID))
		require.NoError(t, err)
		mockUploadFileAttachmentPolicy(t, th, th.BasicChannel.Id)

		created.Message = "edited message"
		updated, _, err := th.Client.UpdateScheduledPost(context.Background(), created)
		require.NoError(t, err)
		require.Equal(t, "edited message", updated.Message)
		require.Equal(t, model.StringArray{fileID}, updated.FileIds)
	})
}
