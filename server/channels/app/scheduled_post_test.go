// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestSaveScheduledPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user1ConnID := model.NewId()

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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)
	})

	t.Run("cannot save invalid scheduled post", func(t *testing.T) {
		scheduledPost := &model.ScheduledPost{
			// a completely empty scheduled post
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		scheduledPost.Message = "this is a second scheduled post"
		scheduledPost.Id = model.NewId()
		createdScheduledPost, appErr = th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.NotNil(t, appErr)
		require.Nil(t, createdScheduledPost)
	})
}

func TestGetUserTeamScheduledPosts(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user1ConnID := model.NewId()

	t.Run("should get created scheduled posts", func(t *testing.T) {
		t.Skip("https://mattermost.atlassian.net/browse/MM-61523")
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1, user1ConnID)
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
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost2)

		defer func() {
			_ = th.Server.Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost1.Id, createdScheduledPost2.Id})
		}()

		retrievedScheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, th.BasicChannel.TeamId)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(retrievedScheduledPosts))

		// more recently created scheduled post appears first in the list
		require.Equal(t, createdScheduledPost1.Id, retrievedScheduledPosts[0].Id)
		require.Equal(t, createdScheduledPost2.Id, retrievedScheduledPosts[1].Id)
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
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1, user1ConnID)
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
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2, user1ConnID)
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
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1, user1ConnID)
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
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2, user1ConnID)
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
		createdScheduledPost1, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost1, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost1)

		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis() + 100,
				UserId:    th.BasicUser.Id,
				ChannelId: gm.Id,
				Message:   "this is a second scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost2, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost2, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost2)

		defer func() {
			_ = th.Server.Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost1.Id, createdScheduledPost2.Id})
		}()

		retrievedScheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		require.Equal(t, 2, len(retrievedScheduledPosts))

		// more recently created scheduled post appears first in the list
		require.Equal(t, createdScheduledPost1.Id, retrievedScheduledPosts[0].Id)
		require.Equal(t, createdScheduledPost2.Id, retrievedScheduledPosts[1].Id)
	})
}

func TestUpdateScheduledPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user1ConnID := model.NewId()

	t.Run("base case", func(t *testing.T) {
		// first we'll create a scheduled post
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		// now we'll try updating it
		newScheduledAtTime := model.GetMillis() + 9999999
		createdScheduledPost.ScheduledAt = newScheduledAtTime
		createdScheduledPost.Message = "Updated Message!!!"

		updatedScheduledPost, appErr := th.App.UpdateScheduledPost(th.Context, userId, createdScheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, updatedScheduledPost)

		require.Equal(t, newScheduledAtTime, updatedScheduledPost.ScheduledAt)
		require.Equal(t, "Updated Message!!!", updatedScheduledPost.Message)
	})

	t.Run("should ot be allowed to updated a scheduled post not belonging to the user", func(t *testing.T) {
		// first we'll create a scheduled post
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		// now we'll try updating it
		newScheduledAtTime := model.GetMillis() + 9999999
		createdScheduledPost.ScheduledAt = newScheduledAtTime
		createdScheduledPost.Message = "Updated Message!!!"

		updatedScheduledPost, appErr := th.App.UpdateScheduledPost(th.Context, th.BasicUser2.Id, createdScheduledPost, user1ConnID)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.Nil(t, updatedScheduledPost)
	})

	t.Run("should only allow updating limited fields", func(t *testing.T) {
		// first we'll create a scheduled post
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
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		// now we'll try updating it
		newUpdatedAt := model.GetMillis() + 1000000
		createdScheduledPost.UpdateAt = newUpdatedAt     // this should be overridden by the actual update time
		createdScheduledPost.Message = "Updated Message" // this will update
		newChannelId := model.NewId()
		createdScheduledPost.ChannelId = newChannelId // this won't update
		newCreateAt := model.GetMillis() + 5000000
		createdScheduledPost.CreateAt = newCreateAt // this won't update
		createdScheduledPost.FileIds = []string{model.NewId(), model.NewId()}
		createdScheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError

		updatedScheduledPost, appErr := th.App.UpdateScheduledPost(th.Context, userId, createdScheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		require.NotEqual(t, newUpdatedAt, updatedScheduledPost.UpdateAt)
		require.Equal(t, "Updated Message", updatedScheduledPost.Message)
		require.NotEqual(t, newChannelId, updatedScheduledPost.ChannelId)
		require.NotEqual(t, newCreateAt, updatedScheduledPost.CreateAt)
		require.Equal(t, 2, len(updatedScheduledPost.FileIds))
		require.Equal(t, model.ScheduledPostErrorUnknownError, createdScheduledPost.ErrorCode)
	})
}

func TestDeleteScheduledPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	user1ConnID := model.NewId()

	t.Run("base case", func(t *testing.T) {
		// first we'll create a scheduled post
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		fetchedScheduledPost, err := th.Server.Store().ScheduledPost().Get(scheduledPost.Id)
		require.NoError(t, err)
		require.NotNil(t, fetchedScheduledPost)
		require.Equal(t, createdScheduledPost.Id, fetchedScheduledPost.Id)
		require.Equal(t, createdScheduledPost.Message, fetchedScheduledPost.Message)

		// now we'll delete it
		var deletedScheduledPost *model.ScheduledPost
		deletedScheduledPost, appErr = th.App.DeleteScheduledPost(th.Context, th.BasicUser.Id, scheduledPost.Id, "connection_id")
		require.Nil(t, appErr)
		require.NotNil(t, deletedScheduledPost)

		require.Equal(t, scheduledPost.Id, deletedScheduledPost.Id)
		require.Equal(t, scheduledPost.Message, deletedScheduledPost.Message)

		// try to fetch it again
		reFetchedScheduledPost, err := th.Server.Store().ScheduledPost().Get(scheduledPost.Id)
		require.Error(t, err) // This will produce error as the row doesn't exist
		require.Nil(t, reFetchedScheduledPost)
	})

	t.Run("should not allow deleting someone else's scheduled post", func(t *testing.T) {
		// first we'll create a scheduled post
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}
		createdScheduledPost, appErr := th.App.SaveScheduledPost(th.Context, scheduledPost, user1ConnID)
		require.Nil(t, appErr)
		require.NotNil(t, createdScheduledPost)

		fetchedScheduledPost, err := th.Server.Store().ScheduledPost().Get(scheduledPost.Id)
		require.NoError(t, err)
		require.NotNil(t, fetchedScheduledPost)
		require.Equal(t, createdScheduledPost.Id, fetchedScheduledPost.Id)
		require.Equal(t, createdScheduledPost.Message, fetchedScheduledPost.Message)

		// now we'll delete it
		var deletedScheduledPost *model.ScheduledPost
		deletedScheduledPost, appErr = th.App.DeleteScheduledPost(th.Context, th.BasicUser2.Id, scheduledPost.Id, "connection_id")
		require.NotNil(t, appErr)
		require.Nil(t, deletedScheduledPost)

		// try to fetch it again
		reFetchedScheduledPost, err := th.Server.Store().ScheduledPost().Get(scheduledPost.Id)
		require.NoError(t, err)
		require.NotNil(t, reFetchedScheduledPost)
		require.Equal(t, createdScheduledPost.Id, reFetchedScheduledPost.Id)
		require.Equal(t, createdScheduledPost.Message, reFetchedScheduledPost.Message)
	})

	t.Run("should producer error when deleting non existing scheduled post", func(t *testing.T) {
		var deletedScheduledPost *model.ScheduledPost
		deletedScheduledPost, appErr := th.App.DeleteScheduledPost(th.Context, th.BasicUser.Id, model.NewId(), "connection_id")
		require.NotNil(t, appErr)
		require.Nil(t, deletedScheduledPost)
	})
}
