// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProcessScheduledPosts(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("base case - happy path", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() + 1000
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost1)
		assert.NoError(t, err)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is second scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost2)
		assert.NoError(t, err)

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 0)
	})

	t.Run("advances weekly recurring scheduled post instead of deleting", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() - 1000
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "weekly recurring scheduled post",
			},
			ScheduledAt:    scheduledAt,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "UTC",
		}
		created, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost)
		assert.NoError(t, err)
		require.NotNil(t, created)

		th.App.ProcessScheduledPosts(th.Context)

		updated, err := th.Server.Store().ScheduledPost().Get(th.Context, created.Id)
		assert.NoError(t, err)
		require.NotNil(t, updated)
		assert.Equal(t, model.ScheduledPostRepeatTypeWeekly, updated.RepeatType)
		assert.Equal(t, "UTC", updated.RepeatTimezone)
		assert.Empty(t, updated.ErrorCode)
		assert.Zero(t, updated.ProcessedAt)

		const weekMs = int64(7 * 24 * 60 * 60 * 1000)
		assert.InDelta(t, scheduledAt+weekMs, updated.ScheduledAt, float64(60*1000))
	})

	t.Run("advances multiple weekly recurring scheduled posts", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() - 1000
		firstScheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "first weekly recurring scheduled post",
			},
			ScheduledAt:    scheduledAt,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "UTC",
		}
		firstCreated, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, firstScheduledPost)
		require.NoError(t, err)
		require.NotNil(t, firstCreated)

		secondScheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "second weekly recurring scheduled post",
			},
			ScheduledAt:    scheduledAt,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "UTC",
		}
		secondCreated, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, secondScheduledPost)
		require.NoError(t, err)
		require.NotNil(t, secondCreated)

		th.App.ProcessScheduledPosts(th.Context)

		firstUpdated, err := th.Server.Store().ScheduledPost().Get(th.Context, firstCreated.Id)
		require.NoError(t, err)
		require.NotNil(t, firstUpdated)
		assert.Equal(t, model.ScheduledPostRepeatTypeWeekly, firstUpdated.RepeatType)
		assert.Empty(t, firstUpdated.ErrorCode)
		assert.Zero(t, firstUpdated.ProcessedAt)
		assert.Greater(t, firstUpdated.ScheduledAt, scheduledAt)

		secondUpdated, err := th.Server.Store().ScheduledPost().Get(th.Context, secondCreated.Id)
		require.NoError(t, err)
		require.NotNil(t, secondUpdated)
		assert.Equal(t, model.ScheduledPostRepeatTypeWeekly, secondUpdated.RepeatType)
		assert.Empty(t, secondUpdated.ErrorCode)
		assert.Zero(t, secondUpdated.ProcessedAt)
		assert.Greater(t, secondUpdated.ScheduledAt, scheduledAt)
	})

	t.Run("advances overdue weekly recurring scheduled post older than one day", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() - (48 * 60 * 60 * 1000)
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "overdue weekly recurring scheduled post",
			},
			ScheduledAt:    scheduledAt,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "UTC",
		}
		created, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost)
		assert.NoError(t, err)
		require.NotNil(t, created)

		th.App.ProcessScheduledPosts(th.Context)

		updated, err := th.Server.Store().ScheduledPost().Get(th.Context, created.Id)
		assert.NoError(t, err)
		require.NotNil(t, updated)
		assert.Equal(t, model.ScheduledPostRepeatTypeWeekly, updated.RepeatType)
		assert.Equal(t, "UTC", updated.RepeatTimezone)
		assert.Empty(t, updated.ErrorCode)
		assert.Zero(t, updated.ProcessedAt)
		assert.Greater(t, updated.ScheduledAt, model.GetMillis())
	})

	t.Run("permanently deletes recurring and one-shot posts when the channel no longer exists", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() - 1000
		deletedChannelId := model.NewId()

		recurringScheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: deletedChannelId,
				Message:   "recurring scheduled post for a channel that no longer exists",
			},
			ScheduledAt:    scheduledAt,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "UTC",
		}
		recurringCreated, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, recurringScheduledPost)
		require.NoError(t, err)

		oneShotScheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: deletedChannelId,
				Message:   "one-shot scheduled post for a channel that no longer exists",
			},
			ScheduledAt: scheduledAt,
		}
		oneShotCreated, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, oneShotScheduledPost)
		require.NoError(t, err)

		th.App.ProcessScheduledPosts(th.Context)

		// Both rows must be permanently deleted: the series ends rather than advancing,
		// erroring, or being silently reposted on later runs.
		_, err = th.Server.Store().ScheduledPost().Get(th.Context, recurringCreated.Id)
		require.Error(t, err)
		_, err = th.Server.Store().ScheduledPost().Get(th.Context, oneShotCreated.Id)
		require.Error(t, err)
	})

	t.Run("marks overdue one-shot posts even when overdue weekly posts move pagination backward", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		now := model.GetMillis()
		weeklyScheduledAt := now - (48 * 60 * 60 * 1000)
		oneShotScheduledAt := now - (36 * 60 * 60 * 1000)

		weeklyScheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  now,
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "overdue weekly recurring scheduled post",
			},
			ScheduledAt:    weeklyScheduledAt,
			RepeatType:     model.ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "UTC",
		}
		weeklyCreated, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, weeklyScheduledPost)
		assert.NoError(t, err)
		require.NotNil(t, weeklyCreated)

		oneShotScheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  now,
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "overdue one-shot scheduled post",
			},
			ScheduledAt: oneShotScheduledAt,
		}
		oneShotCreated, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, oneShotScheduledPost)
		assert.NoError(t, err)
		require.NotNil(t, oneShotCreated)

		th.App.ProcessScheduledPosts(th.Context)

		weeklyUpdated, err := th.Server.Store().ScheduledPost().Get(th.Context, weeklyCreated.Id)
		assert.NoError(t, err)
		require.NotNil(t, weeklyUpdated)
		assert.Equal(t, model.ScheduledPostRepeatTypeWeekly, weeklyUpdated.RepeatType)
		assert.Equal(t, "UTC", weeklyUpdated.RepeatTimezone)
		assert.Empty(t, weeklyUpdated.ErrorCode)
		assert.Zero(t, weeklyUpdated.ProcessedAt)
		assert.Greater(t, weeklyUpdated.ScheduledAt, model.GetMillis())

		oneShotUpdated, err := th.Server.Store().ScheduledPost().Get(th.Context, oneShotCreated.Id)
		assert.NoError(t, err)
		require.NotNil(t, oneShotUpdated)
		assert.Equal(t, model.ScheduledPostErrorUnableToSend, oneShotUpdated.ErrorCode)
		assert.Greater(t, oneShotUpdated.ProcessedAt, int64(0))
	})

	t.Run("sets error code for archived channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		appErr := th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id)
		assert.Nil(t, appErr)

		scheduledAt := model.GetMillis() - (5 * 60 * 60 * 1000)
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost1)
		assert.NoError(t, err)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is second scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost2)
		assert.NoError(t, err)

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		// since the channel ID we set in the above created scheduled posts is of a
		// non-existing channel, the job should have set the appropriate error code for them in the database
		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeChannelArchived, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeChannelArchived, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})

	t.Run("sets error code for archived user", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() + 1000
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost1)
		assert.NoError(t, err)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is second scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost2)
		assert.NoError(t, err)

		_, appErr := th.App.UpdateActive(th.Context, th.BasicUser, false)
		assert.Nil(t, appErr)

		defer func() {
			_, _ = th.App.UpdateActive(th.Context, th.BasicUser, true)
		}()

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeUserDeleted, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeUserDeleted, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})

	t.Run("sets error code when user is not a channel member", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() + 1000
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost1)
		assert.NoError(t, err)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is second scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost2)
		assert.NoError(t, err)

		appErr := th.App.LeaveChannel(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		assert.Nil(t, appErr)

		defer func() {
			_ = th.App.JoinChannel(th.Context, th.BasicChannel, th.BasicUser.Id)
		}()

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})

	t.Run("sets error code when user is not a team member", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

		scheduledAt := model.GetMillis() + 1000
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost1)
		assert.NoError(t, err)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is second scheduled post",
			},
			ScheduledAt: scheduledAt,
		}
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost2)
		assert.NoError(t, err)

		appErr := th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.BasicUser.Id)
		assert.Nil(t, appErr)

		defer func() {
			_, _, _ = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.BasicUser.Id)
		}()

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})
}

