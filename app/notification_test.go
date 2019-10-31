// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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

	mentions, err := th.App.SendNotifications(post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil)
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

	mentions, err = th.App.SendNotifications(post2, th.BasicTeam, dm, th.BasicUser, nil)
	require.NoError(t, err)
	require.NotNil(t, mentions)

	_, appErr = th.App.UpdateActive(th.BasicUser2, false)
	require.Nil(t, appErr)
	appErr = th.App.InvalidateAllCaches()
	require.Nil(t, appErr)

	post3, appErr := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: dm.Id,
		Message:   "dm message",
	}, true)
	require.Nil(t, appErr)

	mentions, err = th.App.SendNotifications(post3, th.BasicTeam, dm, th.BasicUser, nil)
	require.NoError(t, err)
	require.NotNil(t, mentions)

	th.BasicChannel.DeleteAt = 1
	mentions, err = th.App.SendNotifications(post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil)
	require.NoError(t, err)
	require.Len(t, mentions, 0)
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
	th.LinkUserToTeam(user3, th.BasicTeam)

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

	t.Run("should not return results for non-existant users", func(t *testing.T) {
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

		_, appErr = th.App.CreateGroupSyncable(&model.GroupSyncable{
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

func TestGetExplicitMentions(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()
	id3 := model.NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*model.SlackAttachment
		Keywords    map[string][]string
		Expected    *ExplicitMentions
	}{
		"Nobody": {
			Message:  "this is a message",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"NonexistentUser": {
			Message: "this is a message for @user",
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"user"},
			},
		},
		"OnePerson": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsername": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsernameButNotSimilarName": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}, "@user.name": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonAtEndOfSentence": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithoutAtMention": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"this": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
				OtherPotentialMentions: []string{"user"},
			},
		},
		"OnePersonWithPeriodAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithPeriodBefore": {
			Message:  "this is a message for .@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithColonAfter": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithColonBefore": {
			Message:  "this is a message for :@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithHyphenAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithHyphenBefore": {
			Message:  "this is a message for -@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultiplePeopleWithOneWord": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
			},
		},
		"OneOfMultiplePeople": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultiplePeopleWithMultipleWords": {
			Message:  "this is an @mention for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
			},
		},
		"Channel": {
			Message:  "this is an message for @channel",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				ChannelMentioned: true,
			},
		},

		"ChannelWithColonAtEnd": {
			Message:  "this is a message for @channel:",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				ChannelMentioned: true,
			},
		},
		"CapitalizedChannel": {
			Message:  "this is an message for @cHaNNeL",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				ChannelMentioned: true,
			},
		},
		"All": {
			Message:  "this is an message for @all",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				AllMentioned: true,
			},
		},
		"AllWithColonAtEnd": {
			Message:  "this is a message for @all:",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				AllMentioned: true,
			},
		},
		"CapitalizedAll": {
			Message:  "this is an message for @ALL",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				AllMentioned: true,
			},
		},
		"UserWithPeriod": {
			Message:  "user.period doesn't complicate things at all by including periods in their username",
			Keywords: map[string][]string{"user.period": {id1}, "user": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"AtUserWithColonAtEnd": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"AtUserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for @user.period.",
			Keywords: map[string][]string{"@user.period": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for user.period.",
			Keywords: map[string][]string{"user.period": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UserWithColonAtEnd": {
			Message:  "this is a message for user:",
			Keywords: map[string][]string{"user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"PotentialOutOfChannelUser": {
			Message:  "this is an message for @potential and @user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
				OtherPotentialMentions: []string{"potential"},
			},
		},
		"PotentialOutOfChannelUserWithPeriod": {
			Message: "this is an message for @potential.user",
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"potential.user"},
			},
		},
		"InlineCode": {
			Message:  "`this shouldn't mention @channel at all`",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"FencedCodeBlock": {
			Message:  "```\nthis shouldn't mention @channel at all\n```",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"Emphasis": {
			Message:  "*@aaa @bbb @ccc*",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
					id3: true,
				},
			},
		},
		"StrongEmphasis": {
			Message:  "**@aaa @bbb @ccc**",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
					id3: true,
				},
			},
		},
		"Strikethrough": {
			Message:  "~~@aaa @bbb @ccc~~",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
					id3: true,
				},
			},
		},
		"Heading": {
			Message:  "### @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"BlockQuote": {
			Message:  "> @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Emoji": {
			Message:  ":smile:",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{},
		},
		"NotEmoji": {
			Message:  "smile",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UnclosedEmoji": {
			Message:  ":smile",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UnopenedEmoji": {
			Message:  "smile:",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"IndentedCodeBlock": {
			Message:  "    this shouldn't mention @channel at all",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"LinkTitle": {
			Message:  `[foo](this "shouldn't mention @channel at all")`,
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"MalformedInlineCode": {
			Message:  "`this should mention @channel``",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"MultibyteCharacter": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterAtBeginningOfSentence": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterInPartOfSentence": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterAtEndOfSentence": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterTwiceInSentence": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},

		// The following tests cover cases where the message mentions @user.name, so we shouldn't assume that
		// the user might be intending to mention some @user that isn't in the channel.
		"Don't include potential mention that's part of an actual mention (without trailing period)": {
			Message:  "this is an message for @user.name",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with trailing period)": {
			Message:  "this is an message for @user.name.",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with multiple trailing periods)": {
			Message:  "this is an message for @user.name...",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (containing and followed by multiple periods)": {
			Message:  "this is an message for @user...name...",
			Keywords: map[string][]string{"@user...name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"should include the mentions from attachment text and preText": {
			Message: "this is an message for @user1",
			Attachments: []*model.SlackAttachment{
				{
					Text:    "this is a message For @user2",
					Pretext: "this is a message for @here",
				},
			},
			Keywords: map[string][]string{"@user1": {id1}, "@user2": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				HereMentioned: true,
			},
		},
		"Name on keywords is a prefix of a mention": {
			Message:  "@other @test-two",
			Keywords: map[string][]string{"@test": {model.NewId()}},
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"other", "test-two"},
			},
		},
		"Name on mentions is a prefix of other mention": {
			Message:  "@other-one @other @other-two",
			Keywords: nil,
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"other-one", "other", "other-two"},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {

			post := &model.Post{Message: tc.Message, Props: model.StringInterface{
				"attachments": tc.Attachments,
			},
			}

			m := getExplicitMentions(post, tc.Keywords)
			if tc.Expected.MentionedUserIds == nil {
				tc.Expected.MentionedUserIds = make(map[string]bool)
			}
			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestGetExplicitMentionsAtHere(t *testing.T) {
	// test all the boundary cases that we know can break up terms (and those that we know won't)
	cases := map[string]bool{
		"":          false,
		"here":      false,
		"@here":     true,
		" @here ":   true,
		"\n@here\n": true,
		"!@here!":   true,
		"#@here#":   true,
		"$@here$":   true,
		"%@here%":   true,
		"^@here^":   true,
		"&@here&":   true,
		"*@here*":   true,
		"(@here(":   true,
		")@here)":   true,
		"-@here-":   true,
		"_@here_":   true,
		"=@here=":   true,
		"+@here+":   true,
		"[@here[":   true,
		"{@here{":   true,
		"]@here]":   true,
		"}@here}":   true,
		"\\@here\\": true,
		"|@here|":   true,
		";@here;":   true,
		"@here:":    true,
		":@here:":   false, // This case shouldn't trigger a mention since it follows the format of reactions e.g. :word:
		"'@here'":   true,
		"\"@here\"": true,
		",@here,":   true,
		"<@here<":   true,
		".@here.":   true,
		">@here>":   true,
		"/@here/":   true,
		"?@here?":   true,
		"`@here`":   false, // This case shouldn't mention since it's a code block
		"~@here~":   true,
		"@HERE":     true,
		"@hERe":     true,
	}

	for message, shouldMention := range cases {
		post := &model.Post{Message: message}
		if m := getExplicitMentions(post, nil); m.HereMentioned && !shouldMention {
			t.Fatalf("shouldn't have mentioned @here with \"%v\"", message)
		} else if !m.HereMentioned && shouldMention {
			t.Fatalf("should've mentioned @here with \"%v\"", message)
		}
	}

	// mentioning @here and someone
	id := model.NewId()
	if m := getExplicitMentions(&model.Post{Message: "@here @user @potential"}, map[string][]string{"@user": {id}}); !m.HereMentioned {
		t.Fatal("should've mentioned @here with \"@here @user\"")
	} else if len(m.MentionedUserIds) != 1 || !m.MentionedUserIds[id] {
		t.Fatal("should've mentioned @user with \"@here @user\"")
	} else if len(m.OtherPotentialMentions) > 1 {
		t.Fatal("should've potential mentions for @potential")
	}
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
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["user"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of user")
	} else if ids, ok := mentions["@user"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of @user")
	} else if ids, ok := mentions["mention"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of mention")
	}

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
	if len(mentions) != 2 {
		t.Fatal("should've returned two mention keyword")
	} else if ids, ok := mentions["First"]; !ok || ids[0] != user2.Id {
		t.Fatal("should've returned mention key of First")
	}

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
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @all")
	}

	// Channel member notify props is set to default
	channelMemberNotifyPropsMapDefault := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_DEFAULT,
		},
	}
	profiles = map[string]*model.User{user3.Id: user3}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapDefault)
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @all")
	}

	// Channel member notify props is empty
	channelMemberNotifyPropsMapEmpty := map[string]model.StringMap{}
	profiles = map[string]*model.User{user3.Id: user3}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMapEmpty)
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @all")
	}

	// Channel-wide mentions are ignored channel level
	channelMemberNotifyPropsMap3On := map[string]model.StringMap{
		user3.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_ON,
		},
	}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap3On)
	if len(mentions) == 0 {
		t.Fatal("should've not returned any keywords")
	}

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
	if len(mentions) != 6 {
		t.Fatal("should've returned six mention keywords")
	} else if ids, ok := mentions["user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of user")
	} else if ids, ok := mentions["@user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @user")
	} else if ids, ok := mentions["mention"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of mention")
	} else if ids, ok := mentions["First"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of First")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @all")
	}

	// Channel-wide mentions are ignored on channel level
	channelMemberNotifyPropsMap4On := map[string]model.StringMap{
		user4.Id: {
			"ignore_channel_mentions": model.IGNORE_CHANNEL_MENTIONS_ON,
		},
	}
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap4On)
	if len(mentions) != 4 {
		t.Fatal("should've returned four mention keywords")
	} else if ids, ok := mentions["user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of user")
	} else if ids, ok := mentions["@user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @user")
	} else if ids, ok := mentions["mention"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of mention")
	} else if ids, ok := mentions["First"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of First")
	}

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
	if len(mentions) != 6 {
		t.Fatal("should've returned six mention keywords")
	} else if ids, ok := mentions["user"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with user")
	} else if ids := dup_count(mentions["@user"]); len(ids) != 4 || (ids[user1.Id] != 2) || (ids[user4.Id] != 2) {
		t.Fatal("should've mentioned user1 and user4 with @user")
	} else if ids, ok := mentions["mention"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with mention")
	} else if ids, ok := mentions["First"]; !ok || len(ids) != 2 || (ids[0] != user2.Id && ids[1] != user2.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user2 and user4 with First")
	} else if ids, ok := mentions["@channel"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @channel")
	} else if ids, ok := mentions["@all"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @all")
	}

	// multiple users and more than MaxNotificationsPerChannel
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxNotificationsPerChannel = 3 })
	mentions = th.App.getMentionKeywordsInChannel(profiles, true, channelMemberNotifyPropsMap4Off)
	if len(mentions) != 4 {
		t.Fatal("should've returned four mention keywords")
	} else if _, ok := mentions["@channel"]; ok {
		t.Fatal("should not have mentioned any user with @channel")
	} else if _, ok := mentions["@all"]; ok {
		t.Fatal("should not have mentioned any user with @all")
	} else if _, ok := mentions["@here"]; ok {
		t.Fatal("should not have mentioned any user with @here")
	}

	// no special mentions
	profiles = map[string]*model.User{
		user1.Id: user1,
	}
	mentions = th.App.getMentionKeywordsInChannel(profiles, false, channelMemberNotifyPropsMap4Off)
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["user"]; !ok || len(ids) != 1 || ids[0] != user1.Id {
		t.Fatal("should've mentioned user1 with user")
	} else if ids, ok := mentions["@user"]; !ok || len(ids) != 2 || ids[0] != user1.Id || ids[1] != user1.Id {
		t.Fatal("should've mentioned user1 twice with @user")
	} else if ids, ok := mentions["mention"]; !ok || len(ids) != 1 || ids[0] != user1.Id {
		t.Fatal("should've mentioned user1 with mention")
	} else if _, ok := mentions["First"]; ok {
		t.Fatal("should not have mentioned user1 with First")
	} else if _, ok := mentions["@channel"]; ok {
		t.Fatal("should not have mentioned any user with @channel")
	} else if _, ok := mentions["@all"]; ok {
		t.Fatal("should not have mentioned any user with @all")
	} else if _, ok := mentions["@here"]; ok {
		t.Fatal("should not have mentioned any user with @here")
	}

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
	ids, ok := mentions["@user"]
	assert.True(t, ok)
	assert.Equal(t, userNoMentionKeys.Id, ids[0], "should've returned mention key of @user")
}

