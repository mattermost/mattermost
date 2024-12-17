// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateBot(t *testing.T) {
	t.Run("invalid bot", func(t *testing.T) {
		t.Run("relative to user", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.CreateBot(th.Context, &model.Bot{
				Username:    "invalid username",
				Description: "a bot",
				OwnerId:     th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.username.app_error", err.Id)
		})

		t.Run("relative to bot", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.CreateBot(th.Context, &model.Bot{
				Username:    "username",
				Description: strings.Repeat("x", 1025),
				OwnerId:     th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.description.app_error", err.Id)
		})

		t.Run("username contains . character", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			bot, err := th.App.CreateBot(th.Context, &model.Bot{
				Username:    "username.",
				Description: "a bot",
				OwnerId:     th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Nil(t, bot)
			require.Equal(t, "model.user.is_valid.email.app_error", err.Id)
		})

		t.Run("username missing", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()
			bot, err := th.App.CreateBot(th.Context, &model.Bot{
				Description: "a bot",
				OwnerId:     th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Nil(t, bot)
			require.Equal(t, "model.bot.is_valid.username.app_error", err.Id)
		})
	})

	t.Run("create bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer func() {
			err = th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}()
		assert.Equal(t, "username", bot.Username)
		assert.Equal(t, "a bot", bot.Description)
		assert.Equal(t, th.BasicUser.Id, bot.OwnerId)

		user, err := th.App.GetUser(bot.UserId)
		require.Nil(t, err)

		// Check that a post was created to add bot to team and channels
		channel, err := th.App.getOrCreateDirectChannelWithUser(th.Context, user, th.BasicUser)
		require.Nil(t, err)
		posts, err := th.App.GetPosts(channel.Id, 0, 1)
		require.Nil(t, err)

		postArray := posts.ToSlice()
		assert.Len(t, postArray, 1)
		assert.Equal(t, postArray[0].Type, model.PostTypeAddBotTeamsChannels)
	})

	t.Run("create bot, username already used by a non-bot user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    th.BasicUser.Username,
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.NotNil(t, err)
		require.Equal(t, "app.user.save.username_exists.app_error", err.Id)
	})
}

