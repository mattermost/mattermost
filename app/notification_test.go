// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func TestSendNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.AddUserToChannel(th.BasicUser2, th.BasicChannel)

	post1, appErr := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@" + th.BasicUser2.Username,
		Type:      model.POST_ADD_TO_CHANNEL,
		Props:     map[string]interface{}{model.POST_PROPS_ADDED_USER_ID: "junk"},
	}, true)
	require.Nil(t, appErr)

	mentions, err := th.App.SendNotifications(post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
	require.NoError(t, err)
	require.NotNil(t, mentions)
	require.True(t, utils.StringInSlice(th.BasicUser2.Id, mentions), "mentions", mentions)

	dm, appErr := th.App.GetOrCreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, appErr)

	post2, appErr := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: dm.Id,
		Message:   "dm message",
	}, true)
	require.Nil(t, appErr)

	mentions, err = th.App.SendNotifications(post2, th.BasicTeam, dm, th.BasicUser, nil, true)
	require.NoError(t, err)
	require.NotNil(t, mentions)

	_, appErr = th.App.UpdateActive(th.BasicUser2, false)
	require.Nil(t, appErr)
	appErr = th.App.Srv().InvalidateAllCaches()
	require.Nil(t, appErr)

	post3, appErr := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: dm.Id,
		Message:   "dm message",
	}, true)
	require.Nil(t, appErr)

	mentions, err = th.App.SendNotifications(post3, th.BasicTeam, dm, th.BasicUser, nil, true)
	require.NoError(t, err)
	require.NotNil(t, mentions)

	th.BasicChannel.DeleteAt = 1
	mentions, err = th.App.SendNotifications(post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
	require.NoError(t, err)
	require.Empty(t, mentions)
}

func TestSendNotificationsWithManyUsers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	users := []*model.User{}
	for i := 0; i < 10; i++ {
		user := th.CreateUser()
		th.LinkUserToTeam(user, th.BasicTeam)
		th.App.AddUserToChannel(user, th.BasicChannel)
		users = append(users, user)
	}

	_, appErr1 := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@channel",
		Type:      model.POST_ADD_TO_CHANNEL,
		Props:     map[string]interface{}{model.POST_PROPS_ADDED_USER_ID: "junk"},
	}, true)
	require.Nil(t, appErr1)

	// Each user should have a mention count of exactly 1 in the DB at this point.
	t.Run("1-mention", func(t *testing.T) {
		for i, user := range users {
			t.Run(fmt.Sprintf("user-%d", i+1), func(t *testing.T) {
				channelUnread, appErr2 := th.Server.Store.Channel().GetChannelUnread(th.BasicChannel.Id, user.Id)
				require.Nil(t, appErr2)
				assert.Equal(t, int64(1), channelUnread.MentionCount)
			})
		}
	})

	_, appErr1 = th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@channel",
		Type:      model.POST_ADD_TO_CHANNEL,
		Props:     map[string]interface{}{model.POST_PROPS_ADDED_USER_ID: "junk"},
	}, true)
	require.Nil(t, appErr1)

	// Now each user should have a mention count of exactly 2 in the DB.
	t.Run("2-mentions", func(t *testing.T) {
		for i, user := range users {
			t.Run(fmt.Sprintf("user-%d", i+1), func(t *testing.T) {
				channelUnread, appErr2 := th.Server.Store.Channel().GetChannelUnread(th.BasicChannel.Id, user.Id)
				require.Nil(t, appErr2)
				assert.Equal(t, int64(2), channelUnread.MentionCount)
			})
		}
	})
}

func TestSendOutOfChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel

	user1 := th.BasicUser
	user2 := th.BasicUser2

	t.Run("should send ephemeral post when there is an out of channel mention", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{user2.Username}

		sent, err := th.App.sendOutOfChannelMentions(user1, post, channel, potentialMentions)

		assert.Nil(t, err)
		assert.True(t, sent)
	})

	t.Run("should not send ephemeral post when there are no out of channel mentions", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{"not a user"}

		sent, err := th.App.sendOutOfChannelMentions(user1, post, channel, potentialMentions)

		assert.Nil(t, err)
		assert.False(t, sent)
	})
}

func TestFilterOutOfChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel

	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()
	guest := th.CreateGuest()
	user4 := th.CreateUser()
	guestAndUser4Channel := th.CreateChannel(th.BasicTeam)
	defer th.App.PermanentDeleteUser(guest)
	th.LinkUserToTeam(user3, th.BasicTeam)
	th.LinkUserToTeam(user4, th.BasicTeam)
	th.LinkUserToTeam(guest, th.BasicTeam)
	th.App.AddUserToChannel(guest, channel)
	th.App.AddUserToChannel(user4, guestAndUser4Channel)
	th.App.AddUserToChannel(guest, guestAndUser4Channel)

	t.Run("should return users not in the channel", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, channel, potentialMentions)

		assert.Nil(t, err)
		assert.Len(t, outOfChannelUsers, 2)
		assert.True(t, (outOfChannelUsers[0].Id == user2.Id || outOfChannelUsers[1].Id == user2.Id))
		assert.True(t, (outOfChannelUsers[0].Id == user3.Id || outOfChannelUsers[1].Id == user3.Id))
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should return only visible users not in the channel (for guests)", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username, user4.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(guest, post, channel, potentialMentions)

		require.Nil(t, err)
		require.Len(t, outOfChannelUsers, 1)
		assert.Equal(t, user4.Id, outOfChannelUsers[0].Id)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for a system message", func(t *testing.T) {
		post := &model.Post{
			Type: model.POST_ADD_REMOVE,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, channel, potentialMentions)

		assert.Nil(t, err)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for a direct message", func(t *testing.T) {
		post := &model.Post{}
		directChannel := &model.Channel{
			Type: model.CHANNEL_DIRECT,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, directChannel, potentialMentions)

		assert.Nil(t, err)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for a group message", func(t *testing.T) {
		post := &model.Post{}
		groupChannel := &model.Channel{
			Type: model.CHANNEL_GROUP,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, groupChannel, potentialMentions)

		assert.Nil(t, err)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return inactive users", func(t *testing.T) {
		inactiveUser := th.CreateUser()
		inactiveUser, appErr := th.App.UpdateActive(inactiveUser, false)
		require.Nil(t, appErr)

		post := &model.Post{}
		potentialMentions := []string{inactiveUser.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, channel, potentialMentions)

		assert.Nil(t, err)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return bot users", func(t *testing.T) {
		botUser := th.CreateUser()
		botUser.IsBot = true

		post := &model.Post{}
		potentialMentions := []string{botUser.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, channel, potentialMentions)

		assert.Nil(t, err)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should not return results for non-existent users", func(t *testing.T) {
		post := &model.Post{}
		potentialMentions := []string{"foo", "bar"}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, channel, potentialMentions)

		assert.Nil(t, err)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
	})

	t.Run("should separate users not in the channel from users not in the group", func(t *testing.T) {
		nonChannelMember := th.CreateUser()
		th.LinkUserToTeam(nonChannelMember, th.BasicTeam)
		nonGroupMember := th.CreateUser()
		th.LinkUserToTeam(nonGroupMember, th.BasicTeam)

		group := th.CreateGroup()
		_, appErr := th.App.UpsertGroupMember(group.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.UpsertGroupMember(group.Id, nonChannelMember.Id)
		require.Nil(t, appErr)

		constrainedChannel := th.CreateChannel(th.BasicTeam)
		constrainedChannel.GroupConstrained = model.NewBool(true)
		constrainedChannel, appErr = th.App.UpdateChannel(constrainedChannel)
		require.Nil(t, appErr)

		_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
			GroupId:    group.Id,
			Type:       model.GroupSyncableTypeChannel,
			SyncableId: constrainedChannel.Id,
		})
		require.Nil(t, appErr)

		post := &model.Post{}
		potentialMentions := []string{nonChannelMember.Username, nonGroupMember.Username}

		outOfChannelUsers, outOfGroupUsers, err := th.App.filterOutOfChannelMentions(user1, post, constrainedChannel, potentialMentions)

		assert.Nil(t, err)
		assert.Len(t, outOfChannelUsers, 1)
		assert.Equal(t, nonChannelMember.Id, outOfChannelUsers[0].Id)
		assert.Len(t, outOfGroupUsers, 1)
		assert.Equal(t, nonGroupMember.Id, outOfGroupUsers[0].Id)
	})
}

func TestAllowChannelMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id}

	t.Run("should return true for a regular post with few channel members", func(t *testing.T) {
		allowChannelMentions := th.App.allowChannelMentions(post, 5)
		assert.True(t, allowChannelMentions)
	})

	t.Run("should return false for a channel header post", func(t *testing.T) {
		headerChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.POST_HEADER_CHANGE}
		allowChannelMentions := th.App.allowChannelMentions(headerChangePost, 5)
		assert.False(t, allowChannelMentions)
	})

	t.Run("should return false for a channel purpose post", func(t *testing.T) {
		purposeChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.POST_PURPOSE_CHANGE}
		allowChannelMentions := th.App.allowChannelMentions(purposeChangePost, 5)
		assert.False(t, allowChannelMentions)
	})

	t.Run("should return false for a regular post with many channel members", func(t *testing.T) {
		allowChannelMentions := th.App.allowChannelMentions(post, int(*th.App.Config().TeamSettings.MaxNotificationsPerChannel)+1)
		assert.False(t, allowChannelMentions)
	})

	t.Run("should return false for a post where the post user does not have USE_CHANNEL_MENTIONS permission", func(t *testing.T) {
		defer th.AddPermissionToRole(model.PERMISSION_USE_CHANNEL_MENTIONS.Id, model.CHANNEL_USER_ROLE_ID)
		defer th.AddPermissionToRole(model.PERMISSION_USE_CHANNEL_MENTIONS.Id, model.CHANNEL_ADMIN_ROLE_ID)
		th.RemovePermissionFromRole(model.PERMISSION_USE_CHANNEL_MENTIONS.Id, model.CHANNEL_USER_ROLE_ID)
		th.RemovePermissionFromRole(model.PERMISSION_USE_CHANNEL_MENTIONS.Id, model.CHANNEL_ADMIN_ROLE_ID)
		allowChannelMentions := th.App.allowChannelMentions(post, 5)
		assert.False(t, allowChannelMentions)
	})
}

func TestAllowGroupMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id}

	t.Run("should return false without ldap groups license", func(t *testing.T) {
		allowGroupMentions := th.App.allowGroupMentions(post)
		assert.False(t, allowGroupMentions)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap_groups"))

	t.Run("should return true for a regular post with few channel members", func(t *testing.T) {
		allowGroupMentions := th.App.allowGroupMentions(post)
		assert.True(t, allowGroupMentions)
	})

	t.Run("should return false for a channel header post", func(t *testing.T) {
		headerChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.POST_HEADER_CHANGE}
		allowGroupMentions := th.App.allowGroupMentions(headerChangePost)
		assert.False(t, allowGroupMentions)
	})

	t.Run("should return false for a channel purpose post", func(t *testing.T) {
		purposeChangePost := &model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Type: model.POST_PURPOSE_CHANGE}
		allowGroupMentions := th.App.allowGroupMentions(purposeChangePost)
		assert.False(t, allowGroupMentions)
	})

	t.Run("should return false for a post where the post user does not have USE_GROUP_MENTIONS permission", func(t *testing.T) {
		defer func() {
			th.AddPermissionToRole(model.PERMISSION_USE_GROUP_MENTIONS.Id, model.CHANNEL_USER_ROLE_ID)
			th.AddPermissionToRole(model.PERMISSION_USE_GROUP_MENTIONS.Id, model.CHANNEL_ADMIN_ROLE_ID)
		}()
		th.RemovePermissionFromRole(model.PERMISSION_USE_GROUP_MENTIONS.Id, model.CHANNEL_USER_ROLE_ID)
		th.RemovePermissionFromRole(model.PERMISSION_USE_GROUP_MENTIONS.Id, model.CHANNEL_ADMIN_ROLE_ID)
		allowGroupMentions := th.App.allowGroupMentions(post)
		assert.False(t, allowGroupMentions)
	})
}

