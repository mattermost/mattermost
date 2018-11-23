// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestCreateBot(t *testing.T) {
	t.Run("invalid bot", func(t *testing.T) {
		t.Run("relative to user", func(t *testing.T) {
			th := Setup().InitBasic()
			defer th.TearDown()

			_, err := th.App.CreateBot(&model.Bot{
				Username:    "invalid username",
				Description: "a bot",
				CreatorId:   th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.user.is_valid.username.app_error", err.Id)
		})

		t.Run("relative to bot", func(t *testing.T) {
			th := Setup().InitBasic()
			defer th.TearDown()

			_, err := th.App.CreateBot(&model.Bot{
				Username:    "username",
				Description: strings.Repeat("x", 1025),
				CreatorId:   th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.description.app_error", err.Id)
		})
	})

	t.Run("create bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)
		assert.Equal(t, "username", bot.Username)
		assert.Equal(t, "a bot", bot.Description)
		assert.Equal(t, th.BasicUser.Id, bot.CreatorId)
	})

	t.Run("create bot, username already used by a non-bot user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		_, err := th.App.CreateBot(&model.Bot{
			Username:    th.BasicUser.Username,
			Description: "a bot",
			CreatorId:   th.BasicUser.Id,
		})
		require.NotNil(t, err)
		require.Equal(t, "store.sql_user.save.username_exists.app_error", err.Id)
	})
}

func TestPatchBot(t *testing.T) {
	t.Run("invalid patch for user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP("invalid username"),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		_, err = th.App.PatchBot(bot.UserId, botPatch)
		require.NotNil(t, err)
		require.Equal(t, "model.user.is_valid.username.app_error", err.Id)
	})

	t.Run("invalid patch for bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP("username"),
			DisplayName: sToP("display name"),
			Description: sToP(strings.Repeat("x", 1025)),
		}

		_, err = th.App.PatchBot(bot.UserId, botPatch)
		require.NotNil(t, err)
		require.Equal(t, "model.bot.is_valid.description.app_error", err.Id)
	})

	t.Run("patch bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		bot := &model.Bot{
			Username:    "username",
			DisplayName: "bot",
			Description: "a bot",
			CreatorId:   th.BasicUser.Id,
		}

		createdBot, err := th.App.CreateBot(bot)
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP("username2"),
			DisplayName: sToP("updated bot"),
			Description: sToP("an updated bot"),
		}

		patchedBot, err := th.App.PatchBot(createdBot.UserId, botPatch)
		require.Nil(t, err)

		createdBot.Username = "username2"
		createdBot.DisplayName = "updated bot"
		createdBot.Description = "an updated bot"
		createdBot.UpdateAt = patchedBot.UpdateAt
		require.Equal(t, createdBot, patchedBot)
	})

	t.Run("patch bot, username already used by a non-bot user", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			DisplayName: "bot",
			Description: "a bot",
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		botPatch := &model.BotPatch{
			Username: sToP(th.BasicUser2.Username),
		}

		_, err = th.App.PatchBot(bot.UserId, botPatch)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_user.update.username_taken.app_error", err.Id)
	})
}