func TestEnsureBot(t *testing.T) {
	t.Run("ensure bot should pass if already exist bot user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		pluginId := "pluginId"

		appErr := th.App.SetPluginKey(pluginId, "key", []byte("test"))
		require.Nil(t, appErr)

		botID1, err := th.App.EnsureBot(th.Context, pluginId, &model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.NoError(t, err)

		bot, appErr := th.App.GetBot(th.Context, botID1, true)
		require.Nil(t, appErr)
		assert.Equal(t, "username", bot.Username)
		assert.Equal(t, "a bot", bot.Description)

		botID2, err := th.App.EnsureBot(th.Context, pluginId, &model.Bot{
			Username:    "another_username",
			Description: "another bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.NoError(t, err)
		assert.Equal(t, botID1, botID2)

		bot, appErr = th.App.GetBot(th.Context, botID2, true)
		require.Nil(t, appErr)
		assert.Equal(t, "another_username", bot.Username)
		assert.Equal(t, "another bot", bot.Description)
	})

	t.Run("ensure bot should pass even after delete bot user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		pluginId := "pluginId"

		appErr := th.App.SetPluginKey(pluginId, "key", []byte("test"))
		require.Nil(t, appErr)

		initialBot := model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		}

		botID1, err := th.App.EnsureBot(th.Context, pluginId, &initialBot)
		require.NoError(t, err)

		bot, appErr := th.App.GetBot(th.Context, botID1, true)
		require.Nil(t, appErr)
		assert.Equal(t, "username", bot.Username)
		assert.Equal(t, "a bot", bot.Description)

		err = th.App.Srv().Store().User().PermanentDelete(th.Context, initialBot.UserId)
		require.NoError(t, err)
		botID2, err := th.App.EnsureBot(th.Context, pluginId, &model.Bot{
			Username:    "another_username",
			Description: "another bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.NoError(t, err)
		assert.NotEqual(t, botID1, botID2)

		bot, appErr = th.App.GetBot(th.Context, botID2, true)
		require.Nil(t, appErr)
		assert.Equal(t, "another_username", bot.Username)
		assert.Equal(t, "another bot", bot.Description)
	})
}

func TestPatchBot(t *testing.T) {
	t.Run("invalid patch for user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer func() {
			err = th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}()

		botPatch := &model.BotPatch{
			Username:    model.NewPointer("invalid username"),
			DisplayName: model.NewPointer("an updated bot"),
			Description: model.NewPointer("updated bot"),
		}

		_, err = th.App.PatchBot(th.Context, bot.UserId, botPatch)
		require.NotNil(t, err)
		require.Equal(t, "model.user.is_valid.username.app_error", err.Id)
	})

	t.Run("invalid patch for bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer func() {
			err = th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}()

		botPatch := &model.BotPatch{
			Username:    model.NewPointer("username"),
			DisplayName: model.NewPointer("display name"),
			Description: model.NewPointer(strings.Repeat("x", 1025)),
		}

		_, err = th.App.PatchBot(th.Context, bot.UserId, botPatch)
		require.NotNil(t, err)
		require.Equal(t, "model.bot.is_valid.description.app_error", err.Id)
	})

	t.Run("patch bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot := &model.Bot{
			Username:    "username",
			DisplayName: "bot",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		}

		createdBot, err := th.App.CreateBot(th.Context, bot)
		require.Nil(t, err)
		defer func() {
			err = th.App.PermanentDeleteBot(th.Context, createdBot.UserId)
			require.Nil(t, err)
		}()

		botPatch := &model.BotPatch{
			Username:    model.NewPointer("username2"),
			DisplayName: model.NewPointer("updated bot"),
			Description: model.NewPointer("an updated bot"),
		}

		patchedBot, err := th.App.PatchBot(th.Context, createdBot.UserId, botPatch)
		require.Nil(t, err)

		// patchedBot should create a new .UpdateAt time
		require.NotEqual(t, createdBot.UpdateAt, patchedBot.UpdateAt)

		createdBot.Username = "username2"
		createdBot.DisplayName = "updated bot"
		createdBot.Description = "an updated bot"
		createdBot.UpdateAt = patchedBot.UpdateAt
		require.Equal(t, createdBot, patchedBot)
	})

	t.Run("patch bot, username already used by a non-bot user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "username",
			DisplayName: "bot",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer func() {
			err = th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}()

		botPatch := &model.BotPatch{
			Username: model.NewPointer(th.BasicUser2.Username),
		}

		_, err = th.App.PatchBot(th.Context, bot.UserId, botPatch)
		require.NotNil(t, err)
		require.Equal(t, "app.user.save.username_exists.app_error", err.Id)
	})
}

func TestGetBot(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	bot1, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, bot1.UserId)
		require.Nil(t, err)
	}()

	bot2, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username2",
		Description: "a second bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, bot2.UserId)
		require.Nil(t, err)
	}()

	deletedBot, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username3",
		Description: "a deleted bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	deletedBot, err = th.App.UpdateBotActive(th.Context, deletedBot.UserId, false)
	require.Nil(t, err)
	defer func() {
		err := th.App.PermanentDeleteBot(th.Context, deletedBot.UserId)
		require.Nil(t, err)
	}()

	t.Run("get unknown bot", func(t *testing.T) {
		_, err := th.App.GetBot(th.Context, model.NewId(), false)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_bot.get.missing.app_error", err.Id)
	})

	t.Run("get bot1", func(t *testing.T) {
		bot, err := th.App.GetBot(th.Context, bot1.UserId, false)
		require.Nil(t, err)
		assert.Equal(t, bot1, bot)
	})

	t.Run("get bot2", func(t *testing.T) {
		bot, err := th.App.GetBot(th.Context, bot2.UserId, false)
		require.Nil(t, err)
		assert.Equal(t, bot2, bot)
	})

	t.Run("get deleted bot", func(t *testing.T) {
		_, err := th.App.GetBot(th.Context, deletedBot.UserId, false)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_bot.get.missing.app_error", err.Id)
	})

	t.Run("get deleted bot, include deleted", func(t *testing.T) {
		bot, err := th.App.GetBot(th.Context, deletedBot.UserId, true)
		require.Nil(t, err)
		assert.Equal(t, deletedBot, bot)
	})
}

