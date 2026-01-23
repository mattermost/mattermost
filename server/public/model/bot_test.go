// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBotTrace(t *testing.T) {
	bot := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 1,
		CreateAt:       2,
		UpdateAt:       3,
		DeleteAt:       4,
	}

	require.Equal(t, map[string]any{"user_id": bot.UserId}, bot.Trace())
}

func TestBotClone(t *testing.T) {
	bot := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 1,
		CreateAt:       2,
		UpdateAt:       3,
		DeleteAt:       4,
	}

	clone := bot.Clone()

	require.Equal(t, bot, bot.Clone())
	require.False(t, bot == clone)
}

func TestBotIsValid(t *testing.T) {
	testCases := []struct {
		Description     string
		Bot             *Bot
		ExpectedIsValid bool
	}{
		{
			"nil bot",
			&Bot{},
			false,
		},
		{
			"bot with missing user id",
			&Bot{
				UserId:         "",
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot with invalid user id",
			&Bot{
				UserId:         "invalid",
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot with missing username",
			&Bot{
				UserId:         NewId(),
				Username:       "",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot with invalid username",
			&Bot{
				UserId:         NewId(),
				Username:       "a@",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot with long description",
			&Bot{
				UserId:         "",
				Username:       "username",
				DisplayName:    "display name",
				Description:    strings.Repeat("x", 1025),
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot with missing creator id",
			&Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        "",
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot without create at timestamp",
			&Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       0,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot without update at timestamp",
			&Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       0,
				DeleteAt:       4,
			},
			false,
		},
		{
			"bot",
			&Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       0,
			},
			true,
		},
		{
			"bot without description",
			&Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       0,
			},
			true,
		},
		{
			"deleted bot",
			&Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "a description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			if testCase.ExpectedIsValid {
				require.Nil(t, testCase.Bot.IsValid())
			} else {
				require.NotNil(t, testCase.Bot.IsValid())
			}
		})
	}
}

func TestBotPreSave(t *testing.T) {
	bot := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 0,
		DeleteAt:       0,
	}

	originalBot := &Bot{
		UserId:         bot.UserId,
		Username:       bot.Username,
		DisplayName:    bot.DisplayName,
		Description:    bot.Description,
		OwnerId:        bot.OwnerId,
		LastIconUpdate: bot.LastIconUpdate,
		DeleteAt:       bot.DeleteAt,
	}

	bot.PreSave()
	assert.NotEqual(t, 0, bot.CreateAt)
	assert.NotEqual(t, 0, bot.UpdateAt)

	originalBot.CreateAt = bot.CreateAt
	originalBot.UpdateAt = bot.UpdateAt
	assert.Equal(t, originalBot, bot)
}

func TestBotPreUpdate(t *testing.T) {
	bot := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 1,
		CreateAt:       2,
		DeleteAt:       0,
	}

	originalBot := &Bot{
		UserId:         bot.UserId,
		Username:       bot.Username,
		DisplayName:    bot.DisplayName,
		Description:    bot.Description,
		OwnerId:        bot.OwnerId,
		LastIconUpdate: bot.LastIconUpdate,
		DeleteAt:       bot.DeleteAt,
	}

	bot.PreSave()
	assert.NotEqual(t, 0, bot.UpdateAt)

	originalBot.CreateAt = bot.CreateAt
	originalBot.UpdateAt = bot.UpdateAt
	assert.Equal(t, originalBot, bot)
}

func TestBotEtag(t *testing.T) {
	t.Run("same etags", func(t *testing.T) {
		bot1 := &Bot{
			UserId:         NewId(),
			Username:       "username",
			DisplayName:    "display name",
			Description:    "description",
			OwnerId:        NewId(),
			LastIconUpdate: 1,
			CreateAt:       2,
			UpdateAt:       3,
			DeleteAt:       4,
		}
		bot2 := bot1

		assert.Equal(t, bot1.Etag(), bot2.Etag())
	})
	t.Run("different etags", func(t *testing.T) {
		t.Run("different user id", func(t *testing.T) {
			bot1 := &Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			}
			bot2 := &Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        bot1.OwnerId,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			}

			assert.NotEqual(t, bot1.Etag(), bot2.Etag())
		})
		t.Run("different update at", func(t *testing.T) {
			bot1 := &Bot{
				UserId:         NewId(),
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        NewId(),
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			}
			bot2 := &Bot{
				UserId:         bot1.UserId,
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        bot1.OwnerId,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       10,
				DeleteAt:       4,
			}

			assert.NotEqual(t, bot1.Etag(), bot2.Etag())
		})
	})
}

