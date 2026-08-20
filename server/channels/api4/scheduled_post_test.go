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

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(th.Context, createdScheduledPost.Id)
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
		require.NoError(t, th.App.Srv().Store().ScheduledPost().UpdatedScheduledPost(th.Context, createdScheduledPost))

		createdScheduledPost.ScheduledAt = model.GetMillis() + 300000
		createdScheduledPost.RepeatTimezone = "America/New_York"

		updatedScheduledPost, _, err := th.Client.UpdateScheduledPost(context.Background(), createdScheduledPost)
		require.NoError(t, err)
		require.NotNil(t, updatedScheduledPost)
		require.Empty(t, updatedScheduledPost.ErrorCode)
		require.Zero(t, updatedScheduledPost.ProcessedAt)
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, updatedScheduledPost.RepeatType)
		require.Equal(t, "America/New_York", updatedScheduledPost.RepeatTimezone)

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(th.Context, createdScheduledPost.Id)
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

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(th.Context, createdScheduledPost.Id)
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

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(th.Context, createdScheduledPost.Id)
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

		fetchedPost, err := th.App.Srv().Store().ScheduledPost().Get(th.Context, createdScheduledPost.Id)
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

	t.Run("weekly recurring rejects file attachments", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "weekly message with a file",
				FileIds:   model.StringArray{model.NewId()},
			},
			ScheduledAt:    model.GetMillis() + 100000,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "America/New_York",
		}
		created, resp, err := client.CreateScheduledPost(context.Background(), scheduledPost)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Nil(t, created)
	})
}

func TestCreateScheduledPostWithSystemPostType(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

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

			created, resp, err := th.Client.CreateScheduledPost(context.Background(), scheduledPost)

			if !testCase.rejected {
				require.NoError(t, err)
				require.NotNil(t, created)
				return
			}

			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
			require.Nil(t, created)

			storedScheduledPosts, storeErr := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
			require.NoError(t, storeErr)
			for _, storedScheduledPost := range storedScheduledPosts {
				require.NotEqual(t, testCase.postType, storedScheduledPost.Type, "a scheduled post with a reserved system post type must not be stored")
			}
		})
	}
}

func TestUpdateScheduledPostWithSystemPostType(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

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

			fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(th.Context, created.Id)
			require.NoError(t, storeErr)
			require.NotEqual(t, testCase.postType, fetched.Type, "a scheduled post must not keep a reserved system post type")
		})
	}
}

// A stored scheduled post can carry a post type reserved for system messages if the row predates
// the intake check or was written by something other than the API. Updating such a row restores
// the stored type after the request has been validated and clears the error code, re-arming it —
// so what keeps it out of the channel is the check on the publication path, not intake.
func TestUpdateScheduledPostWithStoredSystemPostTypeIsNotPublished(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	message := "scheduled post stored with a reserved system post type"

	stored, storeErr := th.App.Srv().Store().ScheduledPost().CreateScheduledPost(th.Context, &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   message,
			Type:      model.PostTypeSystemGeneric,
		},
		ScheduledAt: model.GetMillis() + 100000,
	})
	require.NoError(t, storeErr)
	require.NotNil(t, stored)

	// Reschedule it to be due now, sending no type at all, the way a client that only knows how
	// to reschedule would.
	updated, _, err := th.Client.UpdateScheduledPost(context.Background(), &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  stored.CreateAt,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   message,
		},
		Id:          stored.Id,
		ScheduledAt: model.GetMillis() - 1000,
	})
	require.NoError(t, err)
	require.NotNil(t, updated)

	th.App.ProcessScheduledPosts(th.Context)

	posts, _, err := th.SystemAdminClient.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 200, "", false, false)
	require.NoError(t, err)

	for _, post := range posts.Posts {
		require.NotEqual(t, message, post.Message, "a rescheduled post that kept its reserved system post type must not be published")
	}
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

	t.Run("editing an existing recurring scheduled post keeps repeating when the flag is off", func(t *testing.T) {
		setFlag(t, true)
		created, _, err := th.Client.CreateScheduledPost(context.Background(), newScheduledPost(model.ScheduledPostRepeatTypeWeekly))
		require.NoError(t, err)

		setFlag(t, false)
		created.Message = "updated message for an existing weekly series"

		updated, _, err := th.Client.UpdateScheduledPost(context.Background(), created)
		require.NoError(t, err)
		require.Equal(t, "updated message for an existing weekly series", updated.Message)
		require.Equal(t, model.ScheduledPostRepeatTypeWeekly, updated.RepeatType)
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

		fetched, storeErr := th.App.Srv().Store().ScheduledPost().Get(th.Context, created.Id)
		require.NoError(t, storeErr)
		require.Equal(t, model.ScheduledPostRepeatTypeNone, fetched.RepeatType)
	})
}