func TestGetBots(t *testing.T) {
	th := Setup(t).DeleteBots()
	defer th.TearDown()

	OwnerId1 := model.NewId()
	OwnerId2 := model.NewId()

	bot1, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, bot1.UserId)
		require.Nil(t, err)
	}()

	deletedBot1, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username4",
		Description: "a deleted bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	deletedBot1, err = th.App.UpdateBotActive(th.Context, deletedBot1.UserId, false)
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, deletedBot1.UserId)
		require.Nil(t, err)
	}()

	bot2, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username2",
		Description: "a second bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, bot2.UserId)
		require.Nil(t, err)
	}()

	bot3, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username3",
		Description: "a third bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, bot3.UserId)
		require.Nil(t, err)
	}()

	bot4, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username5",
		Description: "a fourth bot",
		OwnerId:     OwnerId2,
	})
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, bot4.UserId)
		require.Nil(t, err)
	}()

	deletedBot2, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username6",
		Description: "a deleted bot",
		OwnerId:     OwnerId2,
	})
	require.Nil(t, err)
	deletedBot2, err = th.App.UpdateBotActive(th.Context, deletedBot2.UserId, false)
	require.Nil(t, err)
	defer func() {
		err := th.App.PermanentDeleteBot(th.Context, deletedBot2.UserId)
		require.Nil(t, err)
	}()

	t.Run("get bots, page=0, perPage=10", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1, bot2, bot3, bot4}, bots)
	})

	t.Run("get bots, page=0, perPage=1", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        1,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1}, bots)
	})

	t.Run("get bots, page=1, perPage=2", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           1,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot3, bot4}, bots)
	})

	t.Run("get bots, page=2, perPage=2", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           2,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{}, bots)
	})

	t.Run("get bots, page=0, perPage=10, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1, deletedBot1, bot2, bot3, bot4, deletedBot2}, bots)
	})

	t.Run("get bots, page=0, perPage=1, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        1,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1}, bots)
	})

	t.Run("get bots, page=1, perPage=2, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           1,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot2, bot3}, bots)
	})

	t.Run("get bots, page=2, perPage=2, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           2,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot4, deletedBot2}, bots)
	})

	t.Run("get offset=0, limit=10, creator id 1", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        OwnerId1,
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		require.Equal(t, model.BotList{bot1, bot2, bot3}, bots)
	})

	t.Run("get offset=0, limit=10, creator id 2", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        OwnerId2,
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		require.Equal(t, model.BotList{bot4}, bots)
	})

	t.Run("get offset=0, limit=10, include deleted, creator id 1", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        OwnerId1,
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		require.Equal(t, model.BotList{bot1, deletedBot1, bot2, bot3}, bots)
	})

	t.Run("get offset=0, limit=10, include deleted, creator id 2", func(t *testing.T) {
		bots, err := th.App.GetBots(th.Context, &model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        OwnerId2,
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		require.Equal(t, model.BotList{bot4, deletedBot2}, bots)
	})
}

func TestUpdateBotActive(t *testing.T) {
	t.Run("unknown bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, err := th.App.UpdateBotActive(th.Context, model.NewId(), false)
		require.NotNil(t, err)
		require.Equal(t, "app.user.missing_account.const", err.Id)
	})

	t.Run("disable/enable bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer func() {
			err = th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}()

		disabledBot, err := th.App.UpdateBotActive(th.Context, bot.UserId, false)
		require.Nil(t, err)
		require.NotEqual(t, 0, disabledBot.DeleteAt)

		// Disabling should be idempotent
		disabledBotAgain, err := th.App.UpdateBotActive(th.Context, bot.UserId, false)
		require.Nil(t, err)
		require.Equal(t, disabledBot.DeleteAt, disabledBotAgain.DeleteAt)

		reenabledBot, err := th.App.UpdateBotActive(th.Context, bot.UserId, true)
		require.Nil(t, err)
		require.EqualValues(t, 0, reenabledBot.DeleteAt)

		// Re-enabling should be idempotent
		reenabledBotAgain, err := th.App.UpdateBotActive(th.Context, bot.UserId, true)
		require.Nil(t, err)
		require.Equal(t, reenabledBot.DeleteAt, reenabledBotAgain.DeleteAt)
	})
}

