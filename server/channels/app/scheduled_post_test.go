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

	t.Run("cannot save post scheduled in the past", func(t *testing.T) {
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
		scheduledPost.Id = model.NewId()
		createdScheduledPost, appErr = th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)
	})

	t.Run("cannot save an empty post", func(t *testing.T) {
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
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost)
		require.NotNil(t, appErr)
		require.Nil(t, createdScheduledPost)
	})
}

func TestGetUserTeamScheduledPosts(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should get created scheduled posts", func(t *testing.T) {
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost1)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a second scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost2)

		defer func() {
			_ = th.Server.Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost1.Id, createdScheduledPost2.Id})
		}()

		retrievedScheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(retrievedScheduledPosts))

		// more recently created scheduled post appears first in the list
		require.Equal(t, createdScheduledPost2.Id, retrievedScheduledPosts[0].Id)
		require.Equal(t, createdScheduledPost1.Id, retrievedScheduledPosts[1].Id)
	})

	t.Run("should handle no scheduled posts", func(t *testing.T) {
		retrievedScheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		require.Nil(t, appErr)
		require.Equal(t, 0, len(retrievedScheduledPosts))
	})

	t.Run("should restrict to specified teams and DM/GMs", func(t *testing.T) {
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost1)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a second scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost2)

		defer func() {
			_ = th.Server.Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost1.Id, createdScheduledPost2.Id})
		}()

		// create a dummy team
		secondTeam := th.CreateTeam()
		_, appErr = th.App.JoinUserToTeam(th.Context, secondTeam, th.BasicUser, th.BasicUser.Id)
		require.Nil(t, appErr)

		retrievedScheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, secondTeam.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, len(retrievedScheduledPosts))
	})

	t.Run("should not return scheduled posts from DMs and GMs when teamId is specified", func(t *testing.T) {
		// start a DM between BasicUser1 and BasicUser2
		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		// create a GM. Since a GM needs at least 3 users, we'll create a third user first
		thirdUser := th.CreateUser()
		_, appErr = th.App.JoinUserToTeam(th.Context, th.BasicTeam, thirdUser, thirdUser.Id)
		require.Nil(t, appErr)

		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, thirdUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: dm.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost1)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: gm.Id,
				Message:   "this is a second scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost2)

		defer func() {
			_ = th.Server.Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost1.Id, createdScheduledPost2.Id})
		}()

		retrievedScheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		require.Nil(t, appErr)
		require.Equal(t, 0, len(retrievedScheduledPosts))
	})

	t.Run("should return scheduled posts from DMs and GMs when teamId is empty", func(t *testing.T) {
		// start a DM between BasicUser1 and BasicUser2
		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		// create a GM. Since a GM needs at least 3 users, we'll create a third user first
		thirdUser := th.CreateUser()
		_, appErr = th.App.JoinUserToTeam(th.Context, th.BasicTeam, thirdUser, thirdUser.Id)
		require.Nil(t, appErr)

		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, thirdUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: dm.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost1)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: gm.Id,
				Message:   "this is a second scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost2)

		defer func() {
			_ = th.Server.Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost1.Id, createdScheduledPost2.Id})
		}()

		retrievedScheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		require.Equal(t, 2, len(retrievedScheduledPosts))

		// more recently created scheduled post appears first in the list
		require.Equal(t, createdScheduledPost2.Id, retrievedScheduledPosts[0].Id)
		require.Equal(t, createdScheduledPost1.Id, retrievedScheduledPosts[1].Id)
	})
}
