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

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		_, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})

		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})

	t.Run("create bot without config permissions", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.Config().ServiceSettings.CreateBotAccounts = model.NewBool(false)

		_, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})

		CheckErrorMessage(t, resp, "api.bot.create_disabled")
	})

	t.Run("create bot with permissions", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		require.Equal(t, th.BasicUser.Id, createdBot.OwnerId)
	})

	t.Run("create invalid bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		_, resp := th.Client.CreateBot(&model.Bot{
			Username:    "username",
			DisplayName: "a bot",
			Description: strings.Repeat("x", 1025),
		})

		CheckErrorMessage(t, resp, "model.bot.is_valid.description.app_error")
	})

	t.Run("bot attempt to create bot fails", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_EDIT_OTHER_USERS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		bot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)
		th.App.UpdateUserRoles(bot.UserId, model.TEAM_USER_ROLE_ID+" "+model.SYSTEM_USER_ACCESS_TOKEN_ROLE_ID, false)

		rtoken, resp := th.Client.CreateUserAccessToken(bot.UserId, "test token")
		CheckNoError(t, resp)
		th.Client.AuthToken = rtoken.Token

		_, resp = th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			OwnerId:     bot.UserId,
			DisplayName: "a bot2",
			Description: "bot2",
		})
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
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

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		createdBot, resp := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp = th.Client.PatchBot(createdBot.UserId, &model.BotPatch{})
		CheckErrorMessage(t, resp, "store.sql_bot.get.missing.app_error")
	})

	t.Run("patch someone else's bot without permission, but with read others permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		require.Equal(t, th.SystemAdminUser.Id, patchedBot.OwnerId)
	})

	t.Run("patch my bot without permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		CheckErrorMessage(t, resp, "store.sql_bot.get.missing.app_error")
	})

	t.Run("patch my bot without permission, but with read permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		require.Equal(t, th.BasicUser.Id, patchedBot.OwnerId)
	})

	t.Run("partial patch my bot with permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		require.Equal(t, th.BasicUser.Id, patchedBot.OwnerId)
	})

	t.Run("update bot, internally managed fields ignored", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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

		require.Equal(t, th.BasicUser.Id, patchedBot.OwnerId)
	})
}

func TestGetBot(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.CreateBotAccounts = true
	})

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

	th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
	th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.CreateBotAccounts = true
	})

	myBot, resp := th.Client.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "my bot",
		Description: "a bot created by non-admin",
	})
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(myBot.UserId)
	th.RemovePermissionFromRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)

	t.Run("get unknown bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBot(model.NewId(), "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get bot1", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
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
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bot, resp := th.Client.GetBot(bot2.UserId, "")
		CheckOKStatus(t, resp)
		require.Equal(t, bot2, bot)

		bot, resp = th.Client.GetBot(bot2.UserId, bot.Etag())
		CheckEtag(t, bot, resp)
	})

	t.Run("get bot1 without READ_OTHERS_BOTS permission", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBot(bot1.UserId, "")
		CheckErrorMessage(t, resp, "store.sql_bot.get.missing.app_error")
	})

	t.Run("get myBot without READ_BOTS OR READ_OTHERS_BOTS permissions", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBot(myBot.UserId, "")
		CheckErrorMessage(t, resp, "store.sql_bot.get.missing.app_error")
	})

	t.Run("get deleted bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		_, resp := th.Client.GetBot(deletedBot.UserId, "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get deleted bot, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
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

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.CreateBotAccounts = true
	})

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

	th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
	th.App.UpdateUserRoles(th.BasicUser2.Id, model.TEAM_USER_ROLE_ID, false)
	th.LoginBasic2()
	orphanedBot, resp := th.Client.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "an oprphaned bot",
	})
	CheckCreatedStatus(t, resp)
	th.LoginBasic()
	defer th.App.PermanentDeleteBot(orphanedBot.UserId)
	// Automatic deactivation disabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = false
	})
	_, resp = th.SystemAdminClient.DeleteUser(th.BasicUser2.Id)
	CheckOKStatus(t, resp)

	t.Run("get bots, page=0, perPage=10", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(0, 10, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{bot1, bot2, bot3, orphanedBot}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBots(0, 10, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=1", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(0, 1, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{bot1}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBots(0, 1, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=1, perPage=2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(1, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{bot3, orphanedBot}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBots(1, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=2, perPage=2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBots(2, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBots(2, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=10, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(0, 10, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{bot1, deletedBot1, bot2, bot3, deletedBot2, orphanedBot}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBotsIncludeDeleted(0, 10, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=1, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(0, 1, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{bot1}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBotsIncludeDeleted(0, 1, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=1, perPage=2, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(1, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{bot2, bot3}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBotsIncludeDeleted(1, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=2, perPage=2, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsIncludeDeleted(2, 2, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{deletedBot2, orphanedBot}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBotsIncludeDeleted(2, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=10, only orphaned", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)

		bots, resp := th.Client.GetBotsOrphaned(0, 10, "")
		CheckOKStatus(t, resp)
		require.Equal(t, []*model.Bot{orphanedBot}, bots)

		botList := model.BotList(bots)
		bots, resp = th.Client.GetBotsOrphaned(0, 10, botList.Etag())
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
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp = th.Client.DisableBot(createdBot.UserId)
		CheckErrorMessage(t, resp, "store.sql_bot.get.missing.app_error")
	})

	t.Run("disable bot without permission, but with read permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

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
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		enabledBot1, resp := th.Client.DisableBot(bot.UserId)
		CheckOKStatus(t, resp)
		bot.UpdateAt = enabledBot1.UpdateAt
		bot.DeleteAt = enabledBot1.DeleteAt
		require.Equal(t, bot, enabledBot1)

		// Check bot disabled
		disab, resp := th.SystemAdminClient.GetBotIncludeDeleted(bot.UserId, "")
		CheckOKStatus(t, resp)
		require.NotZero(t, disab.DeleteAt)

		// Disabling should be idempotent.
		enabledBot2, resp := th.Client.DisableBot(bot.UserId)
		CheckOKStatus(t, resp)
		require.Equal(t, bot, enabledBot2)
	})
}
func TestEnableBot(t *testing.T) {
	t.Run("enable non-existent bot", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		_, resp := th.Client.EnableBot(model.NewId())
		CheckNotFoundStatus(t, resp)
	})

	t.Run("enable bot without permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp = th.SystemAdminClient.DisableBot(createdBot.UserId)
		CheckOKStatus(t, resp)

		_, resp = th.Client.EnableBot(createdBot.UserId)
		CheckErrorMessage(t, resp, "store.sql_bot.get.missing.app_error")
	})

	t.Run("enable bot without permission, but with read permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp = th.SystemAdminClient.DisableBot(createdBot.UserId)
		CheckOKStatus(t, resp)

		_, resp = th.Client.EnableBot(createdBot.UserId)
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")
	})

	t.Run("enable bot with permission", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.TEAM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.TEAM_USER_ROLE_ID)
		th.App.UpdateUserRoles(th.BasicUser.Id, model.TEAM_USER_ROLE_ID, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		})
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		_, resp = th.SystemAdminClient.DisableBot(bot.UserId)
		CheckOKStatus(t, resp)

		enabledBot1, resp := th.Client.EnableBot(bot.UserId)
		CheckOKStatus(t, resp)
		bot.UpdateAt = enabledBot1.UpdateAt
		bot.DeleteAt = enabledBot1.DeleteAt
		require.Equal(t, bot, enabledBot1)

		// Check bot enabled
		enab, resp := th.SystemAdminClient.GetBotIncludeDeleted(bot.UserId, "")
		CheckOKStatus(t, resp)
		require.Zero(t, enab.DeleteAt)

		// Disabling should be idempotent.
		enabledBot2, resp := th.Client.EnableBot(bot.UserId)
		CheckOKStatus(t, resp)
		require.Equal(t, bot, enabledBot2)
	})
}

