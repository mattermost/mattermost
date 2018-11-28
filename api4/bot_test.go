// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"io/ioutil"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestCreateBot(t *testing.T) {
	t.Run("create bot without permissions", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		_, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})

		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})

	t.Run("create bot with permissions", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		}

		createdBot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)
		require.Equal(t, bot.Username, createdBot.Username)
		require.Equal(t, bot.DisplayName, createdBot.DisplayName)
		require.Equal(t, bot.Description, createdBot.Description)
		require.Equal(t, th.BasicUser.Id, createdBot.CreatorId)
	})

	t.Run("create invalid bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.CreateBot(&model.Bot{
			Username:    "username",
			DisplayName: "a bot",
			Description: strings.Repeat("x", 1025),
		})

		CheckErrorMessage(t, resp, "model.bot.is_valid.description.app_error")
	})
}

func TestPatchBot(t *testing.T) {
	t.Run("patch non-existent bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		_, resp := th.SystemAdminClient.PatchBot(model.NewId(), &model.BotPatch{})
		CheckNotFoundStatus(t, resp)
	})

	t.Run("patch someone else's bot without permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp = th.Client.PatchBot(createdBot.UserId, &model.BotPatch{})
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})

	t.Run("patch someone else's bot with permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP(GenerateTestUsername()),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		patchedBot, resp := th.Client.PatchBot(createdBot.UserId, botPatch)
		CheckOKStatus(t, resp)
		require.Equal(t, *botPatch.Username, patchedBot.Username)
		require.Equal(t, *botPatch.DisplayName, patchedBot.DisplayName)
		require.Equal(t, *botPatch.Description, patchedBot.Description)
		require.Equal(t, th.SystemAdminUser.Id, patchedBot.CreatorId)
	})

	t.Run("patch my bot without permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP(GenerateTestUsername()),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		_, resp = th.Client.PatchBot(createdBot.UserId, botPatch)
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})

	t.Run("patch my bot with permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP(GenerateTestUsername()),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		patchedBot, resp := th.Client.PatchBot(createdBot.UserId, botPatch)
		CheckOKStatus(t, resp)
		require.Equal(t, *botPatch.Username, patchedBot.Username)
		require.Equal(t, *botPatch.DisplayName, patchedBot.DisplayName)
		require.Equal(t, *botPatch.Description, patchedBot.Description)
		require.Equal(t, th.BasicUser.Id, patchedBot.CreatorId)
	})

	t.Run("partial patch my bot with permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		}

		createdBot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username: sToP(GenerateTestUsername()),
		}

		patchedBot, resp := th.Client.PatchBot(createdBot.UserId, botPatch)
		CheckOKStatus(t, resp)
		require.Equal(t, *botPatch.Username, patchedBot.Username)
		require.Equal(t, bot.DisplayName, patchedBot.DisplayName)
		require.Equal(t, bot.Description, patchedBot.Description)
		require.Equal(t, th.BasicUser.Id, patchedBot.CreatorId)
	})

	t.Run("update bot, internally managed fields ignored", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		createdBot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		r, err := th.Client.DoApiPut(th.Client.GetBotRoute(createdBot.UserId), `{"creator_id":"`+th.BasicUser2.Id+`"}`)
		require.Nil(t, err)
		defer func() {
			_, _ = ioutil.ReadAll(r.Body)
			_ = r.Body.Close()
		}()
		patchedBot := model.BotFromJson(r.Body)
		resp = model.BuildResponse(r)
		CheckOKStatus(t, resp)

		require.Equal(t, th.BasicUser.Id, patchedBot.CreatorId)
	})
}