func TestBotPatch(t *testing.T) {
	userId1 := NewId()
	creatorId1 := NewId()

	testCases := []struct {
		Description string
		Bot         *Bot
		BotPatch    *BotPatch
		ExpectedBot *Bot
	}{
		{
			"no update",
			&Bot{
				UserId:         userId1,
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        creatorId1,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			&BotPatch{},
			&Bot{
				UserId:         userId1,
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        creatorId1,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
		},
		{
			"partial update",
			&Bot{
				UserId:         userId1,
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        creatorId1,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			&BotPatch{
				Username:    NewPointer("new_username"),
				DisplayName: nil,
				Description: NewPointer("new description"),
			},
			&Bot{
				UserId:         userId1,
				Username:       "new_username",
				DisplayName:    "display name",
				Description:    "new description",
				OwnerId:        creatorId1,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
		},
		{
			"full update",
			&Bot{
				UserId:         userId1,
				Username:       "username",
				DisplayName:    "display name",
				Description:    "description",
				OwnerId:        creatorId1,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
			&BotPatch{
				Username:    NewPointer("new_username"),
				DisplayName: NewPointer("new display name"),
				Description: NewPointer("new description"),
			},
			&Bot{
				UserId:         userId1,
				Username:       "new_username",
				DisplayName:    "new display name",
				Description:    "new description",
				OwnerId:        creatorId1,
				LastIconUpdate: 1,
				CreateAt:       2,
				UpdateAt:       3,
				DeleteAt:       4,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			testCase.Bot.Patch(testCase.BotPatch)
			assert.Equal(t, testCase.ExpectedBot, testCase.Bot)
		})
	}
}

func TestBotWouldPatch(t *testing.T) {
	b := &Bot{
		UserId: NewId(),
	}

	t.Run("nil patch", func(t *testing.T) {
		ok := b.WouldPatch(nil)
		require.False(t, ok)
	})

	t.Run("nil patch fields", func(t *testing.T) {
		patch := &BotPatch{}
		ok := b.WouldPatch(patch)
		require.False(t, ok)
	})

	t.Run("patch", func(t *testing.T) {
		patch := &BotPatch{
			DisplayName: NewPointer("BotName"),
		}
		ok := b.WouldPatch(patch)
		require.True(t, ok)
	})

	t.Run("no patch", func(t *testing.T) {
		patch := &BotPatch{
			DisplayName: NewPointer("BotName"),
		}
		b.Patch(patch)
		ok := b.WouldPatch(patch)
		require.False(t, ok)
	})
}

func TestUserFromBot(t *testing.T) {
	bot1 := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 1,
		CreateAt:       2,
		UpdateAt:       3,
		DeleteAt:       4,
	}

	bot2 := &Bot{
		UserId:         NewId(),
		Username:       "username2",
		DisplayName:    "display name 2",
		Description:    "description 2",
		OwnerId:        NewId(),
		LastIconUpdate: 5,
		CreateAt:       6,
		UpdateAt:       7,
		DeleteAt:       8,
	}

	assert.Equal(t, &User{
		Id:        bot1.UserId,
		Username:  "username",
		Email:     "username@localhost",
		FirstName: "display name",
		Roles:     "system_user",
	}, UserFromBot(bot1))
	assert.Equal(t, &User{
		Id:        bot2.UserId,
		Username:  "username2",
		Email:     "username2@localhost",
		FirstName: "display name 2",
		Roles:     "system_user",
	}, UserFromBot(bot2))
}

func TestBotFromUser(t *testing.T) {
	user := &User{
		Id:       NewId(),
		Username: "username",
		CreateAt: 1,
		UpdateAt: 2,
		DeleteAt: 3,
	}

	assert.Equal(t, &Bot{
		OwnerId:     user.Id,
		UserId:      user.Id,
		Username:    "username",
		DisplayName: "username",
	}, BotFromUser(user))
}

func TestBotListEtag(t *testing.T) {
	bot1 := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 1,
		CreateAt:       2,
		UpdateAt:       3,
		DeleteAt:       4,
	}

	bot1Updated := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 1,
		CreateAt:       2,
		UpdateAt:       10,
		DeleteAt:       4,
	}

	bot2 := &Bot{
		UserId:         NewId(),
		Username:       "username",
		DisplayName:    "display name",
		Description:    "description",
		OwnerId:        NewId(),
		LastIconUpdate: 5,
		CreateAt:       6,
		UpdateAt:       7,
		DeleteAt:       8,
	}

	testCases := []struct {
		Description   string
		BotListA      BotList
		BotListB      BotList
		ExpectedEqual bool
	}{
		{
			"empty lists",
			BotList{},
			BotList{},
			true,
		},
		{
			"single item, same list",
			BotList{bot1},
			BotList{bot1},
			true,
		},
		{
			"single item, different update at",
			BotList{bot1},
			BotList{bot1Updated},
			false,
		},
		{
			"single item vs. multiple items",
			BotList{bot1},
			BotList{bot1, bot2},
			false,
		},
		{
			"multiple items, different update at",
			BotList{bot1, bot2},
			BotList{bot1Updated, bot2},
			false,
		},
		{
			"multiple items, same list",
			BotList{bot1, bot2},
			BotList{bot1, bot2},
			true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			if testCase.ExpectedEqual {
				assert.Equal(t, testCase.BotListA.Etag(), testCase.BotListB.Etag())
			} else {
				assert.NotEqual(t, testCase.BotListA.Etag(), testCase.BotListB.Etag())
			}
		})
	}
}

func TestIsBotChannel(t *testing.T) {
	for _, test := range []struct {
		Name     string
		Channel  *Channel
		Expected bool
	}{
		{
			Name:     "not a direct channel",
			Channel:  &Channel{Type: ChannelTypeOpen},
			Expected: false,
		},
		{
			Name: "a direct channel with another user",
			Channel: &Channel{
				Name: GetDMNameFromIds("user1", "user2"),
				Type: ChannelTypeDirect,
			},
			Expected: false,
		},
		{
			Name: "a direct channel with the name containing the bot's ID first",
			Channel: &Channel{
				Name: GetDMNameFromIds("botUserID", "user2"),
				Type: ChannelTypeDirect,
			},
			Expected: true,
		},
		{
			Name: "a direct channel with the name containing the bot's ID second",
			Channel: &Channel{
				Name: GetDMNameFromIds("user1", "botUserID"),
				Type: ChannelTypeDirect,
			},
			Expected: true,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			assert.Equal(t, test.Expected, IsBotDMChannel(test.Channel, "botUserID"))
		})
	}
}