func TestAssignBot(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	t.Run("claim non-existent bot", func(t *testing.T) {
		_, resp := th.SystemAdminClient.AssignBot(model.NewId(), model.NewId())
		CheckNotFoundStatus(t, resp)
	})

	t.Run("system admin assign bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		bot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		before, resp := th.Client.GetBot(bot.UserId, "")
		CheckOKStatus(t, resp)
		require.Equal(t, th.BasicUser.Id, before.OwnerId)

		_, resp = th.SystemAdminClient.AssignBot(bot.UserId, th.SystemAdminUser.Id)
		CheckOKStatus(t, resp)

		// Original owner doesn't have read others bots permission, therefore can't see bot anymore
		_, resp = th.Client.GetBot(bot.UserId, "")
		CheckNotFoundStatus(t, resp)

		// System admin can see creator ID has changed
		after, resp := th.SystemAdminClient.GetBot(bot.UserId, "")
		CheckOKStatus(t, resp)
		require.Equal(t, th.SystemAdminUser.Id, after.OwnerId)

		// Assign back to user without permissions to manage
		_, resp = th.SystemAdminClient.AssignBot(bot.UserId, th.BasicUser.Id)
		CheckOKStatus(t, resp)

		after, resp = th.SystemAdminClient.GetBot(bot.UserId, "")
		CheckOKStatus(t, resp)
		require.Equal(t, th.BasicUser.Id, after.OwnerId)
	})

	t.Run("random user assign bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		createdBot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		th.LoginBasic2()

		// Without permission to read others bots it doesn't exist
		_, resp = th.Client.AssignBot(createdBot.UserId, th.BasicUser2.Id)
		CheckErrorMessage(t, resp, "store.sql_bot.get.missing.app_error")

		// With permissions to read we don't have permissions to modify
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		_, resp = th.Client.AssignBot(createdBot.UserId, th.BasicUser2.Id)
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")

		th.LoginBasic()
	})

	t.Run("delegated user assign bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CreateBotAccounts = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		bot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		// Simulate custom role by just changing the system user role
		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.LoginBasic2()

		_, resp = th.Client.AssignBot(bot.UserId, th.BasicUser2.Id)
		CheckOKStatus(t, resp)

		after, resp := th.SystemAdminClient.GetBot(bot.UserId, "")
		CheckOKStatus(t, resp)
		require.Equal(t, th.BasicUser2.Id, after.OwnerId)
	})

	t.Run("bot assigned to bot fails", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PERMISSION_CREATE_BOT.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_READ_OTHERS_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_BOTS.Id, model.SYSTEM_USER_ROLE_ID)
		th.AddPermissionToRole(model.PERMISSION_MANAGE_OTHERS_BOTS.Id, model.SYSTEM_USER_ROLE_ID)

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		bot, resp := th.Client.CreateBot(bot)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		bot2, resp := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})

		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot2.UserId)

		_, resp = th.Client.AssignBot(bot.UserId, bot2.UserId)
		CheckErrorMessage(t, resp, "api.context.permissions.app_error")

	})
}

func sToP(s string) *string {
	return &s
}
