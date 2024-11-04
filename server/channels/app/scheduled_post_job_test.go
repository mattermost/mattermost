// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
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
}