func TestGetBot(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	bot1, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "the first bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	bot2, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "another bot",
		Description: "the second bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	deletedBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "a deleted bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(deletedBot.UserId)
	deletedBot, resp = th.SystemAdminClient.DisableBot(deletedBot.UserId)
	CheckOKStatus(t, resp)

	t.Run("get unknown bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBot(model.NewId(), "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get bot1", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot, resp := th.Client.GetBot(bot1.UserId, "")
		CheckOKStatus(t, resp)
		require.Equal(t, bot1, bot)

		bot, resp = th.Client.GetBot(bot1.UserId, bot.Etag())
		CheckEtag(t, bot, resp)
	})

	t.Run("get bot2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot, resp := th.Client.GetBot(bot2.UserId, "")
		CheckOKStatus(t, resp)
		require.Equal(t, bot2, bot)

		bot, resp = th.Client.GetBot(bot2.UserId, bot.Etag())
		CheckEtag(t, bot, resp)
	})

	t.Run("get bot1 without permission", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBot(bot1.UserId, "")
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})

	t.Run("get deleted bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBot(deletedBot.UserId, "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get deleted bot, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot, resp := th.Client.GetBotIncludeDeleted(deletedBot.UserId, "")
		CheckOKStatus(t, resp)
		require.NotEqual(t, 0, bot.DeleteAt)
		deletedBot.UpdateAt = bot.UpdateAt
		deletedBot.DeleteAt = bot.DeleteAt
		require.Equal(t, deletedBot, bot)

		bot, resp = th.Client.GetBotIncludeDeleted(deletedBot.UserId, bot.Etag())
		CheckEtag(t, bot, resp)
	})
}

func TestGetBots(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	bot1, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "the first bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	deletedBot1, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "a deleted bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(deletedBot1.UserId)
	deletedBot1, resp = th.SystemAdminClient.DisableBot(deletedBot1.UserId)
	CheckOKStatus(t, resp)

	bot2, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "another bot",
		Description: "the second bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	bot3, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "another bot",
		Description: "the third bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot3.UserId)

	deletedBot2, resp := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "a deleted bot",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(deletedBot2.UserId)
	deletedBot2, resp = th.SystemAdminClient.DisableBot(deletedBot2.UserId)
	CheckOKStatus(t, resp)

	t.Run("get bots, page=0, perPage=10", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(0, 10, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{bot1, bot2, bot3}, bots)

		bots, resp = th.Client.GetBots(0, 10, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=1", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(0, 1, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{bot1}, bots)

		bots, resp = th.Client.GetBots(0, 1, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=1, perPage=2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(1, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{bot3}, bots)

		bots, resp = th.Client.GetBots(1, 2, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=2, perPage=2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(2, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{}, bots)

		bots, resp = th.Client.GetBots(2, 2, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=10, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(0, 10, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{bot1, deletedBot1, bot2, bot3, deletedBot2}, bots)

		bots, resp = th.Client.GetBotsIncludeDeleted(0, 10, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=1, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(0, 1, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{bot1}, bots)

		bots, resp = th.Client.GetBotsIncludeDeleted(0, 1, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=1, perPage=2, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(1, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{bot2, bot3}, bots)

		bots, resp = th.Client.GetBotsIncludeDeleted(1, 2, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=2, perPage=2, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(2, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, model.BotList{deletedBot2}, bots)

		bots, resp = th.Client.GetBotsIncludeDeleted(2, 2, bots.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots without permission", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBots(0, 10, "")
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})
}

func TestDisableBot(t *testing.T) {
	t.Run("disable non-existent bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		_, resp := th.Client.DisableBot(model.NewId())
		CheckNotFoundStatus(t, resp)
	})

	t.Run("disable bot without permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp = th.Client.DisableBot(createdBot.UserId)
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})

	t.Run("disable bot with permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		disabledBot1, resp := th.Client.DisableBot(bot.UserId)
		CheckOKStatus(t, resp)
		bot.UpdateAt = disabledBot1.UpdateAt
		bot.DeleteAt = disabledBot1.DeleteAt
		require.Equal(t, bot, disabledBot1)

		// Disabling should be idempotent.
		disabledBot2, resp := th.Client.DisableBot(bot.UserId)
		CheckOKStatus(t, resp)
		require.Equal(t, bot, disabledBot2)
	})
}

func sToP(s string) *string {
	return &s
}