func TestPermanentDeleteBot(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	bot, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)

	require.Nil(t, th.App.PermanentDeleteBot(th.Context, bot.UserId))

	_, err = th.App.GetBot(th.Context, bot.UserId, false)
	require.NotNil(t, err)
	require.Equal(t, "store.sql_bot.get.missing.app_error", err.Id)
}

func TestDisableUserBots(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	ownerId1 := model.NewId()
	ownerId2 := model.NewId()

	bots := []*model.Bot{}
	defer func() {
		for _, bot := range bots {
			err := th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}
	}()

	for i := 0; i < 46; i++ {
		bot, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    fmt.Sprintf("username%v", i),
			Description: "a bot",
			OwnerId:     ownerId1,
		})
		require.Nil(t, err)
		bots = append(bots, bot)
	}
	require.Len(t, bots, 46)

	u2bot1, err := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "username_nodisable",
		Description: "a bot",
		OwnerId:     ownerId2,
	})
	require.Nil(t, err)
	defer func() {
		err = th.App.PermanentDeleteBot(th.Context, u2bot1.UserId)
		require.Nil(t, err)
	}()

	err = th.App.disableUserBots(th.Context, ownerId1)
	require.Nil(t, err)

	// Check all bots and corresponding users are disabled for creator 1
	for _, bot := range bots {
		retbot, err2 := th.App.GetBot(th.Context, bot.UserId, true)
		require.Nil(t, err2)
		require.NotZero(t, retbot.DeleteAt, bot.Username)
	}

	// Check bots and corresponding user not disabled for creator 2
	bot, err := th.App.GetBot(th.Context, u2bot1.UserId, true)
	require.Nil(t, err)
	require.Zero(t, bot.DeleteAt)

	user, err := th.App.GetUser(u2bot1.UserId)
	require.Nil(t, err)
	require.Zero(t, user.DeleteAt)

	// Bad id doesn't do anything or break horribly
	err = th.App.disableUserBots(th.Context, model.NewId())
	require.Nil(t, err)
}