func TestGetBot(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	bot1, err := th.App.CreateBot(&model.Bot{
		Username:    "username",
		Description: "a bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	bot2, err := th.App.CreateBot(&model.Bot{
		Username:    "username2",
		Description: "a second bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	deletedBot, err := th.App.CreateBot(&model.Bot{
		Username:    "username3",
		Description: "a deleted bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	deletedBot, err = th.App.DisableBot(deletedBot.UserId)
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(deletedBot.UserId)

	t.Run("get unknown bot", func(t *testing.T) {
		_, err := th.App.GetBot(model.NewId(), false)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_bot.get.missing.app_error", err.Id)
	})

	t.Run("get bot1", func(t *testing.T) {
		bot, err := th.App.GetBot(bot1.UserId, false)
		require.Nil(t, err)
		assert.Equal(t, bot1, bot)
	})

	t.Run("get bot2", func(t *testing.T) {
		bot, err := th.App.GetBot(bot2.UserId, false)
		require.Nil(t, err)
		assert.Equal(t, bot2, bot)
	})

	t.Run("get deleted bot", func(t *testing.T) {
		_, err := th.App.GetBot(deletedBot.UserId, false)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_bot.get.missing.app_error", err.Id)
	})

	t.Run("get deleted bot, include deleted", func(t *testing.T) {
		bot, err := th.App.GetBot(deletedBot.UserId, true)
		require.Nil(t, err)
		assert.Equal(t, deletedBot, bot)
	})
}

func TestGetBots(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	bot1, err := th.App.CreateBot(&model.Bot{
		Username:    "username",
		Description: "a bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	deletedBot1, err := th.App.CreateBot(&model.Bot{
		Username:    "username4",
		Description: "a deleted bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	deletedBot1, err = th.App.DisableBot(deletedBot1.UserId)
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(deletedBot1.UserId)

	bot2, err := th.App.CreateBot(&model.Bot{
		Username:    "username2",
		Description: "a second bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	bot3, err := th.App.CreateBot(&model.Bot{
		Username:    "username3",
		Description: "a third bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot3.UserId)

	deletedBot2, err := th.App.CreateBot(&model.Bot{
		Username:    "username5",
		Description: "a deleted bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)
	deletedBot2, err = th.App.DisableBot(deletedBot2.UserId)
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(deletedBot2.UserId)

	t.Run("get bots, page=0, perPage=10", func(t *testing.T) {
		bots, err := th.App.GetBots(0, 10, false)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{bot1, bot2, bot3}, bots)
	})

	t.Run("get bots, page=0, perPage=1", func(t *testing.T) {
		bots, err := th.App.GetBots(0, 1, false)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{bot1}, bots)
	})

	t.Run("get bots, page=1, perPage=2", func(t *testing.T) {
		bots, err := th.App.GetBots(1, 2, false)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{bot3}, bots)
	})

	t.Run("get bots, page=2, perPage=2", func(t *testing.T) {
		bots, err := th.App.GetBots(2, 2, false)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{}, bots)
	})

	t.Run("get bots, page=0, perPage=10, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(0, 10, true)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{bot1, deletedBot1, bot2, bot3, deletedBot2}, bots)
	})

	t.Run("get bots, page=0, perPage=1, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(0, 1, true)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{bot1}, bots)
	})

	t.Run("get bots, page=1, perPage=2, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(1, 2, true)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{bot2, bot3}, bots)
	})

	t.Run("get bots, page=2, perPage=2, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(2, 2, true)
		require.Nil(t, err)
		assert.Equal(t, []*model.Bot{deletedBot2}, bots)
	})
}

func TestDisableBot(t *testing.T) {
	t.Run("unknown bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		_, err := th.App.DisableBot(model.NewId())
		require.NotNil(t, err)
		require.Equal(t, "store.sql_user.missing_account.const", err.Id)
	})

	t.Run("disable bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		disabledBot, err := th.App.DisableBot(bot.UserId)
		require.Nil(t, err)
		require.NotEqual(t, 0, disabledBot.DeleteAt)

		// Disabling should be idempotent
		disabledBotAgain, err := th.App.DisableBot(bot.UserId)
		require.Nil(t, err)
		require.Equal(t, disabledBot.DeleteAt, disabledBotAgain.DeleteAt)
	})
}

func TestPermanentDeleteBot(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	bot, err := th.App.CreateBot(&model.Bot{
		Username:    "username",
		Description: "a bot",
		CreatorId:   th.BasicUser.Id,
	})
	require.Nil(t, err)

	require.Nil(t, th.App.PermanentDeleteBot(bot.UserId))

	_, err = th.App.GetBot(bot.UserId, false)
	require.NotNil(t, err)
	require.Equal(t, "store.sql_bot.get.missing.app_error", err.Id)
}

func sToP(s string) *string {
	return &s
}
