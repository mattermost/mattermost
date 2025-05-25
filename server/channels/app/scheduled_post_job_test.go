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
)

func TestProcessScheduledPosts(t *testing.T) {
	t.Run("base case - happy path", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

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
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost1)
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
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost2)
		assert.NoError(t, err)

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 0)
	})

	t.Run("sets error code for archived channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

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
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost1)
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
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost2)
		assert.NoError(t, err)

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		// since the channel ID we set in the above created scheduled posts is of a
		// non-existing channel, the job should have set the appropriate error code for them in the database
		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeChannelArchived, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeChannelArchived, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})

	t.Run("sets error code for archived user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

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
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost1)
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
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost2)
		assert.NoError(t, err)

		_, appErr := th.App.UpdateActive(th.Context, th.BasicUser, false)
		assert.Nil(t, appErr)

		defer func() {
			_, _ = th.App.UpdateActive(th.Context, th.BasicUser, true)
		}()

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeUserDeleted, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeUserDeleted, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})

	t.Run("sets error code when user is not a channel member", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

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
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost1)
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
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost2)
		assert.NoError(t, err)

		appErr := th.App.LeaveChannel(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		assert.Nil(t, appErr)

		defer func() {
			_ = th.App.JoinChannel(th.Context, th.BasicChannel, th.BasicUser.Id)
		}()

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})

	t.Run("sets error code when user is not a team member", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

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
		_, err := th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost1)
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
		_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(scheduledPost2)
		assert.NoError(t, err)

		appErr := th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.BasicUser.Id)
		assert.Nil(t, appErr)

		defer func() {
			_, _, _ = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.BasicUser.Id)
		}()

		time.Sleep(1 * time.Second)

		th.App.ProcessScheduledPosts(th.Context)

		scheduledPosts, err := th.App.Srv().Store().ScheduledPost().GetScheduledPostsForUser(th.BasicUser.Id, th.BasicChannel.TeamId)
		assert.NoError(t, err)
		assert.Len(t, scheduledPosts, 2)

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[0].ErrorCode)
		assert.Greater(t, scheduledPosts[0].ProcessedAt, int64(0))

		assert.Equal(t, model.ScheduledPostErrorCodeNoChannelPermission, scheduledPosts[1].ErrorCode)
		assert.Greater(t, scheduledPosts[1].ProcessedAt, int64(0))
	})
}

func TestHandleFailedScheduledPosts(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
		channel2 := th.CreateChannel(th.Context, th.BasicTeam)

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
			_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(sp)
			assert.NoError(t, err)
		}

		// Mock WebSocket channels for both of the two users
		messagesUser1, closeWSUser1 := connectFakeWebSocket(t, th, user1.Id, "", []model.WebsocketEventType{model.WebsocketScheduledPostUpdated})
		defer closeWSUser1()

		messagesUser2, closeWSUser2 := connectFakeWebSocket(t, th, user2.Id, "", []model.WebsocketEventType{model.WebsocketScheduledPostUpdated})
		defer closeWSUser2()

		th.App.handleFailedScheduledPosts(rctx, failedScheduledPosts)

		// Validate that the WebSocket events for both users are sent and received correctly
		for i := 0; i < len(failedScheduledPosts); i++ {
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
			var timeout = 5 * time.Second
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
				posts, appErr = th.App.GetPosts(channel.Id, 0, 10)
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