func TestGetMentionKeywords(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// user with username or custom mentions enabled
	user1 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
		},
	}

	channelMemberNotifyPropsMap1Off := map[string]model.StringMap{
		user1.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
	}

	profiles := map[string]*model.User{user1.Id: user1}
	mentions := th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap1Off)
	require.Len(t, mentions, 3, "should've returned three mention keywords")

	ids, ok := mentions["user"]
	require.True(t, ok)
	require.Equal(t, user1.Id, ids[0], "should've returned mention key of user")
	ids, ok = mentions["@user"]
	require.True(t, ok)
	require.Equal(t, user1.Id, ids[0], "should've returned mention key of @user")
	ids, ok = mentions["mention"]
	require.True(t, ok)
	require.Equal(t, user1.Id, ids[0], "should've returned mention key of mention")

	// user with first name mention enabled
	user2 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"first_name": "true",
		},
	}

	channelMemberNotifyPropsMap2Off := map[string]model.StringMap{
		user2.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
	}

	profiles = map[string]*model.User{user2.Id: user2}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap2Off)
	require.Len(t, mentions, 2, "should've returned two mention keyword")

	ids, ok = mentions["First"]
	require.True(t, ok)
	require.Equal(t, user2.Id, ids[0], "should've returned mention key of First")

	// user with @channel/@all mentions enabled
	user3 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"channel": "true",
		},
	}

	// Channel-wide mentions are not ignored on channel level
	channelMemberNotifyPropsMap3Off := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
	}
	profiles = map[string]*model.User{user3.Id: user3}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap3Off)
	require.Len(t, mentions, 3, "should've returned three mention keywords")
	ids, ok = mentions["@channel"]
	require.True(t, ok)
	require.Equal(t, user3.Id, ids[0], "should've returned mention key of @channel")
	ids, ok = mentions["@all"]
	require.True(t, ok)
	require.Equal(t, user3.Id, ids[0], "should've returned mention key of @all")

	// Channel member notify props is set to default
	channelMemberNotifyPropsMapDefault := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_DEFAULT,
		},
	}
	profiles = map[string]*model.User{user3.Id: user3}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapDefault)
	require.Len(t, mentions, 3, "should've returned three mention keywords")
	ids, ok = mentions["@channel"]
	require.True(t, ok)
	require.Equal(t, user3.Id, ids[0], "should've returned mention key of @channel")
	ids, ok = mentions["@all"]
	require.True(t, ok)
	require.Equal(t, user3.Id, ids[0], "should've returned mention key of @all")

	// Channel member notify props is empty
	channelMemberNotifyPropsMapEmpty := map[string]model.StringMap{}
	profiles = map[string]*model.User{user3.Id: user3}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapEmpty)
	require.Len(t, mentions, 3, "should've returned three mention keywords")
	ids, ok = mentions["@channel"]
	require.True(t, ok)
	require.Equal(t, user3.Id, ids[0], "should've returned mention key of @channel")
	ids, ok = mentions["@all"]
	require.True(t, ok)
	require.Equal(t, user3.Id, ids[0], "should've returned mention key of @all")

	// Channel-wide mentions are ignored channel level
	channelMemberNotifyPropsMap3On := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_ON,
		},
	}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap3On)
	require.NotEmpty(t, mentions, "should've not returned any keywords")

	// user with all types of mentions enabled
	user4 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
			"first_name":   "true",
			"channel":      "true",
		},
	}

	// Channel-wide mentions are not ignored on channel level
	channelMemberNotifyPropsMap4Off := map[string]model.StringMap{
		user4.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
	}

	profiles = map[string]*model.User{user4.Id: user4}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap4Off)
	require.Len(t, mentions, 6, "should've returned six mention keywords")
	ids, ok = mentions["user"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of user")
	ids, ok = mentions["@user"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of @user")
	ids, ok = mentions["mention"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of mention")
	ids, ok = mentions["First"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of First")
	ids, ok = mentions["@channel"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of @channel")
	ids, ok = mentions["@all"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of @all")

	// Channel-wide mentions are ignored on channel level
	channelMemberNotifyPropsMap4On := map[string]model.StringMap{
		user4.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_ON,
		},
	}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap4On)
	require.Len(t, mentions, 4, "should've returned four mention keywords")
	ids, ok = mentions["user"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of user")
	ids, ok = mentions["@user"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of @user")
	ids, ok = mentions["mention"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of mention")
	ids, ok = mentions["First"]
	require.True(t, ok)
	require.Equal(t, user4.Id, ids[0], "should've returned mention key of First")
	dup_count := func(list []string) map[string]int {

		duplicate_frequency := make(map[string]int)

		for _, item := range list {
			// check if the item/element exist in the duplicate_frequency map

			_, exist := duplicate_frequency[item]

			if exist {
				duplicate_frequency[item] += 1 // increase counter by 1 if already in the map
			} else {
				duplicate_frequency[item] = 1 // else start counting from 1
			}
		}
		return duplicate_frequency
	}

	// multiple users but no more than MaxNotificationsPerChannel
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxNotificationsPerChannel = 4 })
	profiles = map[string]*model.User{
		user1.Id: user1,
		user2.Id: user2,
		user3.Id: user3,
		user4.Id: user4,
	}
	// Channel-wide mentions are not ignored on channel level for all users
	channelMemberNotifyPropsMap5Off := map[string]model.StringMap{
		user1.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
		user2.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
		user3.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
		user4.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
	}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap5Off)
	require.Len(t, mentions, 6, "should've returned six mention keywords")
	ids, ok = mentions["user"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != user1.Id && ids[1] != user1.Id, "should've mentioned user1  with user")
	require.False(t, ids[0] != user4.Id && ids[1] != user4.Id, "should've mentioned user4  with user")
	idsMap := dup_count(mentions["@user"])
	require.True(t, ok)
	require.Len(t, idsMap, 4)
	require.Equal(t, idsMap[user1.Id], 2, "should've mentioned user1 with @user")
	require.Equal(t, idsMap[user4.Id], 2, "should've mentioned user4 with @user")

	ids, ok = mentions["mention"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != user1.Id && ids[1] != user1.Id, "should've mentioned user1 with mention")
	require.False(t, ids[0] != user4.Id && ids[1] != user4.Id, "should've mentioned user4 with mention")
	ids, ok = mentions["First"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != user2.Id && ids[1] != user2.Id, "should've mentioned user2 with First")
	require.False(t, ids[0] != user4.Id && ids[1] != user4.Id, "should've mentioned user4 with First")
	ids, ok = mentions["@channel"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != user3.Id && ids[1] != user3.Id, "should've mentioned user3 with @channel")
	require.False(t, ids[0] != user4.Id && ids[1] != user4.Id, "should've mentioned user4 with @channel")
	ids, ok = mentions["@all"]
	require.True(t, ok)
	require.Len(t, ids, 2)
	require.False(t, ids[0] != user3.Id && ids[1] != user3.Id, "should've mentioned user3 with @all")
	require.False(t, ids[0] != user4.Id && ids[1] != user4.Id, "should've mentioned user4 with @all")

	// multiple users and more than MaxNotificationsPerChannel
	mentions = th.App.getMentionKeywordsInChannel(profiles, false, channelMemberNotifyPropsMap4Off)
	require.Len(t, mentions, 4, "should've returned four mention keywords")
	_, ok = mentions["@channel"]
	require.False(t, ok, "should not have mentioned any user with @channel")
	_, ok = mentions["@all"]
	require.False(t, ok, "should not have mentioned any user with @all")
	_, ok = mentions["@here"]
	require.False(t, ok, "should not have mentioned any user with @here")
	// no special mentions
	profiles = map[string]*model.User{
		user1.Id: user1,
	}
	mentions = th.App.getMentionKeywordsInChannel(profiles, false, channelMemberNotifyPropsMap4Off)
	require.Len(t, mentions, 3, "should've returned three mention keywords")
	ids, ok = mentions["user"]
	require.True(t, ok)
	require.Len(t, ids, 1)
	require.Equal(t, user1.Id, ids[0], "should've mentioned user1 with user")
	ids, ok = mentions["@user"]

	require.True(t, ok)
	require.Len(t, ids, 2)
	require.Equal(t, user1.Id, ids[0], "should've mentioned user1 twice with @user")
	require.Equal(t, user1.Id, ids[1], "should've mentioned user1 twice with @user")

	ids, ok = mentions["mention"]
	require.True(t, ok)
	require.Len(t, ids, 1)
	require.Equal(t, user1.Id, ids[0], "should've mentioned user1 with user")

	_, ok = mentions["First"]
	require.False(t, ok, "should not have mentioned user1 with First")
	_, ok = mentions["@channel"]
	require.False(t, ok, "should not have mentioned any user with @channel")
	_, ok = mentions["@all"]
	require.False(t, ok, "should not have mentioned any user with @all")
	_, ok = mentions["@here"]
	require.False(t, ok, "should not have mentioned any user with @here")

	// user with empty mention keys
	userNoMentionKeys := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": ",",
		},
	}

	channelMemberNotifyPropsMapEmptyOff := map[string]model.StringMap{
		userNoMentionKeys.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_OFF,
		},
	}

	profiles = map[string]*model.User{userNoMentionKeys.Id: userNoMentionKeys}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapEmptyOff)
	assert.Equal(t, 1, len(mentions), "should've returned one metion keyword")
	ids, ok = mentions["@user"]
	assert.True(t, ok)
	assert.Equal(t, userNoMentionKeys.Id, ids[0], "should've returned mention key of @user")
}

