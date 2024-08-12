// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestSaveScheduledPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("base case", func(t *testing.T) {
		userId := model.NewId()

		channel, err := th.GetSqlStore().Channel().Save(th.Context, &model.Channel{
			Name:        model.NewId(),
			DisplayName: "Channel",
			Type:        model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, err)

		_, err = th.GetSqlStore().Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: false,
			SchemeUser:  true,
		})
		require.NoError(t, err)

		defer func() {
			_ = th.GetSqlStore().Channel().Delete(channel.Id, model.GetMillis())
			_ = th.GetSqlStore().Channel().RemoveMember(th.Context, channel.Id, userId)
		}()

		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: channel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)
	})

	t.Run("cannot save invalid scheduled post", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			// a completely empty scheduled post
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.NotNil(t, appErr)
		require.Nil(t, createdScheduledPost)
	})

	t.Run("cannot save post sdcheduled in the past", func(t *testing.T) {
		userId := model.NewId()

		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: "channel_id",
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() - 100000, // 100 seconds in the past
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.NotNil(t, appErr)
		require.Nil(t, createdScheduledPost)
	})

	t.Run("cannot scheduled post in a channel you don't belong to", func(t *testing.T) {
		userId := model.NewId()

		// we didn't create any channel member entry, so the user doesn't
		// belong to the channel
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: "channel_id",
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.NotNil(t, appErr)
		require.Nil(t, createdScheduledPost)
	})

	t.Run("cannot schedule post in an archived channel", func(t *testing.T) {
		userId := model.NewId()

		channel, err := th.GetSqlStore().Channel().Save(th.Context, &model.Channel{
			Name:        model.NewId(),
			DisplayName: "Channel",
			Type:        model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, err)

		_, err = th.GetSqlStore().Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: false,
			SchemeUser:  true,
		})
		require.NoError(t, err)

		err = th.GetSqlStore().Channel().Delete(channel.Id, model.GetMillis())
		require.NoError(t, err)

		defer func() {
			_ = th.GetSqlStore().Channel().Delete(channel.Id, model.GetMillis())
			_ = th.GetSqlStore().Channel().RemoveMember(th.Context, channel.Id, userId)
		}()

		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: channel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.NotNil(t, appErr)
		require.Nil(t, createdScheduledPost)
	})

	t.Run("can scheduled multiple posts in the same channel", func(t *testing.T) {
		userId := model.NewId()

		channel, err := th.GetSqlStore().Channel().Save(th.Context, &model.Channel{
			Name:        model.NewId(),
			DisplayName: "Channel",
			Type:        model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, err)

		_, err = th.GetSqlStore().Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: false,
			SchemeUser:  true,
		})
		require.NoError(t, err)

		defer func() {
			_ = th.GetSqlStore().Channel().Delete(channel.Id, model.GetMillis())
			_ = th.GetSqlStore().Channel().RemoveMember(th.Context, channel.Id, userId)
		}()

		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: channel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		scheduledPost.Message = "this is a second scheduled post"
		createdScheduledPost, appErr = th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)
	})
}