func TestGetMentionsEnabledFields(t *testing.T) {

	attachmentWithTextAndPreText := model.SlackAttachment{
		Text:    "@here with mentions",
		Pretext: "@Channel some comment for the channel",
	}

	attachmentWithOutPreText := model.SlackAttachment{
		Text: "some text",
	}
	attachments := []*model.SlackAttachment{
		&attachmentWithTextAndPreText,
		&attachmentWithOutPreText,
	}

	post := &model.Post{
		Message: "This is the message",
		Props: model.StringInterface{
			"attachments": attachments,
		},
	}
	expectedFields := []string{
		"This is the message",
		"@Channel some comment for the channel",
		"@here with mentions",
		"some text"}

	mentionEnabledFields := getMentionsEnabledFields(post)

	assert.EqualValues(t, 4, len(mentionEnabledFields))
	assert.EqualValues(t, expectedFields, mentionEnabledFields)
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
			notification := &postNotification{
				channel:    testCase.channel,
				sender:     sender,
				profileMap: profileMap,
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
			expected:       overriddenPost.Props["override_username"].(string),
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

			notification := &postNotification{
				channel: channel,
				post:    post,
				sender:  sender,
			}

			assert.Equal(t, testCase.expected, notification.GetSenderName(testCase.nameFormat, testCase.allowOverrides))
		})
	}
}