func TestProcessScheduledPostsWithSystemPostType(t *testing.T) {
	mainHelper.Parallel(t)

	testCases := []struct {
		name      string
		postType  string
		published bool
		// errorCode is the code the job must record when the post is not published. Reserved
		// system types are rejected up front (ScheduledPostErrorInvalidPost), while case- and
		// whitespace-based near-misses slip past that check but still fail post validation on
		// publish (ScheduledPostErrorUnknownError). Empty when the post is expected to publish.
		errorCode string
	}{
		{
			name:      "generic system post type",
			postType:  model.PostTypeSystemGeneric,
			published: false,
			errorCode: model.ScheduledPostErrorInvalidPost,
		},
		{
			name:      "structured system post type",
			postType:  model.PostTypeAddToTeam,
			published: false,
			errorCode: model.ScheduledPostErrorInvalidPost,
		},
		{
			name:      "bare reserved prefix",
			postType:  model.PostSystemMessagePrefix,
			published: false,
			errorCode: model.ScheduledPostErrorInvalidPost,
		},
		{
			name:      "reserved system type with trailing whitespace",
			postType:  model.PostTypeSystemGeneric + " ",
			published: false,
			errorCode: model.ScheduledPostErrorInvalidPost,
		},
		{
			name:      "reserved prefix with different casing",
			postType:  "System_generic",
			published: false,
			errorCode: model.ScheduledPostErrorUnknownError,
		},
		{
			name:      "reserved prefix behind leading whitespace",
			postType:  "  " + model.PostTypeSystemGeneric,
			published: false,
			errorCode: model.ScheduledPostErrorUnknownError,
		},
		{
			name:      "default post type",
			postType:  model.PostTypeDefault,
			published: true,
		},
		{
			name:      "attachment post type",
			postType:  model.PostTypeMessageAttachment,
			published: true,
		},
		{
			name:      "custom type containing but not starting with the reserved prefix",
			postType:  model.PostCustomTypePrefix + model.PostTypeSystemGeneric,
			published: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))

			message := "scheduled post: " + testCase.name
			scheduledPost := &model.ScheduledPost{
				Draft: model.Draft{
					CreateAt:  model.GetMillis(),
					UserId:    th.BasicUser.Id,
					ChannelId: th.BasicChannel.Id,
					Message:   message,
					Type:      testCase.postType,
				},
				ScheduledAt: model.GetMillis() - 1000,
			}
			created, err := th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, scheduledPost)
			require.NoError(t, err)
			require.NotNil(t, created)

			th.App.ProcessScheduledPosts(th.Context)

			publishedPost := findPublishedPostByMessage(t, th, th.BasicChannel.Id, message)

			if testCase.published {
				require.NotNil(t, publishedPost, "scheduled post should have been published")
				assert.Equal(t, testCase.postType, publishedPost.Type)
				assert.False(t, publishedPost.IsSystemMessage(), "a published scheduled post must never be treated as a system message")
				return
			}

			assert.Nil(t, publishedPost, "a scheduled post with a reserved system post type must not be published")

			updated, err := th.Server.Store().ScheduledPost().Get(th.Context, created.Id)
			if assert.NoError(t, err, "the scheduled post should have been kept with an error code instead of being published") {
				assert.Equal(t, testCase.errorCode, updated.ErrorCode)
			}

			// A second job run must not resurrect the post and publish it later.
			th.App.ProcessScheduledPosts(th.Context)
			assert.Nil(t, findPublishedPostByMessage(t, th, th.BasicChannel.Id, message), "a scheduled post with a reserved system post type must not publish on a later job run")
		})
	}
}

