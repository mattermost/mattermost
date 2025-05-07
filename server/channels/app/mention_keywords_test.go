// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func mapsToMentionKeywords(userKeywords map[string][]string, groups map[string]*model.Group) MentionKeywords {
	keywords := make(MentionKeywords, len(userKeywords)+len(groups))

	for keyword, ids := range userKeywords {
		for _, id := range ids {
			keywords[keyword] = append(keywords[keyword], mentionableUserID(id))
		}
	}

	for _, group := range groups {
		keyword := "@" + *group.Name
		keywords[keyword] = append(keywords[keyword], mentionableGroupID(group.Id))
	}

	return keywords
}

func TestMentionKeywords_AddUserProfile(t *testing.T) {
	t.Run("should add @user", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
		}
		channelNotifyProps := map[string]string{}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, nil, false)

		assert.Contains(t, keywords["@user"], mentionableUserID(user.Id))
	})

	t.Run("should add custom mention keywords", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.MentionKeysNotifyProp: "apple,BANANA,OrAnGe",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, nil, false)

		assert.Contains(t, keywords["apple"], mentionableUserID(user.Id))
		assert.Contains(t, keywords["banana"], mentionableUserID(user.Id))
		assert.Contains(t, keywords["orange"], mentionableUserID(user.Id))
	})

	t.Run("should not add empty custom keywords", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.MentionKeysNotifyProp: ",,",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, nil, false)

		assert.Nil(t, keywords[""])
	})

	t.Run("should add case sensitive first name if enabled", func(t *testing.T) {
		user := &model.User{
			Id:        model.NewId(),
			Username:  "user",
			FirstName: "William",
			LastName:  "Robert",
			NotifyProps: map[string]string{
				model.FirstNameNotifyProp: "true",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, nil, false)

		assert.Contains(t, keywords["William"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["william"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["Robert"], mentionableUserID(user.Id))
	})

	t.Run("should not add case sensitive first name if enabled but empty First Name", func(t *testing.T) {
		user := &model.User{
			Id:        model.NewId(),
			Username:  "user",
			FirstName: "",
			LastName:  "Robert",
			NotifyProps: map[string]string{
				model.FirstNameNotifyProp: "true",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, nil, false)

		assert.NotContains(t, keywords[""], mentionableUserID(user.Id))
	})

	t.Run("should not add case sensitive first name if disabled", func(t *testing.T) {
		user := &model.User{
			Id:        model.NewId(),
			Username:  "user",
			FirstName: "William",
			LastName:  "Robert",
			NotifyProps: map[string]string{
				model.FirstNameNotifyProp: "false",
			},
		}
		channelNotifyProps := map[string]string{}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, nil, false)

		assert.NotContains(t, keywords["William"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["william"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["Robert"], mentionableUserID(user.Id))
	})

	t.Run("should add @channel/@all/@here when allowed", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "true",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.StatusOnline,
		}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, status, true)

		assert.Contains(t, keywords["@channel"], mentionableUserID(user.Id))
		assert.Contains(t, keywords["@all"], mentionableUserID(user.Id))
		assert.Contains(t, keywords["@here"], mentionableUserID(user.Id))
	})

	t.Run("should not add @channel/@all/@here when not allowed", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "true",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.StatusOnline,
		}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, status, false)

		assert.NotContains(t, keywords["@channel"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@all"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@here"], mentionableUserID(user.Id))
	})

	t.Run("should not add @channel/@all/@here when disabled for user", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "false",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.StatusOnline,
		}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, status, true)

		assert.NotContains(t, keywords["@channel"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@all"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@here"], mentionableUserID(user.Id))
	})

	t.Run("should not add @channel/@all/@here when disabled for channel", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "true",
			},
		}
		channelNotifyProps := map[string]string{
			model.IgnoreChannelMentionsNotifyProp: model.IgnoreChannelMentionsOn,
		}
		status := &model.Status{
			Status: model.StatusOnline,
		}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, status, true)

		assert.NotContains(t, keywords["@channel"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@all"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@here"], mentionableUserID(user.Id))
	})

	t.Run("should not add @channel/@all/@here when channel is muted and channel mention setting is not updated by user", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "true",
			},
		}
		channelNotifyProps := map[string]string{
			model.MarkUnreadNotifyProp:            model.UserNotifyMention,
			model.IgnoreChannelMentionsNotifyProp: model.IgnoreChannelMentionsDefault,
		}
		status := &model.Status{
			Status: model.StatusOnline,
		}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, status, true)

		assert.NotContains(t, keywords["@channel"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@all"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@here"], mentionableUserID(user.Id))
	})

	t.Run("should not add @here when when user is not online", func(t *testing.T) {
		user := &model.User{
			Id:       model.NewId(),
			Username: "user",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "true",
			},
		}
		channelNotifyProps := map[string]string{}
		status := &model.Status{
			Status: model.StatusAway,
		}

		keywords := MentionKeywords{}
		keywords.AddUser(user, channelNotifyProps, status, true)

		assert.Contains(t, keywords["@channel"], mentionableUserID(user.Id))
		assert.Contains(t, keywords["@all"], mentionableUserID(user.Id))
		assert.NotContains(t, keywords["@here"], mentionableUserID(user.Id))
	})

	t.Run("should add for multiple users", func(t *testing.T) {
		user1 := &model.User{
			Id:       model.NewId(),
			Username: "user1",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "true",
			},
		}
		user2 := &model.User{
			Id:       model.NewId(),
			Username: "user2",
			NotifyProps: map[string]string{
				model.ChannelMentionsNotifyProp: "true",
			},
		}

		keywords := MentionKeywords{}
		keywords.AddUser(user1, map[string]string{}, nil, true)
		keywords.AddUser(user2, map[string]string{}, nil, true)

		assert.Contains(t, keywords["@user1"], mentionableUserID(user1.Id))
		assert.Contains(t, keywords["@user2"], mentionableUserID(user2.Id))
		assert.Contains(t, keywords["@all"], mentionableUserID(user1.Id))
		assert.Contains(t, keywords["@all"], mentionableUserID(user2.Id))
	})
}
