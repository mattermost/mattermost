// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBotTrace(t *testing.T) {
	bot := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    1,
		UpdateAt:    2,
		DeleteAt:    3,
	}

	require.Equal(t, map[string]interface{}{"user_id": bot.UserId}, bot.Trace())
}

func TestBotClone(t *testing.T) {
	bot := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    1,
		UpdateAt:    2,
		DeleteAt:    3,
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
				UserId:      "",
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot with invalid user id",
			&Bot{
				UserId:      "invalid",
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot with missing username",
			&Bot{
				UserId:      NewId(),
				Username:    "",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot with invalid username",
			&Bot{
				UserId:      NewId(),
				Username:    "a@",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot with long description",
			&Bot{
				UserId:      "",
				Username:    "username",
				DisplayName: "display name",
				Description: strings.Repeat("x", 1025),
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot with missing creator id",
			&Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     "",
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot without create at timestamp",
			&Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    0,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot without update at timestamp",
			&Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    0,
				DeleteAt:    3,
			},
			false,
		},
		{
			"bot",
			&Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    0,
			},
			true,
		},
		{
			"bot without description",
			&Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    0,
			},
			true,
		},
		{
			"deleted bot",
			&Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "a description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
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
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		DeleteAt:    0,
	}

	originalBot := &*bot

	bot.PreSave()
	assert.NotEqual(t, 0, bot.CreateAt)
	assert.NotEqual(t, 0, bot.UpdateAt)

	originalBot.CreateAt = bot.CreateAt
	originalBot.UpdateAt = bot.UpdateAt
	assert.Equal(t, originalBot, bot)
}

func TestBotPreUpdate(t *testing.T) {
	bot := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    1,
		DeleteAt:    0,
	}

	originalBot := &*bot

	bot.PreSave()
	assert.NotEqual(t, 0, bot.UpdateAt)

	originalBot.UpdateAt = bot.UpdateAt
	assert.Equal(t, originalBot, bot)
}

func TestBotEtag(t *testing.T) {
	t.Run("same etags", func(t *testing.T) {
		bot1 := &Bot{
			UserId:      NewId(),
			Username:    "username",
			DisplayName: "display name",
			Description: "description",
			OwnerId:     NewId(),
			CreateAt:    1,
			UpdateAt:    2,
			DeleteAt:    3,
		}
		bot2 := bot1

		assert.Equal(t, bot1.Etag(), bot2.Etag())
	})
	t.Run("different etags", func(t *testing.T) {
		t.Run("different user id", func(t *testing.T) {
			bot1 := &Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			}
			bot2 := &Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     bot1.OwnerId,
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			}

			assert.NotEqual(t, bot1.Etag(), bot2.Etag())
		})
		t.Run("different update at", func(t *testing.T) {
			bot1 := &Bot{
				UserId:      NewId(),
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     NewId(),
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			}
			bot2 := &Bot{
				UserId:      bot1.UserId,
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     bot1.OwnerId,
				CreateAt:    1,
				UpdateAt:    10,
				DeleteAt:    3,
			}

			assert.NotEqual(t, bot1.Etag(), bot2.Etag())
		})
	})
}

func TestBotToAndFromJson(t *testing.T) {
	bot1 := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    1,
		UpdateAt:    2,
		DeleteAt:    3,
	}

	bot2 := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description 2",
		OwnerId:     NewId(),
		CreateAt:    4,
		UpdateAt:    5,
		DeleteAt:    6,
	}

	assert.Equal(t, bot1, BotFromJson(bytes.NewReader(bot1.ToJson())))
	assert.Equal(t, bot2, BotFromJson(bytes.NewReader(bot2.ToJson())))
}

func sToP(s string) *string {
	return &s
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
				UserId:      userId1,
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     creatorId1,
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			&BotPatch{},
			&Bot{
				UserId:      userId1,
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     creatorId1,
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
		},
		{
			"partial update",
			&Bot{
				UserId:      userId1,
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     creatorId1,
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			&BotPatch{
				Username:    sToP("new_username"),
				DisplayName: nil,
				Description: sToP("new description"),
			},
			&Bot{
				UserId:      userId1,
				Username:    "new_username",
				DisplayName: "display name",
				Description: "new description",
				OwnerId:     creatorId1,
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
		},
		{
			"full update",
			&Bot{
				UserId:      userId1,
				Username:    "username",
				DisplayName: "display name",
				Description: "description",
				OwnerId:     creatorId1,
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
			},
			&BotPatch{
				Username:    sToP("new_username"),
				DisplayName: sToP("new display name"),
				Description: sToP("new description"),
			},
			&Bot{
				UserId:      userId1,
				Username:    "new_username",
				DisplayName: "new display name",
				Description: "new description",
				OwnerId:     creatorId1,
				CreateAt:    1,
				UpdateAt:    2,
				DeleteAt:    3,
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

func TestBotPatchToAndFromJson(t *testing.T) {
	botPatch1 := &BotPatch{
		Username:    sToP("username"),
		DisplayName: sToP("display name"),
		Description: sToP("description"),
	}

	botPatch2 := &BotPatch{
		Username:    sToP("username"),
		DisplayName: sToP("display name"),
		Description: sToP("description 2"),
	}

	assert.Equal(t, botPatch1, BotPatchFromJson(bytes.NewReader(botPatch1.ToJson())))
	assert.Equal(t, botPatch2, BotPatchFromJson(bytes.NewReader(botPatch2.ToJson())))
}

func TestUserFromBot(t *testing.T) {
	bot1 := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    1,
		UpdateAt:    2,
		DeleteAt:    3,
	}

	bot2 := &Bot{
		UserId:      NewId(),
		Username:    "username2",
		DisplayName: "display name 2",
		Description: "description 2",
		OwnerId:     NewId(),
		CreateAt:    4,
		UpdateAt:    5,
		DeleteAt:    6,
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

func TestBotListToAndFromJson(t *testing.T) {
	testCases := []struct {
		Description string
		BotList     BotList
	}{
		{
			"empty list",
			BotList{},
		},
		{
			"single item",
			BotList{
				&Bot{
					UserId:      NewId(),
					Username:    "username",
					DisplayName: "display name",
					Description: "description",
					OwnerId:     NewId(),
					CreateAt:    1,
					UpdateAt:    2,
					DeleteAt:    3,
				},
			},
		},
		{
			"multiple items",
			BotList{
				&Bot{
					UserId:      NewId(),
					Username:    "username",
					DisplayName: "display name",
					Description: "description",
					OwnerId:     NewId(),
					CreateAt:    1,
					UpdateAt:    2,
					DeleteAt:    3,
				},

				&Bot{
					UserId:      NewId(),
					Username:    "username",
					DisplayName: "display name",
					Description: "description 2",
					OwnerId:     NewId(),
					CreateAt:    4,
					UpdateAt:    5,
					DeleteAt:    6,
				},
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			assert.Equal(t, testCase.BotList, BotListFromJson(bytes.NewReader(testCase.BotList.ToJson())))
		})
	}
}

func TestBotListEtag(t *testing.T) {
	bot1 := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    1,
		UpdateAt:    2,
		DeleteAt:    3,
	}

	bot1Updated := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    1,
		UpdateAt:    10,
		DeleteAt:    3,
	}

	bot2 := &Bot{
		UserId:      NewId(),
		Username:    "username",
		DisplayName: "display name",
		Description: "description",
		OwnerId:     NewId(),
		CreateAt:    4,
		UpdateAt:    5,
		DeleteAt:    6,
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