func TestNotifySysadminsBotOwnerDisabled(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	userBots := []*model.Bot{}
	defer func() {
		for _, bot := range userBots {
			err := th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}
	}()

	// // Create two sysadmins
	sysadmin1 := model.User{
		Email:    "sys1@example.com",
		Nickname: "nn_sysadmin1",
		Password: "hello1",
		Username: "un_sysadmin1",
		Roles:    model.SystemAdminRoleId + " " + model.SystemUserRoleId}
	_, err := th.App.CreateUser(th.Context, &sysadmin1)
	require.Nil(t, err, "failed to create user")
	_, err = th.App.UpdateUserRoles(th.Context, sysadmin1.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(t, err)

	sysadmin2 := model.User{
		Email:    "sys2@example.com",
		Nickname: "nn_sysadmin2",
		Password: "hello1",
		Username: "un_sysadmin2",
		Roles:    model.SystemAdminRoleId + " " + model.SystemUserRoleId}
	_, err = th.App.CreateUser(th.Context, &sysadmin2)
	require.Nil(t, err, "failed to create user")
	_, err = th.App.UpdateUserRoles(th.Context, sysadmin2.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(t, err)

	// create user to be disabled
	user1, err := th.App.CreateUser(th.Context, &model.User{
		Email:    "user1@example.com",
		Username: "user1_disabled",
		Nickname: "user1",
		Password: "Password1",
	})
	require.Nil(t, err, "failed to create user")

	// create user that doesn't own any bots
	user2, err := th.App.CreateUser(th.Context, &model.User{
		Email:    "user2@example.com",
		Username: "user2_disabled",
		Nickname: "user2",
		Password: "Password1",
	})
	require.Nil(t, err, "failed to create user")

	const numBotsToPrint = 10

	// create bots owned by user (equal to numBotsToPrint)
	var bot *model.Bot
	for i := 0; i < numBotsToPrint; i++ {
		bot, err = th.App.CreateBot(th.Context, &model.Bot{
			Username:    fmt.Sprintf("bot%v", i),
			Description: "a bot",
			OwnerId:     user1.Id,
		})
		require.Nil(t, err)
		userBots = append(userBots, bot)
	}
	assert.Len(t, userBots, 10)

	// get DM channels for sysadmin1 and sysadmin2
	channelSys1, appErr := th.App.GetOrCreateDirectChannel(th.Context, sysadmin1.Id, sysadmin1.Id)
	require.Nil(t, appErr)
	channelSys2, appErr := th.App.GetOrCreateDirectChannel(th.Context, sysadmin2.Id, sysadmin2.Id)
	require.Nil(t, appErr)

	// send notification for user without bots
	err = th.App.notifySysadminsBotOwnerDeactivated(th.Context, user2.Id)
	require.Nil(t, err)

	// get posts from sysadmin1 and sysadmin2 DM channels
	posts1, err := th.App.GetPosts(channelSys1.Id, 0, 5)
	require.Nil(t, err)
	assert.Empty(t, posts1.Order)

	posts2, err := th.App.GetPosts(channelSys2.Id, 0, 5)
	require.Nil(t, err)
	assert.Empty(t, posts2.Order)

	// send notification for user with bots
	err = th.App.notifySysadminsBotOwnerDeactivated(th.Context, user1.Id)
	require.Nil(t, err)

	// get posts from sysadmin1  and sysadmin2 DM channels
	posts1, err = th.App.GetPosts(channelSys1.Id, 0, 5)
	require.Nil(t, err)
	assert.Len(t, posts1.Order, 1)

	posts2, err = th.App.GetPosts(channelSys2.Id, 0, 5)
	require.Nil(t, err)
	assert.Len(t, posts2.Order, 1)

	post := posts1.Posts[posts1.Order[0]].Message
	assert.Equal(t, "user1_disabled was deactivated. They managed the following bot accounts which have now been disabled.\n\n* bot0\n* bot1\n* bot2\n* bot3\n* bot4\n* bot5\n* bot6\n* bot7\n* bot8\n* bot9\nYou can take ownership of each bot by enabling it at **Integrations > Bot Accounts** and creating new tokens for the bot.\n\nFor more information, see our [documentation](https://docs.mattermost.com/developer/bot-accounts.html#what-happens-when-a-user-who-owns-bot-accounts-is-disabled).", post)

	// print all bots
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = true })
	message := th.App.getDisableBotSysadminMessage(user1, userBots)
	assert.Equal(t, "user1_disabled was deactivated. They managed the following bot accounts which have now been disabled.\n\n* bot0\n* bot1\n* bot2\n* bot3\n* bot4\n* bot5\n* bot6\n* bot7\n* bot8\n* bot9\nYou can take ownership of each bot by enabling it at **Integrations > Bot Accounts** and creating new tokens for the bot.\n\nFor more information, see our [documentation](https://docs.mattermost.com/developer/bot-accounts.html#what-happens-when-a-user-who-owns-bot-accounts-is-disabled).", message)

	// print all bots
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = false })
	message = th.App.getDisableBotSysadminMessage(user1, userBots)
	assert.Equal(t, "user1_disabled was deactivated. They managed the following bot accounts which are still enabled.\n\n* bot0\n* bot1\n* bot2\n* bot3\n* bot4\n* bot5\n* bot6\n* bot7\n* bot8\n* bot9\n\nWe strongly recommend you to take ownership of each bot by re-enabling it at **Integrations > Bot Accounts** and creating new tokens for the bot.\n\nFor more information, see our [documentation](https://docs.mattermost.com/developer/bot-accounts.html#what-happens-when-a-user-who-owns-bot-accounts-is-disabled).\n\nIf you want bot accounts to disable automatically after owner deactivation, set “Disable bot accounts when owner is deactivated” in **System Console > Integrations > Bot Accounts** to true.", message)

	// create additional bot to go over the printable limit
	for i := numBotsToPrint; i < numBotsToPrint+1; i++ {
		bot, err = th.App.CreateBot(th.Context, &model.Bot{
			Username:    fmt.Sprintf("bot%v", i),
			Description: "a bot",
			OwnerId:     user1.Id,
		})
		require.Nil(t, err)
		userBots = append(userBots, bot)
	}
	assert.Len(t, userBots, 11)

	// truncate number bots printed
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = true })
	message = th.App.getDisableBotSysadminMessage(user1, userBots)
	assert.Equal(t, "user1_disabled was deactivated. They managed 11 bot accounts which have now been disabled, including the following:\n\n* bot0\n* bot1\n* bot2\n* bot3\n* bot4\n* bot5\n* bot6\n* bot7\n* bot8\n* bot9\nYou can take ownership of each bot by enabling it at **Integrations > Bot Accounts** and creating new tokens for the bot.\n\nFor more information, see our [documentation](https://docs.mattermost.com/developer/bot-accounts.html#what-happens-when-a-user-who-owns-bot-accounts-is-disabled).", message)

	// truncate number bots printed
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = false })
	message = th.App.getDisableBotSysadminMessage(user1, userBots)
	assert.Equal(t, "user1_disabled was deactivated. They managed 11 bot accounts which are still enabled, including the following:\n\n* bot0\n* bot1\n* bot2\n* bot3\n* bot4\n* bot5\n* bot6\n* bot7\n* bot8\n* bot9\nWe strongly recommend you to take ownership of each bot by re-enabling it at **Integrations > Bot Accounts** and creating new tokens for the bot.\n\nFor more information, see our [documentation](https://docs.mattermost.com/developer/bot-accounts.html#what-happens-when-a-user-who-owns-bot-accounts-is-disabled).\n\nIf you want bot accounts to disable automatically after owner deactivation, set “Disable bot accounts when owner is deactivated” in **System Console > Integrations > Bot Accounts** to true.", message)
}