func TestAddMentionKeywordsForUser(t *testing.T) {
	t.Run("should add @user", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
		}
		channelNotifyProps := map[string]string{}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, nil, false)

		assert.Contains(t, keywords["@user"], user.Id)
	})

	t.Run("should add custom mention keywords", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.MENTION_KEYS_NOTIFY_PROP: "apple,BANANA,OrAnGe",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, nil, false)

		assert.Contains(t, keywords["apple"], user.Id)
		assert.Contains(t, keywords["banana"], user.Id)
		assert.Contains(t, keywords["orange"], user.Id)
	})

	t.Run("should not add empty custom keywords", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.MENTION_KEYS_NOTIFY_PROP: ",,",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, nil, false)

		assert.Nil(t, keywords[""])
	})

	t.Run("should add case sensitive first name if enabled", func(t *testing.T) {
		user := &model.User{
			Id:        model.NewId(),
			Username:  "user",
			FirstName: "William",
			LastName:  "Robert",
			NotifyProps: map[string]string{
				model.FIRST_NAME_NOTIFY_PROP: "true",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, nil, false)

		assert.Contains(t, keywords["William"], user.Id)
		assert.NotContains(t, keywords["william"], user.Id)
		assert.NotContains(t, keywords["Robert"], user.Id)
	})

	t.Run("should not add case sensitive first name if enabled but empty First Name", func(t *testing.T) {
		user := &model.User{
			Id:        model.NewId(),
			Username:  "user",
			FirstName: "",
			LastName:  "Robert",
			NotifyProps: map[string]string{
				model.FIRST_NAME_NOTIFY_PROP: "true",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, nil, false)

		assert.NotContains(t, keywords[""], user.Id)
	})

	t.Run("should not add case sensitive first name if disabled", func(t *testing.T) {
		user := &model.User{
			Id:        model.NewId(),
			Username:  "user",
			FirstName: "William",
			LastName:  "Robert",
			NotifyProps: map[string]string{
				model.FIRST_NAME_NOTIFY_PROP: "false",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, nil, false)

		assert.NotContains(t, keywords["William"], user.Id)
		assert.NotContains(t, keywords["william"], user.Id)
		assert.NotContains(t, keywords["Robert"], user.Id)
	})

	t.Run("should add @channel/@all/@here when allowed", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.STATUS_ONLINE,
		}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, status, true)

		assert.Contains(t, keywords["@channel"], user.Id)
		assert.Contains(t, keywords["@all"], user.Id)
		assert.Contains(t, keywords["@here"], user.Id)
	})

	t.Run("should not add @channel/@all/@here when not allowed", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.STATUS_ONLINE,
		}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, status, false)

		assert.NotContains(t, keywords["@channel"], user.Id)
		assert.NotContains(t, keywords["@all"], user.Id)
		assert.NotContains(t, keywords["@here"], user.Id)
	})

	t.Run("should not add @channel/@all/@here when disabled for user", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "false",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.STATUS_ONLINE,
		}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, status, true)

		assert.NotContains(t, keywords["@channel"], user.Id)
		assert.NotContains(t, keywords["@all"], user.Id)
		assert.NotContains(t, keywords["@here"], user.Id)
	})

	t.Run("should not add @channel/@all/@here when disabled for channel", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
			},
		}
		channelNotifyProps := map[string]string{
			model.IGNORE_CHANNEL_MENTIONS_NOTIFY_PROP: model.IGNORE_CHANNEL_MENTIONS_ON,
		}
		status := &model.Status{
			Status: model.STATUS_ONLINE,
		}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, status, true)

		assert.NotContains(t, keywords["@channel"], user.Id)
		assert.NotContains(t, keywords["@all"], user.Id)
		assert.NotContains(t, keywords["@here"], user.Id)
	})

	t.Run("should not add @channel/@all/@here when channel is muted and channel mention setting is not updated by user", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
			},
		}
		channelNotifyProps := map[string]string{
			model.MARK_UNREAD_NOTIFY_PROP:             model.USER_NOTIFY_MENTION,
			model.IGNORE_CHANNEL_MENTIONS_NOTIFY_PROP: model.IGNORE_CHANNEL_MENTIONS_DEFAULT,
		}
		status := &model.Status{
			Status: model.STATUS_ONLINE,
		}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, status, true)

		assert.NotContains(t, keywords["@channel"], user.Id)
		assert.NotContains(t, keywords["@all"], user.Id)
		assert.NotContains(t, keywords["@here"], user.Id)
	})

	t.Run("should not add @here when when user is not online", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.STATUS_AWAY,
		}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user, channelNotifyProps, status, true)

		assert.Contains(t, keywords["@channel"], user.Id)
		assert.Contains(t, keywords["@all"], user.Id)
		assert.NotContains(t, keywords["@here"], user.Id)
	})

	t.Run("should add for multiple users", func(t *testing.T) {
		user1 := &model.User{
			Id:       model.NewId(),
			Username: "user1",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
			},
		}
		user2 := &model.User{
			Id:       model.NewId(),
			Username: "user2",
			NotifyProps: map[string]string{
				model.CHANNEL_MENTIONS_NOTIFY_PROP: "true",
			},
		}

		keywords := map[string][]string{}
		addMentionKeywordsForUser(keywords, user1, map[string]string{}, nil, true)
		addMentionKeywordsForUser(keywords, user2, map[string]string{}, nil, true)

		assert.Contains(t, keywords["@user1"], user1.Id)
		assert.Contains(t, keywords["@user2"], user2.Id)
		assert.Contains(t, keywords["@all"], user1.Id)
		assert.Contains(t, keywords["@all"], user2.Id)
	})
}

