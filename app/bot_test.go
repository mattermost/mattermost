// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils/fileutils"
)

func TestCreateBot(t *testing.T) {
	t.Run("invalid bot", func(t *testing.T) {
		t.Run("relative to user", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.CreateBot(&model.Bot{
				Username:    "invalid username",
				Description: "a bot",
				OwnerId:     th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.user.is_valid.username.app_error", err.Id)
		})

		t.Run("relative to bot", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.CreateBot(&model.Bot{
				Username:    "username",
				Description: strings.Repeat("x", 1025),
				OwnerId:     th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.description.app_error", err.Id)
		})
	})

	t.Run("create bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)
		assert.Equal(t, "username", bot.Username)
		assert.Equal(t, "a bot", bot.Description)
		assert.Equal(t, th.BasicUser.Id, bot.OwnerId)

		// Check that a post was created to add bot to team and channels
		channel, err := th.App.GetOrCreateDirectChannel(bot.UserId, th.BasicUser.Id)
		require.Nil(t, err)
		posts, err := th.App.GetPosts(channel.Id, 0, 1)
		require.Nil(t, err)

		postArray := posts.ToSlice()
		assert.Len(t, postArray, 1)
		assert.Equal(t, postArray[0].Type, model.POST_ADD_BOT_TEAMS_CHANNELS)
	})

	t.Run("create bot, username already used by a non-bot user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, err := th.App.CreateBot(&model.Bot{
			Username:    th.BasicUser.Username,
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.NotNil(t, err)
		require.Equal(t, "store.sql_user.save.username_exists.app_error", err.Id)
	})
}

func TestPatchBot(t *testing.T) {
	t.Run("invalid patch for user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
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
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
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
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot := &model.Bot{
			Username:    "username",
			DisplayName: "bot",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
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
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			DisplayName: "bot",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	bot1, err := th.App.CreateBot(&model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	bot2, err := th.App.CreateBot(&model.Bot{
		Username:    "username2",
		Description: "a second bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	deletedBot, err := th.App.CreateBot(&model.Bot{
		Username:    "username3",
		Description: "a deleted bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)
	deletedBot, err = th.App.UpdateBotActive(deletedBot.UserId, false)
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	OwnerId1 := model.NewId()
	OwnerId2 := model.NewId()

	bot1, err := th.App.CreateBot(&model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	deletedBot1, err := th.App.CreateBot(&model.Bot{
		Username:    "username4",
		Description: "a deleted bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	deletedBot1, err = th.App.UpdateBotActive(deletedBot1.UserId, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(deletedBot1.UserId)

	bot2, err := th.App.CreateBot(&model.Bot{
		Username:    "username2",
		Description: "a second bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	bot3, err := th.App.CreateBot(&model.Bot{
		Username:    "username3",
		Description: "a third bot",
		OwnerId:     OwnerId1,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot3.UserId)

	bot4, err := th.App.CreateBot(&model.Bot{
		Username:    "username5",
		Description: "a fourth bot",
		OwnerId:     OwnerId2,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(bot4.UserId)

	deletedBot2, err := th.App.CreateBot(&model.Bot{
		Username:    "username6",
		Description: "a deleted bot",
		OwnerId:     OwnerId2,
	})
	require.Nil(t, err)
	deletedBot2, err = th.App.UpdateBotActive(deletedBot2.UserId, false)
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(deletedBot2.UserId)

	t.Run("get bots, page=0, perPage=10", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1, bot2, bot3, bot4}, bots)
	})

	t.Run("get bots, page=0, perPage=1", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        1,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1}, bots)
	})

	t.Run("get bots, page=1, perPage=2", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           1,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot3, bot4}, bots)
	})

	t.Run("get bots, page=2, perPage=2", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           2,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{}, bots)
	})

	t.Run("get bots, page=0, perPage=10, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1, deletedBot1, bot2, bot3, bot4, deletedBot2}, bots)
	})

	t.Run("get bots, page=0, perPage=1, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        1,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot1}, bots)
	})

	t.Run("get bots, page=1, perPage=2, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           1,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot2, bot3}, bots)
	})

	t.Run("get bots, page=2, perPage=2, include deleted", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           2,
			PerPage:        2,
			OwnerId:        "",
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		assert.Equal(t, model.BotList{bot4, deletedBot2}, bots)
	})

	t.Run("get offset=0, limit=10, creator id 1", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        OwnerId1,
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		require.Equal(t, model.BotList{bot1, bot2, bot3}, bots)
	})

	t.Run("get offset=0, limit=10, creator id 2", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        OwnerId2,
			IncludeDeleted: false,
		})
		require.Nil(t, err)
		require.Equal(t, model.BotList{bot4}, bots)
	})

	t.Run("get offset=0, limit=10, include deleted, creator id 1", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
			Page:           0,
			PerPage:        10,
			OwnerId:        OwnerId1,
			IncludeDeleted: true,
		})
		require.Nil(t, err)
		require.Equal(t, model.BotList{bot1, deletedBot1, bot2, bot3}, bots)
	})

	t.Run("get offset=0, limit=10, include deleted, creator id 2", func(t *testing.T) {
		bots, err := th.App.GetBots(&model.BotGetOptions{
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

		_, err := th.App.UpdateBotActive(model.NewId(), false)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_user.missing_account.const", err.Id)
	})

	t.Run("disable/enable bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "username",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		disabledBot, err := th.App.UpdateBotActive(bot.UserId, false)
		require.Nil(t, err)
		require.NotEqual(t, 0, disabledBot.DeleteAt)

		// Disabling should be idempotent
		disabledBotAgain, err := th.App.UpdateBotActive(bot.UserId, false)
		require.Nil(t, err)
		require.Equal(t, disabledBot.DeleteAt, disabledBotAgain.DeleteAt)

		reenabledBot, err := th.App.UpdateBotActive(bot.UserId, true)
		require.Nil(t, err)
		require.EqualValues(t, 0, reenabledBot.DeleteAt)

		// Re-enabling should be idempotent
		reenabledBotAgain, err := th.App.UpdateBotActive(bot.UserId, true)
		require.Nil(t, err)
		require.Equal(t, reenabledBot.DeleteAt, reenabledBotAgain.DeleteAt)
	})
}

