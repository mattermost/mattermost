// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
}

func TestHandleFailedScheduledPosts(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should handle failed scheduled posts correctly", func(t *testing.T) {
		rctx := th.Context
		var err error
		var appErr *model.AppError

		systemBot, appErr := th.App.GetSystemBot(rctx)
		require.Nil(t, appErr)
		assert.NotNil(t, systemBot)

		failedScheduledPosts := []*model.ScheduledPost{
			{
				Id: model.NewId(),
				Draft: model.Draft{
					CreateAt:  model.GetMillis(),
					UserId:    th.BasicUser.Id,
					ChannelId: th.BasicChannel.Id,
					Message:   "Failed scheduled post 1",
				},
				ErrorCode: model.ScheduledPostErrorUnknownError,
			},
			{
				Id: model.NewId(),
				Draft: model.Draft{
					CreateAt:  model.GetMillis(),
					UserId:    th.BasicUser.Id,
					ChannelId: th.BasicChannel.Id,
					Message:   "Failed scheduled post 2",
				},
				ErrorCode: model.ScheduledPostErrorCodeNoChannelPermission,
			},
		}

		// Save the failed scheduled posts in the store
		for _, sp := range failedScheduledPosts {
			_, err = th.Server.Store().ScheduledPost().CreateScheduledPost(sp)
			assert.NoError(t, err)
		}

		// websocket mock
		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{model.WebsocketScheduledPostUpdated})
		defer closeWS()

		// call the handleFailedScheduledPosts which will send the system bot message
		th.App.handleFailedScheduledPosts(rctx, failedScheduledPosts)
		// validate that the WS events are sent and published
		for i := 0; i < len(failedScheduledPosts); i++ {
			select {
			case received := <-messages:
				assert.Equal(t, model.WebsocketScheduledPostUpdated, received.EventType())
				assert.Equal(t, th.BasicUser.Id, received.GetBroadcast().UserId)

				// Validate the scheduledPost data in the event is corect
				var scheduledPostJSON []byte
				scheduledPostJSON, err = json.Marshal(failedScheduledPosts[i])
				assert.NoError(t, err)
				assert.Equal(t, string(scheduledPostJSON), received.GetData()["scheduledPost"])
			case <-time.After(1 * time.Second):
				t.Errorf("Timeout while waiting for a WS event for scheduled post %d, but there was none received", i+1)
			}
		}

		// wait for the notification to be sent into the channel (adding 2 secs because it is run in a separate rountine)
		// idea is to get the channel, try to find posts, if not, wait and try again until timout or posts lengh
		var posts *model.PostList
		var timeout = 2 * time.Second
		begin := time.Now()
		channel, chErr := th.App.GetOrCreateDirectChannel(rctx, th.BasicUser.Id, systemBot.UserId)
		assert.Nil(t, chErr)

		for {
			if time.Since(begin) > timeout {
				break
			}

			posts, appErr = th.App.GetPosts(channel.Id, 0, 10)
			require.Nil(t, appErr)

			// break in case it find any posts
			if len(posts.Posts) > 0 {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		assert.NotEmpty(t, posts.Posts, "Expected notification to have been sent within %d seconds", timeout)

		// get the user translations to validate against the system bot message content
		user, err := th.App.GetUser(th.BasicUser.Id)
		require.Nil(t, err)

		T := i18n.GetUserTranslations(user.Locale)
		messageContent := T("app.scheduled_post.failed_messages", map[string]interface{}{
			"Count": len(failedScheduledPosts),
		})

		// check that the notification post exists
		found := false
		for _, post := range posts.Posts {
			if post.UserId == systemBot.UserId && post.Message == messageContent {
				found = true
				break
			}
		}
		assert.True(t, found, "Not able to find the system bot post in the DM channel")
	})
}