func TestPostNotificationGetChannelName(t *testing.T) {
	sender := &model.User{Id: model.NewId(), Username: "sender", FirstName: "Sender", LastName: "Sender", Nickname: "Sender"}
	recipient := &model.User{Id: model.NewId(), Username: "recipient", FirstName: "Recipient", LastName: "Recipient", Nickname: "Recipient"}
	otherUser := &model.User{Id: model.NewId(), Username: "other", FirstName: "Other", LastName: "Other", Nickname: "Other"}
	profileMap := map[string]*model.User{
		sender.Id:    sender,
		recipient.Id: recipient,
		otherUser.Id: otherUser,
	}

	for name, testCase := range map[string]struct {
		channel     *model.Channel
		nameFormat  string
		recipientId string
		expected    string
	}{
		"regular channel": {
			channel:  &model.Channel{Type: model.CHANNEL_OPEN, Name: "channel", DisplayName: "My Channel"},
			expected: "My Channel",
		},
		"direct channel, unspecified": {
			channel:  &model.Channel{Type: model.CHANNEL_DIRECT},
			expected: "@sender",
		},
		"direct channel, username": {
			channel:    &model.Channel{Type: model.CHANNEL_DIRECT},
			nameFormat: model.SHOW_USERNAME,
			expected:   "@sender",
		},
		"direct channel, full name": {
			channel:    &model.Channel{Type: model.CHANNEL_DIRECT},
			nameFormat: model.SHOW_FULLNAME,
			expected:   "Sender Sender",
		},
		"direct channel, nickname": {
			channel:    &model.Channel{Type: model.CHANNEL_DIRECT},
			nameFormat: model.SHOW_NICKNAME_FULLNAME,
			expected:   "Sender",
		},
		"group channel, unspecified": {
			channel:  &model.Channel{Type: model.CHANNEL_GROUP},
			expected: "other, sender",
		},
		"group channel, username": {
			channel:    &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat: model.SHOW_USERNAME,
			expected:   "other, sender",
		},
		"group channel, full name": {
			channel:    &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat: model.SHOW_FULLNAME,
			expected:   "Other Other, Sender Sender",
		},
		"group channel, nickname": {
			channel:    &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat: model.SHOW_NICKNAME_FULLNAME,
			expected:   "Other, Sender",
		},
		"group channel, not excluding current user": {
			channel:     &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat:  model.SHOW_NICKNAME_FULLNAME,
			expected:    "Other, Sender",
			recipientId: "",
		},
	} {
		t.Run(name, func(t *testing.T) {
			notification := &PostNotification{
				Channel:    testCase.channel,
				Sender:     sender,
				ProfileMap: profileMap,
			}

			recipientId := recipient.Id
			if testCase.recipientId != "" {
				recipientId = testCase.recipientId
			}

			assert.Equal(t, testCase.expected, notification.GetChannelName(testCase.nameFormat, recipientId))
		})
	}
}

func TestPostNotificationGetSenderName(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	defaultChannel := &model.Channel{Type: model.CHANNEL_OPEN}
	defaultPost := &model.Post{Props: model.StringInterface{}}
	sender := &model.User{Id: model.NewId(), Username: "sender", FirstName: "Sender", LastName: "Sender", Nickname: "Sender"}

	overriddenPost := &model.Post{
		Props: model.StringInterface{
			"override_username": "Overridden",
			"from_webhook":      "true",
		},
	}

	for name, testCase := range map[string]struct {
		channel        *model.Channel
		post           *model.Post
		nameFormat     string
		allowOverrides bool
		expected       string
	}{
		"name format unspecified": {
			expected: "@" + sender.Username,
		},
		"name format username": {
			nameFormat: model.SHOW_USERNAME,
			expected:   "@" + sender.Username,
		},
		"name format full name": {
			nameFormat: model.SHOW_FULLNAME,
			expected:   sender.FirstName + " " + sender.LastName,
		},
		"name format nickname": {
			nameFormat: model.SHOW_NICKNAME_FULLNAME,
			expected:   sender.Nickname,
		},
		"system message": {
			post:     &model.Post{Type: model.POST_SYSTEM_MESSAGE_PREFIX + "custom"},
			expected: utils.T("system.message.name"),
		},
		"overridden username": {
			post:           overriddenPost,
			allowOverrides: true,
			expected:       overriddenPost.GetProp("override_username").(string),
		},
		"overridden username, direct channel": {
			channel:        &model.Channel{Type: model.CHANNEL_DIRECT},
			post:           overriddenPost,
			allowOverrides: true,
			expected:       "@" + sender.Username,
		},
		"overridden username, overrides disabled": {
			post:           overriddenPost,
			allowOverrides: false,
			expected:       "@" + sender.Username,
		},
	} {
		t.Run(name, func(t *testing.T) {
			channel := defaultChannel
			if testCase.channel != nil {
				channel = testCase.channel
			}

			post := defaultPost
			if testCase.post != nil {
				post = testCase.post
			}

			notification := &PostNotification{
				Channel: channel,
				Post:    post,
				Sender:  sender,
			}

			assert.Equal(t, testCase.expected, notification.GetSenderName(testCase.nameFormat, testCase.allowOverrides))
		})
	}
}

func TestGetNotificationNameFormat(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("show full name on", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowFullName = true
			*cfg.TeamSettings.TeammateNameDisplay = model.SHOW_FULLNAME
		})

		assert.Equal(t, model.SHOW_FULLNAME, th.App.GetNotificationNameFormat(th.BasicUser))
	})

	t.Run("show full name off", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PrivacySettings.ShowFullName = false
			*cfg.TeamSettings.TeammateNameDisplay = model.SHOW_FULLNAME
		})

		assert.Equal(t, model.SHOW_USERNAME, th.App.GetNotificationNameFormat(th.BasicUser))
	})
}