func TestPermanentDeleteBot(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	bot, err := th.App.CreateBot(&model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     th.BasicUser.Id,
	})
	require.Nil(t, err)

	require.Nil(t, th.App.PermanentDeleteBot(bot.UserId))

	_, err = th.App.GetBot(bot.UserId, false)
	require.NotNil(t, err)
	require.Equal(t, "store.sql_bot.get.missing.app_error", err.Id)
}

func TestDisableUserBots(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	ownerId1 := model.NewId()
	ownerId2 := model.NewId()

	bots := []*model.Bot{}
	defer func() {
		for _, bot := range bots {
			th.App.PermanentDeleteBot(bot.UserId)
		}
	}()

	for i := 0; i < 46; i++ {
		bot, err := th.App.CreateBot(&model.Bot{
			Username:    fmt.Sprintf("username%v", i),
			Description: "a bot",
			OwnerId:     ownerId1,
		})
		require.Nil(t, err)
		bots = append(bots, bot)
	}
	require.Len(t, bots, 46)

	u2bot1, err := th.App.CreateBot(&model.Bot{
		Username:    "username_nodisable",
		Description: "a bot",
		OwnerId:     ownerId2,
	})
	require.Nil(t, err)
	defer th.App.PermanentDeleteBot(u2bot1.UserId)

	err = th.App.disableUserBots(ownerId1)
	require.Nil(t, err)

	// Check all bots and corrensponding users are disabled for creator 1
	for _, bot := range bots {
		retbot, err2 := th.App.GetBot(bot.UserId, true)
		require.Nil(t, err2)
		require.NotZero(t, retbot.DeleteAt, bot.Username)
	}

	// Check bots and corresponding user not disabled for creator 2
	bot, err := th.App.GetBot(u2bot1.UserId, true)
	require.Nil(t, err)
	require.Zero(t, bot.DeleteAt)

	user, err := th.App.GetUser(u2bot1.UserId)
	require.Nil(t, err)
	require.Zero(t, user.DeleteAt)

	// Bad id doesn't do anything or break horribly
	err = th.App.disableUserBots(model.NewId())
	require.Nil(t, err)
}

func TestConvertUserToBot(t *testing.T) {
	t.Run("invalid user", func(t *testing.T) {
		t.Run("invalid user id", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.ConvertUserToBot(&model.User{
				Username: "username",
				Id:       "",
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.user_id.app_error", err.Id)
		})

		t.Run("invalid username", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			_, err := th.App.ConvertUserToBot(&model.User{
				Username: "invalid username",
				Id:       th.BasicUser.Id,
			})
			require.NotNil(t, err)
			require.Equal(t, "model.bot.is_valid.username.app_error", err.Id)
		})
	})

	t.Run("valid user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		bot, err := th.App.ConvertUserToBot(&model.User{
			Username: "username",
			Id:       th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)
		assert.Equal(t, "username", bot.Username)
		assert.Equal(t, th.BasicUser.Id, bot.OwnerId)
	})
}

