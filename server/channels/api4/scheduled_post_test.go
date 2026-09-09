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

	t.Run("system post types", func(t *testing.T) {
		testCases := []struct {
			name     string
			postType string
			rejected bool
		}{
			{
				name:     "generic system post type",
				postType: model.PostTypeSystemGeneric,
				rejected: true,
			},
			{
				name:     "structured system post type",
				postType: model.PostTypeAddToTeam,
				rejected: true,
			},
			{
				name:     "default post type",
				postType: model.PostTypeDefault,
				rejected: false,
			},
			{
				name:     "attachment post type",
				postType: model.PostTypeMessageAttachment,
				rejected: false,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				scheduledPost := &model.ScheduledPost{
					Draft: model.Draft{
						CreateAt:  model.GetMillis(),
						UserId:    th.BasicUser.Id,
						ChannelId: th.BasicChannel.Id,
						Message:   "this is a scheduled post",
					},
					ScheduledAt: model.GetMillis() + 100000,
				}
				created, _, err := th.Client.CreateScheduledPost(context.Background(), scheduledPost)
				require.NoError(t, err)
				require.NotNil(t, created)

				created.Type = testCase.postType
				created.ScheduledAt = model.GetMillis() + 200000

				updated, resp, err := th.Client.UpdateScheduledPost(context.Background(), created)

				if !testCase.rejected {
					require.NoError(t, err)
					require.NotNil(t, updated)
					return
				}

				require.Error(t, err)
				CheckBadRequestStatus(t, resp)

				fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(created.Id)
				require.NoError(t, storeErr)
				require.NotEqual(t, testCase.postType, fetched.Type, "a scheduled post must not keep a reserved system post type")
			})
		}
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
				Name: model.NewPointer(model.PermissionCreatePost.Id),
				Roles: &model.ChannelModeratedRolesPatch{
					Guests:  model.NewPointer(true),
					Members: model.NewPointer(false),
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

	t.Run("system post types", func(t *testing.T) {
		testCases := []struct {
			name     string
			postType string
			rejected bool
		}{
			{
				name:     "generic system post type",
				postType: model.PostTypeSystemGeneric,
				rejected: true,
			},
			{
				name:     "structured system post type",
				postType: model.PostTypeAddToTeam,
				rejected: true,
			},
			{
				name:     "default post type",
				postType: model.PostTypeDefault,
				rejected: false,
			},
			{
				name:     "attachment post type",
				postType: model.PostTypeMessageAttachment,
				rejected: false,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				scheduledPost := &model.ScheduledPost{
					Draft: model.Draft{
						CreateAt:  model.GetMillis(),
						UserId:    th.BasicUser.Id,
						ChannelId: th.BasicChannel.Id,
						Message:   "scheduled post of type " + testCase.postType,
						Type:      testCase.postType,
					},
					ScheduledAt: model.GetMillis() + 100000,
				}

				created, resp, err := client.CreateScheduledPost(context.Background(), scheduledPost)

				if !testCase.rejected {
					require.NoError(t, err)
					require.NotNil(t, created)
					require.Equal(t, testCase.postType, created.Type)

					fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(created.Id)
					require.NoError(t, storeErr)
					require.Equal(t, testCase.postType, fetched.Type)
					return
				}

				require.Error(t, err)
				CheckBadRequestStatus(t, resp)
				require.Nil(t, created)

				storedScheduledPosts, storeErr := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicTeam.Id)
				require.NoError(t, storeErr)
				for _, storedScheduledPost := range storedScheduledPosts {
					require.NotEqual(t, scheduledPost.Message, storedScheduledPost.Message, "a rejected scheduled post must not be stored")
				}
			})
		}
	})
}