func TestUserAllowsEmail(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("should return true", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EMAIL_NOTIFY_PROP:       model.CHANNEL_NOTIFY_DEFAULT,
			model.MARK_UNREAD_NOTIFY_PROP: model.CHANNEL_MARK_UNREAD_ALL,
		}

		assert.True(t, th.App.userAllowsEmail(user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the status is ONLINE", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOnline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EMAIL_NOTIFY_PROP:       model.CHANNEL_NOTIFY_DEFAULT,
			model.MARK_UNREAD_NOTIFY_PROP: model.CHANNEL_MARK_UNREAD_ALL,
		}

		assert.False(t, th.App.userAllowsEmail(user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the EMAIL_NOTIFY_PROP is false", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EMAIL_NOTIFY_PROP:       "false",
			model.MARK_UNREAD_NOTIFY_PROP: model.CHANNEL_MARK_UNREAD_ALL,
		}

		assert.False(t, th.App.userAllowsEmail(user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the MARK_UNREAD_NOTIFY_PROP is CHANNEL_MARK_UNREAD_MENTION", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EMAIL_NOTIFY_PROP:       model.CHANNEL_NOTIFY_DEFAULT,
			model.MARK_UNREAD_NOTIFY_PROP: model.CHANNEL_MARK_UNREAD_MENTION,
		}

		assert.False(t, th.App.userAllowsEmail(user, channelMemberNotificationProps, &model.Post{Type: "some-post-type"}))
	})

	t.Run("should return false in case the Post type is POST_AUTO_RESPONDER", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOffline(user.Id, true)

		channelMemberNotificationProps := model.StringMap{
			model.EMAIL_NOTIFY_PROP:       model.CHANNEL_NOTIFY_DEFAULT,
			model.MARK_UNREAD_NOTIFY_PROP: model.CHANNEL_MARK_UNREAD_ALL,
		}

		assert.False(t, th.App.userAllowsEmail(user, channelMemberNotificationProps, &model.Post{Type: model.POST_AUTO_RESPONDER}))
	})

	t.Run("should return false in case the status is STATUS_OUT_OF_OFFICE", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusOutOfOffice(user.Id)

		channelMemberNotificationProps := model.StringMap{
			model.EMAIL_NOTIFY_PROP:       model.CHANNEL_NOTIFY_DEFAULT,
			model.MARK_UNREAD_NOTIFY_PROP: model.CHANNEL_MARK_UNREAD_ALL,
		}

		assert.False(t, th.App.userAllowsEmail(user, channelMemberNotificationProps, &model.Post{Type: model.POST_AUTO_RESPONDER}))
	})

	t.Run("should return false in case the status is STATUS_ONLINE", func(t *testing.T) {
		user := th.CreateUser()

		th.App.SetStatusDoNotDisturb(user.Id)

		channelMemberNotificationProps := model.StringMap{
			model.EMAIL_NOTIFY_PROP:       model.CHANNEL_NOTIFY_DEFAULT,
			model.MARK_UNREAD_NOTIFY_PROP: model.CHANNEL_MARK_UNREAD_ALL,
		}

		assert.False(t, th.App.userAllowsEmail(user, channelMemberNotificationProps, &model.Post{Type: model.POST_AUTO_RESPONDER}))
	})

}

func TestInsertGroupMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.BasicTeam
	channel := th.BasicChannel
	group := th.CreateGroup()
	group.DisplayName = "engineering"
	group.Name = model.NewString("engineering")
	group, err := th.App.UpdateGroup(group)
	require.Nil(t, err)

	groupChannelMember := th.CreateUser()
	th.LinkUserToTeam(groupChannelMember, team)
	th.App.AddUserToChannel(groupChannelMember, channel)
	_, err = th.App.UpsertGroupMember(group.Id, groupChannelMember.Id)
	require.Nil(t, err)

	nonGroupChannelMember := th.CreateUser()
	th.LinkUserToTeam(nonGroupChannelMember, team)
	th.App.AddUserToChannel(nonGroupChannelMember, channel)

	nonChannelGroupMember := th.CreateUser()
	th.LinkUserToTeam(nonChannelGroupMember, team)
	_, err = th.App.UpsertGroupMember(group.Id, nonChannelGroupMember.Id)
	require.Nil(t, err)

	groupWithNoMembers := th.CreateGroup()
	groupWithNoMembers.DisplayName = "marketing"
	groupWithNoMembers.Name = model.NewString("marketing")
	groupWithNoMembers, err = th.App.UpdateGroup(groupWithNoMembers)
	require.Nil(t, err)

	profileMap := map[string]*model.User{groupChannelMember.Id: groupChannelMember, nonGroupChannelMember.Id: nonGroupChannelMember}

	t.Run("should add expected mentions for users part of the mentioned group", func(t *testing.T) {
		mentions := &model.ExplicitMentions{}
		usersMentioned, err := th.App.insertGroupMentions(group, channel, profileMap, mentions)
		require.Nil(t, err)
		require.Equal(t, usersMentioned, true)

		// Ensure group member that is also a channel member is added to the mentions list.
		require.Equal(t, len(mentions.Mentions), 1)
		_, found := mentions.Mentions[groupChannelMember.Id]
		require.Equal(t, found, true)

		// Ensure group member that is not a channel member is added to the other potential mentions list.
		require.Equal(t, len(mentions.OtherPotentialMentions), 1)
		require.Equal(t, mentions.OtherPotentialMentions[0], nonChannelGroupMember.Username)
	})

	t.Run("should add no expected or potential mentions if the group has no users ", func(t *testing.T) {
		mentions := &model.ExplicitMentions{}
		usersMentioned, err := th.App.insertGroupMentions(groupWithNoMembers, channel, profileMap, mentions)
		require.Nil(t, err)
		require.Equal(t, usersMentioned, false)

		// Ensure no mentions are added for a group with no users
		require.Equal(t, len(mentions.Mentions), 0)
		require.Equal(t, len(mentions.OtherPotentialMentions), 0)
	})

	t.Run("should keep existing mentions", func(t *testing.T) {
		mentions := &model.ExplicitMentions{}
		th.App.insertGroupMentions(group, channel, profileMap, mentions)
		th.App.insertGroupMentions(groupWithNoMembers, channel, profileMap, mentions)

		// Ensure mentions from group are kept after running with groupWithNoMembers
		require.Equal(t, len(mentions.Mentions), 1)
		require.Equal(t, len(mentions.OtherPotentialMentions), 1)
	})

	t.Run("should return true if no members mentioned while in group or direct message channel", func(t *testing.T) {
		mentions := &model.ExplicitMentions{}
		emptyProfileMap := make(map[string]*model.User)

		groupChannel := &model.Channel{Type: model.CHANNEL_GROUP}
		usersMentioned, _ := th.App.insertGroupMentions(group, groupChannel, emptyProfileMap, mentions)
		// Ensure group channel with no group members mentioned always returns true
		require.Equal(t, usersMentioned, true)
		require.Equal(t, len(mentions.Mentions), 0)

		directChannel := &model.Channel{Type: model.CHANNEL_DIRECT}
		usersMentioned, _ = th.App.insertGroupMentions(group, directChannel, emptyProfileMap, mentions)
		// Ensure direct channel with no group members mentioned always returns true
		require.Equal(t, usersMentioned, true)
		require.Equal(t, len(mentions.Mentions), 0)
	})

	t.Run("should add mentions for members while in group channel", func(t *testing.T) {
		groupChannel, err := th.App.CreateGroupChannel([]string{groupChannelMember.Id, nonGroupChannelMember.Id, th.BasicUser.Id}, groupChannelMember.Id)
		require.Nil(t, err)

		mentions := &model.ExplicitMentions{}
		th.App.insertGroupMentions(group, groupChannel, profileMap, mentions)

		require.Equal(t, len(mentions.Mentions), 1)
		_, found := mentions.Mentions[groupChannelMember.Id]
		require.Equal(t, found, true)
	})
}

func TestGetGroupsAllowedForReferenceInChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var err *model.AppError

	team := th.BasicTeam
	channel := th.BasicChannel
	group1 := th.CreateGroup()

	t.Run("should return empty map when no groups with allow reference", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.Nil(t, nErr)
		require.Len(t, groupsMap, 0)
	})

	group1.AllowReference = true
	group1, err = th.App.UpdateGroup(group1)
	require.Nil(t, err)

	group2 := th.CreateGroup()
	t.Run("should only return groups with allow reference", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.Nil(t, nErr)
		require.Len(t, groupsMap, 1)
		require.Nil(t, groupsMap[*group2.Name])
		require.Equal(t, groupsMap[*group1.Name], group1)
	})

	group2.AllowReference = true
	group2, err = th.App.UpdateGroup(group2)
	require.Nil(t, err)

	// Sync first group to constrained channel
	constrainedChannel := th.CreateChannel(th.BasicTeam)
	constrainedChannel.GroupConstrained = model.NewBool(true)
	constrainedChannel, err = th.App.UpdateChannel(constrainedChannel)
	require.Nil(t, err)
	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group1.Id,
		Type:       model.GroupSyncableTypeChannel,
		SyncableId: constrainedChannel.Id,
	})
	require.Nil(t, err)

	t.Run("should return only groups synced to channel if channel is group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(constrainedChannel, team)
		require.Nil(t, nErr)
		require.Len(t, groupsMap, 1)
		require.Nil(t, groupsMap[*group2.Name])
		require.Equal(t, groupsMap[*group1.Name], group1)
	})

	// Create a third group not synced with a team or channel
	group3 := th.CreateGroup()
	group3.AllowReference = true
	group3, err = th.App.UpdateGroup(group3)
	require.Nil(t, err)

	// Sync group2 to the team
	team.GroupConstrained = model.NewBool(true)
	team, err = th.App.UpdateTeam(team)
	require.Nil(t, err)
	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    group2.Id,
		Type:       model.GroupSyncableTypeTeam,
		SyncableId: team.Id,
	})
	require.Nil(t, err)

	t.Run("should return union of groups synced to team and any channels if team is group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.Nil(t, nErr)
		require.Len(t, groupsMap, 2)
		require.Nil(t, groupsMap[*group3.Name])
		require.Equal(t, groupsMap[*group2.Name], group2)
		require.Equal(t, groupsMap[*group1.Name], group1)
	})

	t.Run("should return only subset of groups synced to channel for group constrained channel when team is also group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(constrainedChannel, team)
		require.Nil(t, nErr)
		require.Len(t, groupsMap, 1)
		require.Nil(t, groupsMap[*group3.Name])
		require.Nil(t, groupsMap[*group2.Name])
		require.Equal(t, groupsMap[*group1.Name], group1)
	})

	team.GroupConstrained = model.NewBool(false)
	team, err = th.App.UpdateTeam(team)
	require.Nil(t, err)

	t.Run("should return all groups when team and channel are not group constrained", func(t *testing.T) {
		groupsMap, nErr := th.App.getGroupsAllowedForReferenceInChannel(channel, team)
		require.Nil(t, nErr)
		require.Len(t, groupsMap, 3)
		require.Equal(t, groupsMap[*group1.Name], group1)
		require.Equal(t, groupsMap[*group2.Name], group2)
		require.Equal(t, groupsMap[*group3.Name], group3)
	})
}