func TestSetBotIconImage(t *testing.T) {
	t.Run("invalid bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		path, _ := fileutils.FindDir("tests")
		svgFile, fileErr := os.Open(filepath.Join(path, "test.svg"))
		require.NoError(t, fileErr)
		defer svgFile.Close()

		err := th.App.SetBotIconImage("invalid_bot_id", svgFile)
		require.NotNil(t, err)
	})

	t.Run("valid bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Set an icon image
		path, _ := fileutils.FindDir("tests")
		svgFile, fileErr := os.Open(filepath.Join(path, "test.svg"))
		require.NoError(t, fileErr)
		defer svgFile.Close()

		expectedData, fileErr := ioutil.ReadAll(svgFile)
		require.Nil(t, fileErr)
		require.NotNil(t, expectedData)

		bot, err := th.App.ConvertUserToBot(&model.User{
			Username: "username",
			Id:       th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		fpath := fmt.Sprintf("/bots/%v/icon.svg", bot.UserId)
		exists, err := th.App.FileExists(fpath)
		require.Nil(t, err)
		require.False(t, exists, "icon.svg shouldn't exist for the bot")

		svgFile.Seek(0, 0)
		err = th.App.SetBotIconImage(bot.UserId, svgFile)
		require.Nil(t, err)

		exists, err = th.App.FileExists(fpath)
		require.Nil(t, err)
		require.True(t, exists, "icon.svg should exist for the bot")

		actualData, err := th.App.ReadFile(fpath)
		require.Nil(t, err)
		require.NotNil(t, actualData)

		require.Equal(t, expectedData, actualData)
	})
}

func TestGetBotIconImage(t *testing.T) {
	t.Run("invalid bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		actualData, err := th.App.GetBotIconImage("invalid_bot_id")
		require.NotNil(t, err)
		require.Nil(t, actualData)
	})

	t.Run("valid bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Set an icon image
		path, _ := fileutils.FindDir("tests")
		svgFile, fileErr := os.Open(filepath.Join(path, "test.svg"))
		require.NoError(t, fileErr)
		defer svgFile.Close()

		expectedData, fileErr := ioutil.ReadAll(svgFile)
		require.Nil(t, fileErr)
		require.NotNil(t, expectedData)

		bot, err := th.App.ConvertUserToBot(&model.User{
			Username: "username",
			Id:       th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		svgFile.Seek(0, 0)
		fpath := fmt.Sprintf("/bots/%v/icon.svg", bot.UserId)
		_, err = th.App.WriteFile(svgFile, fpath)
		require.Nil(t, err)

		actualBytes, err := th.App.GetBotIconImage(bot.UserId)
		require.Nil(t, err)
		require.NotNil(t, actualBytes)

		actualData, err := th.App.ReadFile(fpath)
		require.Nil(t, err)
		require.NotNil(t, actualData)

		require.Equal(t, expectedData, actualData)
	})
}

func TestDeleteBotIconImage(t *testing.T) {
	t.Run("invalid bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		err := th.App.DeleteBotIconImage("invalid_bot_id")
		require.NotNil(t, err)
	})

	t.Run("valid bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Set an icon image
		path, _ := fileutils.FindDir("tests")
		svgFile, fileErr := os.Open(filepath.Join(path, "test.svg"))
		require.NoError(t, fileErr)
		defer svgFile.Close()

		expectedData, fileErr := ioutil.ReadAll(svgFile)
		require.Nil(t, fileErr)
		require.NotNil(t, expectedData)

		bot, err := th.App.ConvertUserToBot(&model.User{
			Username: "username",
			Id:       th.BasicUser.Id,
		})
		require.Nil(t, err)
		defer th.App.PermanentDeleteBot(bot.UserId)

		// Set icon
		svgFile.Seek(0, 0)
		err = th.App.SetBotIconImage(bot.UserId, svgFile)
		require.Nil(t, err)

		// Get icon
		actualData, err := th.App.GetBotIconImage(bot.UserId)
		require.Nil(t, err)
		require.NotNil(t, actualData)
		require.Equal(t, expectedData, actualData)

		// Bot icon should exist
		fpath := fmt.Sprintf("/bots/%v/icon.svg", bot.UserId)
		exists, err := th.App.FileExists(fpath)
		require.Nil(t, err)
		require.True(t, exists, "icon.svg should exist for the bot")

		// Delete icon
		err = th.App.DeleteBotIconImage(bot.UserId)
		require.Nil(t, err)

		// Bot icon should not exist
		exists, err = th.App.FileExists(fpath)
		require.Nil(t, err)
		require.False(t, exists, "icon.svg should be deleted for the bot")
	})
}

func sToP(s string) *string {
	return &s
}