// findPublishedPostByMessage returns the published post carrying the given message, or nil.
// Scheduled posts are matched by message because the channel also contains membership system
// messages created by InitBasic.
func findPublishedPostByMessage(t *testing.T, th *TestHelper, channelID, message string) *model.Post {
	t.Helper()

	posts, appErr := th.App.GetPosts(th.Context, channelID, 0, 200)
	require.Nil(t, appErr)

	for _, post := range posts.Posts {
		if post.Message == message {
			return post
		}
	}

	return nil
}

func TestHandleFailedScheduledPosts(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("should handle failed scheduled posts correctly and notify users about failure via system-bot", func(t *testing.T) {
		rctx := th.Context
		var err error
		var appErr *model.AppError
		var systemBot *model.Bot

		systemBot, appErr = th.App.GetSystemBot(rctx)
		assert.True(t, appErr == nil)
		assert.NotNil(t, systemBot)

		user1 := th.BasicUser
		user2 := th.BasicUser2

		channel1 := th.BasicChannel
		channel2 := th.CreateChannel(t, th.BasicTeam)

		// Create failed scheduled posts: 1 for user1 and 2 for user2
		failedScheduledPosts := []*model.ScheduledPost{
			{
				Id: model.NewId(),
				Draft: model.Draft{
					CreateAt:  model.GetMillis(),
					UserId:    user1.Id,
					ChannelId: channel1.Id,
					Message:   "Failed scheduled post for user 1",
				},
				ErrorCode: model.ScheduledPostErrorUnknownError,
			},
			{
				Id: model.NewId(),
				Draft: model.Draft{
					CreateAt:  model.GetMillis(),
					UserId:    user2.Id,
					ChannelId: channel1.Id,
					Message:   "Failed scheduled post 1 for user 2",
				},
				ErrorCode: model.ScheduledPostErrorCodeNoChannelPermission,
			},
			{
				Id: model.NewId(),
				Draft: model.Draft{
					CreateAt:  model.GetMillis(),
					UserId:    user2.Id,
					ChannelId: channel2.Id,
					Message:   "Failed scheduled post 2 for user 2",
				},
				ErrorCode: model.ScheduledPostErrorNoChannelMember,
			},
		}

		// Save the failed scheduled posts in the store
		for _, sp := range failedScheduledPosts {
			_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(th.Context, sp)
			assert.NoError(t, err)
		}

		// Mock WebSocket channels for both of the two users
		messagesUser1, closeWSUser1 := connectFakeWebSocket(t, th, user1.Id, "", []model.WebsocketEventType{model.WebsocketScheduledPostUpdated})
		defer closeWSUser1()

		messagesUser2, closeWSUser2 := connectFakeWebSocket(t, th, user2.Id, "", []model.WebsocketEventType{model.WebsocketScheduledPostUpdated})
		defer closeWSUser2()

		th.App.handleFailedScheduledPosts(rctx, failedScheduledPosts)

		// Validate that the WebSocket events for both users are sent and received correctly
		for i := range failedScheduledPosts {
			var received *model.WebSocketEvent
			select {
			case received = <-messagesUser1:
				if received.GetBroadcast().UserId == user1.Id {
					assert.Equal(t, model.WebsocketScheduledPostUpdated, received.EventType())
				}
			case received = <-messagesUser2:
				if received.GetBroadcast().UserId == user2.Id {
					assert.Equal(t, model.WebsocketScheduledPostUpdated, received.EventType())
				}
			case <-time.After(3 * time.Second):
				t.Errorf("Timeout while waiting for a WebSocket event for scheduled post %d", i+1)
			}
		}

		// Helper function to check notifications for a specific user
		checkUserNotification := func(user *model.User) {
			// Wait time for notifications to be sent (adding 5 secs because it is run in a separate goroutine)
			timeout := 5 * time.Second
			begin := time.Now()
			channel, appErr := th.App.GetOrCreateDirectChannel(rctx, user.Id, systemBot.UserId)
			assert.True(t, appErr == nil)

			var posts *model.PostList
			// wait for the notification to be sent into the channel.
			// idea is to get the channel and try to find posts, if not, wait 100ms and try again until timeout or there is posts length
			for {
				if time.Since(begin) > timeout {
					break
				}
				posts, appErr = th.App.GetPosts(th.Context, channel.Id, 0, 10)
				assert.True(t, appErr == nil)
				if len(posts.Posts) > 0 {
					break
				}
				time.Sleep(100 * time.Millisecond)
			}
			assert.NotEmpty(t, posts.Posts, "Expected notification for user %s to have been sent", user.Id)

			// Collect failed messages for users
			var userFailedMessages []*model.ScheduledPost
			for _, sp := range failedScheduledPosts {
				if sp.UserId == user.Id {
					userFailedMessages = append(userFailedMessages, sp)
				}
			}

			T := i18n.GetUserTranslations(user.Locale)
			messageHeader := T("app.scheduled_post.failed_messages", map[string]any{
				"Count": len(userFailedMessages),
			})

			// Validate the actual content of the notification posted
			found := false
			for _, post := range posts.Posts {
				if post.UserId == systemBot.UserId && strings.HasPrefix(post.Message, messageHeader) {
					found = true
					break
				}
			}

			assert.True(t, found, "\nNotification post not found for user %s with expected message prefix. \n Expected: %s \n", user.Id, messageHeader)
		}

		// Check notifications sent for failed messages for both users
		checkUserNotification(user1)
		checkUserNotification(user2)
	})
}