func TestIsKeywordMultibyte(t *testing.T) {
	id1 := model.NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*model.SlackAttachment
		Keywords    map[string][]string
		Expected    *ExplicitMentions
	}{
		"MultibyteCharacter": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterWithNoUser": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
		},
		"MultibyteCharacterAtBeginningOfSentence": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterAtBeginningOfSentenceWithNoUser": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
		},
		"MultibyteCharacterInPartOfSentence": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterInPartOfSentenceWithNoUser": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
		},
		"MultibyteCharacterAtEndOfSentence": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterAtEndOfSentenceWithNoUser": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
		},
		"MultibyteCharacterTwiceInSentence": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultibyteCharacterTwiceInSentenceWithNoUser": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {

			post := &model.Post{Message: tc.Message, Props: model.StringInterface{
				"attachments": tc.Attachments,
			},
			}

			m := getExplicitMentions(post, tc.Keywords)
			if tc.Expected.MentionedUserIds == nil {
				tc.Expected.MentionedUserIds = make(map[string]bool)
			}
			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestAddMentionedUsers(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()
	id3 := model.NewId()
	id4 := model.NewId()
	id5 := model.NewId()
	id6 := model.NewId()
	id7 := model.NewId()
	id8 := model.NewId()
	id9 := model.NewId()

	for name, tc := range map[string]struct {
		Mentions         []string
		ExplicitMentions *ExplicitMentions
		Expected         *ExplicitMentions
	}{
		"test": {
			Mentions: []string{id1},
			ExplicitMentions: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"two users": {
			Mentions: []string{id1, id2},
			ExplicitMentions: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
			},
		},
		"no users": {
			Mentions: []string{},
			ExplicitMentions: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
		},
		"five users": {
			Mentions: []string{id1, id5, id4, id8, id9},
			ExplicitMentions: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id4: true,
					id5: true,
					id8: true,
					id9: true,
				},
			},
		},
		"nine users": {
			Mentions: []string{id1, id2, id3, id4, id5, id6, id7, id8, id9},
			ExplicitMentions: &ExplicitMentions{
				MentionedUserIds: map[string]bool{},
			},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
					id3: true,
					id4: true,
					id5: true,
					id6: true,
					id7: true,
					id8: true,
					id9: true,
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			tc.ExplicitMentions.addMentionedUsers(tc.Mentions)
			if tc.ExplicitMentions.MentionedUserIds == nil {
				tc.ExplicitMentions.MentionedUserIds = make(map[string]bool)
			}
			assert.EqualValues(t, tc.Expected.MentionedUserIds, tc.ExplicitMentions.MentionedUserIds)
		})
	}
}