func TestConvertUserToBot(t *testing.T) {
	t.Run("invalid user", func(t *testing.T) {
		t.Run("invalid user id", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.ConvertUserToBot(th.Context, &model.User{
				Username: "username",
				Id:       "",
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.user_id.app_error", err.Id)
		})

		t.Run("invalid username", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.ConvertUserToBot(th.Context, &model.User{
				Username: "invalid username",
				Id:       th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.username.app_error", err.Id)
		})
	})

	t.Run("valid user and session revoked", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		session, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, err)

		// make sure session is valid
		testSession, err := th.App.GetSession(session.Token)
		require.Nil(t, err)
		require.False(t, testSession.IsExpired())

		bot, err := th.App.ConvertUserToBot(th.Context, &model.User{
			Username: "username",
			Id:       th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer func() {
			err = th.App.PermanentDeleteBot(th.Context, bot.UserId)
			require.Nil(t, err)
		}()
		assert.Equal(t, "username", bot.Username)
		assert.Equal(t, th.BasicUser.Id, bot.OwnerId)

		// make sure session is no longer valid
		_, err = th.App.GetSession(session.Token)
		require.NotNil(t, err)
		require.Equal(t, "api.context.invalid_token.error", err.Id)
	})
}

func TestGetSystemBot(t *testing.T) {
	t.Run("An error should be returned if there are no sysadmins in the instance", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		require.Nil(t, th.App.PermanentDeleteAllUsers(th.Context))

		_, err := th.App.GetSystemBot(th.Context)
		require.NotNil(t, err)
		require.Equal(t, "app.bot.get_system_bot.empty_admin_list.app_error", err.Id)
	})

	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("The bot should be created the first time it's retrieved", func(t *testing.T) {
		// assert no bot with username exists
		_, err := th.App.GetUserByUsername(model.BotSystemBotUsername)
		require.NotNil(t, err)

		bot, err := th.App.GetSystemBot(th.Context)
		require.Nil(t, err)
		require.Equal(t, bot.Username, model.BotSystemBotUsername)
	})

	t.Run("The bot should be correctly retrieved if it exists already", func(t *testing.T) {
		// assert that the bot is now present
		botUser, err := th.App.GetUserByUsername(model.BotSystemBotUsername)
		require.Nil(t, err)
		require.True(t, botUser.IsBot)

		bot, err := th.App.GetSystemBot(th.Context)
		require.Nil(t, err)
		require.Equal(t, bot.Username, model.BotSystemBotUsername)
		require.Equal(t, bot.UserId, botUser.Id)
	})
}