func TestCheckForMentionUsers(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()

	for name, tc := range map[string]struct {
		Word        string
		Attachments []*model.SlackAttachment
		Keywords    map[string][]string
		Expected    *ExplicitMentions
	}{
		"Nobody": {
			Word:     "nothing",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"UppercaseUser1": {
			Word:     "@User",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"LowercaseUser1": {
			Word:     "@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"LowercaseUser2": {
			Word:     "@user2",
			Keywords: map[string][]string{"@user2": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id2: true,
				},
			},
		},
		"UppercaseUser2": {
			Word:     "@UsEr2",
			Keywords: map[string][]string{"@user2": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id2: true,
				},
			},
		},
		"HereMention": {
			Word: "@here",
			Expected: &ExplicitMentions{
				HereMentioned: true,
			},
		},
		"ChannelMention": {
			Word: "@channel",
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"AllMention": {
			Word: "@all",
			Expected: &ExplicitMentions{
				AllMentioned: true,
			},
		},
		"UppercaseHere": {
			Word: "@HeRe",
			Expected: &ExplicitMentions{
				HereMentioned: true,
			},
		},
		"UppercaseChannel": {
			Word: "@ChaNNel",
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"UppercaseAll": {
			Word: "@ALL",
			Expected: &ExplicitMentions{
				AllMentioned: true,
			},
		},
	} {
		t.Run(name, func(t *testing.T) {

			e := &ExplicitMentions{
				MentionedUserIds: make(map[string]bool),
			}
			e.checkForMention(tc.Word, tc.Keywords)
			if tc.Expected.MentionedUserIds == nil {
				tc.Expected.MentionedUserIds = make(map[string]bool)
			}
			assert.EqualValues(t, tc.Expected, e)
		})
	}
}
func TestProcessText(t *testing.T) {
	id1 := model.NewId()

	for name, tc := range map[string]struct {
		Text     string
		Keywords map[string][]string
		Expected *ExplicitMentions
	}{
		"Mention user in text": {
			Text:     "hello user @user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Mention user after ending a sentence with full stop": {
			Text:     "hello user.@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Mention user after hyphen": {
			Text:     "hello user-@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Mention user after colon": {
			Text:     "hello user:@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Mention here after colon": {
			Text:     "hello all:@here",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{
				HereMentioned: true,
			},
		},
		"Mention all after hyphen": {
			Text:     "hello all-@all",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{
				AllMentioned: true,
			},
		},
		"Mention channel after full stop": {
			Text:     "hello channel.@channel",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"Mention other pontential users or system calls": {
			Text:     "hello @potentialuser and @otherpotentialuser",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"potentialuser", "otherpotentialuser"},
			},
		},
		"Mention a user and another pontential users or system calls": {
			Text:     "@user1, you can use @systembot to get help",
			Keywords: map[string][]string{"@user1": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
				OtherPotentialMentions: []string{"systembot"},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {

			e := &ExplicitMentions{
				MentionedUserIds: make(map[string]bool),
			}
			if tc.Expected.MentionedUserIds == nil {
				tc.Expected.MentionedUserIds = make(map[string]bool)
			}
			e.processText(tc.Text, tc.Keywords)
			assert.EqualValues(t, tc.Expected, e)
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
	th := Setup(t).InitBasic()
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
