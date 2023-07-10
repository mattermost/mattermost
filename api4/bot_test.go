// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestCreateBot(t *testing.T) {
	t.Run("create bot without permissions", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		_, _, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})

		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("create bot without config permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.Config().ServiceSettings.EnableBotAccountCreation = model.NewBool(false)

		_, _, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})

		CheckErrorID(t, err, "api.bot.create_disabled")
	})

	t.Run("create bot with permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		}

		createdBot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)
		require.Equal(t, bot.Username, createdBot.Username)
		require.Equal(t, bot.DisplayName, createdBot.DisplayName)
		require.Equal(t, bot.Description, createdBot.Description)
		require.Equal(t, th.BasicUser.Id, createdBot.OwnerId)
	})

	t.Run("create invalid bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		_, _, err := th.Client.CreateBot(&model.Bot{
			Username:    "username",
			DisplayName: "a bot",
			Description: strings.Repeat("x", 1025),
		})

		CheckErrorID(t, err, "model.bot.is_valid.description.app_error")
	})

	t.Run("bot attempt to create bot fails", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionEditOtherUsers.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		bot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)
		th.App.UpdateUserRoles(th.Context, bot.UserId, model.TeamUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)

		rtoken, _, err := th.Client.CreateUserAccessToken(bot.UserId, "test token")
		require.NoError(t, err)
		th.Client.AuthToken = rtoken.Token

		_, _, err = th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			OwnerId:     bot.UserId,
			DisplayName: "a bot2",
			Description: "bot2",
		})
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

}

func TestPatchBot(t *testing.T) {
	t.Run("patch non-existent bot", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			_, resp, err := client.PatchBot(model.NewId(), &model.BotPatch{})
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})

	t.Run("system admin and local client can patch any bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot created by a user",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			botPatch := &model.BotPatch{
				Username:    sToP(GenerateTestUsername()),
				DisplayName: sToP("an updated bot"),
				Description: sToP("updated bot"),
			}
			patchedBot, patchResp, err2 := client.PatchBot(createdBot.UserId, botPatch)
			require.NoError(t, err2)
			CheckOKStatus(t, patchResp)
			require.Equal(t, *botPatch.Username, patchedBot.Username)
			require.Equal(t, *botPatch.DisplayName, patchedBot.DisplayName)
			require.Equal(t, *botPatch.Description, patchedBot.Description)
			require.Equal(t, th.BasicUser.Id, patchedBot.OwnerId)
		}, "bot created by user")

		createdBotSystemAdmin, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "another bot",
			Description: "bot created by system admin user",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBotSystemAdmin.UserId)

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			botPatch := &model.BotPatch{
				Username:    sToP(GenerateTestUsername()),
				DisplayName: sToP("an updated bot"),
				Description: sToP("updated bot"),
			}
			patchedBot, patchResp, err := client.PatchBot(createdBotSystemAdmin.UserId, botPatch)
			require.NoError(t, err)
			CheckOKStatus(t, patchResp)
			require.Equal(t, *botPatch.Username, patchedBot.Username)
			require.Equal(t, *botPatch.DisplayName, patchedBot.DisplayName)
			require.Equal(t, *botPatch.Description, patchedBot.Description)
			require.Equal(t, th.SystemAdminUser.Id, patchedBot.OwnerId)
		}, "bot created by system admin")
	})

	t.Run("patch someone else's bot without permission", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, _, err = th.Client.PatchBot(createdBot.UserId, &model.BotPatch{})
		CheckErrorID(t, err, "store.sql_bot.get.missing.app_error")
	})

	t.Run("patch someone else's bot without permission, but with read others permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, _, err = th.Client.PatchBot(createdBot.UserId, &model.BotPatch{})
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("patch someone else's bot with permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP(GenerateTestUsername()),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		patchedBot, resp, err := th.Client.PatchBot(createdBot.UserId, botPatch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, *botPatch.Username, patchedBot.Username)
		require.Equal(t, *botPatch.DisplayName, patchedBot.DisplayName)
		require.Equal(t, *botPatch.Description, patchedBot.Description)
		require.Equal(t, th.SystemAdminUser.Id, patchedBot.OwnerId)

		// Continue through the bot update process (call UpdateUserRoles), then
		// get the bot, to make sure the patched bot was correctly saved.
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageRoles.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		resp, err = th.Client.UpdateUserRoles(createdBot.UserId, model.SystemUserRoleId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		bots, resp, err := th.Client.GetBots(0, 2, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, bots, 1)
		require.Equal(t, []*model.Bot{patchedBot}, bots)
	})

	t.Run("patch my bot without permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP(GenerateTestUsername()),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		_, _, err = th.Client.PatchBot(createdBot.UserId, botPatch)
		CheckErrorID(t, err, "store.sql_bot.get.missing.app_error")
	})

	t.Run("patch my bot without permission, but with read permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP(GenerateTestUsername()),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		_, _, err = th.Client.PatchBot(createdBot.UserId, botPatch)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("patch my bot with permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username:    sToP(GenerateTestUsername()),
			DisplayName: sToP("an updated bot"),
			Description: sToP("updated bot"),
		}

		patchedBot, resp, err := th.Client.PatchBot(createdBot.UserId, botPatch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, *botPatch.Username, patchedBot.Username)
		require.Equal(t, *botPatch.DisplayName, patchedBot.DisplayName)
		require.Equal(t, *botPatch.Description, patchedBot.Description)
		require.Equal(t, th.BasicUser.Id, patchedBot.OwnerId)
	})

	t.Run("partial patch my bot with permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		}

		createdBot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		botPatch := &model.BotPatch{
			Username: sToP(GenerateTestUsername()),
		}

		patchedBot, resp, err := th.Client.PatchBot(createdBot.UserId, botPatch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, *botPatch.Username, patchedBot.Username)
		require.Equal(t, bot.DisplayName, patchedBot.DisplayName)
		require.Equal(t, bot.Description, patchedBot.Description)
		require.Equal(t, th.BasicUser.Id, patchedBot.OwnerId)
	})

	t.Run("update bot, internally managed fields ignored", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		createdBot, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		r, err := th.Client.DoAPIPut("/bots/"+createdBot.UserId, `{"creator_id":"`+th.BasicUser2.Id+`"}`)
		require.NoError(t, err)
		defer func() {
			_, _ = io.ReadAll(r.Body)
			_ = r.Body.Close()
		}()
		var patchedBot *model.Bot
		err = json.NewDecoder(r.Body).Decode(&patchedBot)
		require.NoError(t, err)

		resp = model.BuildResponse(r)
		CheckOKStatus(t, resp)

		require.Equal(t, th.BasicUser.Id, patchedBot.OwnerId)
	})
}

func TestGetBot(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})

	bot1, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "the first bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	bot2, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "another bot",
		Description: "the second bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	deletedBot, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "a deleted bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(deletedBot.UserId)
	deletedBot, resp, err = th.SystemAdminClient.DisableBot(deletedBot.UserId)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})

	myBot, resp, err := th.Client.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "my bot",
		Description: "a bot created by non-admin",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(myBot.UserId)
	th.RemovePermissionFromRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)

	t.Run("get unknown bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		_, resp, err := th.Client.GetBot(model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get bot1", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		bot, resp, err := th.Client.GetBot(bot1.UserId, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, bot1, bot)

		bot, resp, _ = th.Client.GetBot(bot1.UserId, bot.Etag())
		CheckEtag(t, bot, resp)
	})

	t.Run("get bot2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		bot, resp, err := th.Client.GetBot(bot2.UserId, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, bot2, bot)

		bot, resp, _ = th.Client.GetBot(bot2.UserId, bot.Etag())
		CheckEtag(t, bot, resp)
	})

	t.Run("get bot1 without PermissionReadOthersBots permission", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		_, _, err := th.Client.GetBot(bot1.UserId, "")
		CheckErrorID(t, err, "store.sql_bot.get.missing.app_error")
	})

	t.Run("get myBot without ReadBots OR ReadOthersBots permissions", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		_, _, err := th.Client.GetBot(myBot.UserId, "")
		CheckErrorID(t, err, "store.sql_bot.get.missing.app_error")
	})

	t.Run("get deleted bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		_, resp, err := th.Client.GetBot(deletedBot.UserId, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get deleted bot, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		bot, resp, err := th.Client.GetBotIncludeDeleted(deletedBot.UserId, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEqual(t, 0, bot.DeleteAt)
		deletedBot.UpdateAt = bot.UpdateAt
		deletedBot.DeleteAt = bot.DeleteAt
		require.Equal(t, deletedBot, bot)

		bot, resp, _ = th.Client.GetBotIncludeDeleted(deletedBot.UserId, bot.Etag())
		CheckEtag(t, bot, resp)
	})
}

func TestGetBots(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})

	bot1, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "a bot",
		Description: "the first bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot1.UserId)

	deletedBot1, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "a deleted bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(deletedBot1.UserId)
	deletedBot1, resp, err = th.SystemAdminClient.DisableBot(deletedBot1.UserId)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	bot2, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "another bot",
		Description: "the second bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot2.UserId)

	bot3, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		DisplayName: "another bot",
		Description: "the third bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot3.UserId)

	deletedBot2, resp, err := th.SystemAdminClient.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "a deleted bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(deletedBot2.UserId)
	deletedBot2, resp, err = th.SystemAdminClient.DisableBot(deletedBot2.UserId)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
	th.App.UpdateUserRoles(th.Context, th.BasicUser2.Id, model.TeamUserRoleId, false)
	th.LoginBasic2()
	orphanedBot, resp, err := th.Client.CreateBot(&model.Bot{
		Username:    GenerateTestUsername(),
		Description: "an orphaned bot",
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	th.LoginBasic()
	defer th.App.PermanentDeleteBot(orphanedBot.UserId)
	// Automatic deactivation disabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated = false
	})
	resp, err = th.SystemAdminClient.DeleteUser(th.BasicUser2.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	t.Run("get bots, page=0, perPage=10", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{bot1, bot2, bot3, orphanedBot}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBots(0, 10, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBots(0, 10, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=1", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{bot1}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBots(0, 1, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBots(0, 1, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=1, perPage=2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{bot3, orphanedBot}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBots(1, 2, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBots(1, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=2, perPage=2", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBots(2, 2, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBots(2, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=10, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{bot1, deletedBot1, bot2, bot3, deletedBot2, orphanedBot}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBotsIncludeDeleted(0, 10, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBotsIncludeDeleted(0, 10, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=1, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{bot1}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBotsIncludeDeleted(0, 1, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBotsIncludeDeleted(0, 1, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=1, perPage=2, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{bot2, bot3}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBotsIncludeDeleted(1, 2, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBotsIncludeDeleted(1, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=2, perPage=2, include deleted", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{deletedBot2, orphanedBot}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBotsIncludeDeleted(2, 2, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBotsIncludeDeleted(2, 2, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots, page=0, perPage=10, only orphaned", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		expectedBotList := []*model.Bot{orphanedBot}
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bots, resp, err := client.GetBotsOrphaned(0, 10, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, expectedBotList, bots)
		})

		botList := model.BotList(expectedBotList)
		bots, resp, _ := th.Client.GetBotsOrphaned(0, 10, botList.Etag())
		CheckEtag(t, bots, resp)
	})

	t.Run("get bots without permission", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)

		_, _, err := th.Client.GetBots(0, 10, "")
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})
}

func TestDisableBot(t *testing.T) {
	t.Run("disable non-existent bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			_, resp, err := client.DisableBot(model.NewId())
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})

	t.Run("disable bot without permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, _, err = th.Client.DisableBot(createdBot.UserId)
		CheckErrorID(t, err, "store.sql_bot.get.missing.app_error")
	})

	t.Run("disable bot without permission, but with read permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, _, err = th.Client.DisableBot(createdBot.UserId)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("disable bot with permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bot, resp, err := th.Client.CreateBot(&model.Bot{
				Username:    GenerateTestUsername(),
				Description: "bot",
			})
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			defer th.App.PermanentDeleteBot(bot.UserId)

			disabledBot, resp, err := client.DisableBot(bot.UserId)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			bot.UpdateAt = disabledBot.UpdateAt
			bot.DeleteAt = disabledBot.DeleteAt
			require.Equal(t, bot, disabledBot)

			// Check bot disabled
			disab, resp, err := th.SystemAdminClient.GetBotIncludeDeleted(bot.UserId, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.NotZero(t, disab.DeleteAt)

			// Disabling should be idempotent.
			disabledBot2, resp, err := client.DisableBot(bot.UserId)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, bot, disabledBot2)
		})
	})
}
func TestEnableBot(t *testing.T) {
	t.Run("enable non-existent bot", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			_, resp, err := th.Client.EnableBot(model.NewId())
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})

	t.Run("enable bot without permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp, err = th.SystemAdminClient.DisableBot(createdBot.UserId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, _, err = th.Client.EnableBot(createdBot.UserId)
		CheckErrorID(t, err, "store.sql_bot.get.missing.app_error")
	})

	t.Run("enable bot without permission, but with read permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}

		createdBot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		_, resp, err = th.SystemAdminClient.DisableBot(createdBot.UserId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, _, err = th.Client.EnableBot(createdBot.UserId)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("enable bot with permission", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.TeamUserRoleId)
		th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			bot, resp, err := th.Client.CreateBot(&model.Bot{
				Username:    GenerateTestUsername(),
				Description: "bot",
			})
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			defer th.App.PermanentDeleteBot(bot.UserId)

			_, resp, err = th.SystemAdminClient.DisableBot(bot.UserId)
			require.NoError(t, err)
			CheckOKStatus(t, resp)

			enabledBot1, resp, err := client.EnableBot(bot.UserId)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			bot.UpdateAt = enabledBot1.UpdateAt
			bot.DeleteAt = enabledBot1.DeleteAt
			require.Equal(t, bot, enabledBot1)

			// Check bot enabled
			enab, resp, err := th.SystemAdminClient.GetBotIncludeDeleted(bot.UserId, "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Zero(t, enab.DeleteAt)

			// Disabling should be idempotent.
			enabledBot2, resp, err := client.EnableBot(bot.UserId)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Equal(t, bot, enabledBot2)
		})
	})
}

func TestAssignBot(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("claim non-existent bot", func(t *testing.T) {
		th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
			_, resp, err := client.AssignBot(model.NewId(), model.NewId())
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})

	t.Run("system admin and local mode assign bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.SystemUserRoleId)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		bot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		before, resp, err := th.Client.GetBot(bot.UserId, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, th.BasicUser.Id, before.OwnerId)

		_, resp, err = th.SystemAdminClient.AssignBot(bot.UserId, th.SystemAdminUser.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Original owner doesn't have read others bots permission, therefore can't see bot anymore
		_, resp, err = th.Client.GetBot(bot.UserId, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// System admin can see creator ID has changed
		after, resp, err := th.SystemAdminClient.GetBot(bot.UserId, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, th.SystemAdminUser.Id, after.OwnerId)

		// Assign back to user without permissions to manage, using local mode
		_, resp, err = th.LocalClient.AssignBot(bot.UserId, th.BasicUser.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		after, resp, err = th.SystemAdminClient.GetBot(bot.UserId, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, th.BasicUser.Id, after.OwnerId)
	})

	t.Run("random user assign bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.SystemUserRoleId)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		createdBot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(createdBot.UserId)

		th.LoginBasic2()

		// Without permission to read others bots it doesn't exist
		_, _, err = th.Client.AssignBot(createdBot.UserId, th.BasicUser2.Id)
		CheckErrorID(t, err, "store.sql_bot.get.missing.app_error")

		// With permissions to read we don't have permissions to modify
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.SystemUserRoleId)
		_, _, err = th.Client.AssignBot(createdBot.UserId, th.BasicUser2.Id)
		CheckErrorID(t, err, "api.context.permissions.app_error")

		th.LoginBasic()
	})

	t.Run("delegated user assign bot", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.SystemUserRoleId)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
		})

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		bot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		// Simulate custom role by just changing the system user role
		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.SystemUserRoleId)
		th.LoginBasic2()

		_, resp, err = th.Client.AssignBot(bot.UserId, th.BasicUser2.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		after, resp, err := th.SystemAdminClient.GetBot(bot.UserId, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, th.BasicUser2.Id, after.OwnerId)
	})

	t.Run("bot assigned to bot fails", func(t *testing.T) {
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		th.AddPermissionToRole(model.PermissionCreateBot.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionReadBots.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionReadOthersBots.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionManageBots.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionManageOthersBots.Id, model.SystemUserRoleId)

		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		bot, resp, err := th.Client.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot.UserId)

		bot2, resp, err := th.Client.CreateBot(&model.Bot{
			Username:    GenerateTestUsername(),
			DisplayName: "a bot",
			Description: "bot",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		defer th.App.PermanentDeleteBot(bot2.UserId)

		_, _, err = th.Client.AssignBot(bot.UserId, bot2.UserId)
		CheckErrorID(t, err, "api.context.permissions.app_error")

	})
}

func TestConvertBotToUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateBot.Id, model.TeamUserRoleId)
	th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})

	bot := &model.Bot{
		Username:    GenerateTestUsername(),
		Description: "bot",
	}
	bot, resp, err := th.Client.CreateBot(bot)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	defer th.App.PermanentDeleteBot(bot.UserId)

	_, resp, err = th.Client.ConvertBotToUser(bot.UserId, &model.UserPatch{}, false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	user, resp, err := th.Client.ConvertBotToUser(bot.UserId, &model.UserPatch{Password: model.NewString("password")}, false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	require.Nil(t, user)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		bot := &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "bot",
		}
		bot, resp, err := th.SystemAdminClient.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		user, resp, err := client.ConvertBotToUser(bot.UserId, &model.UserPatch{}, false)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Nil(t, user)

		user, _, err = client.ConvertBotToUser(bot.UserId, &model.UserPatch{Password: model.NewString("password")}, false)
		require.NoError(t, err)
		require.NotNil(t, user)
		require.Equal(t, bot.UserId, user.Id)

		_, resp, err = client.GetBot(bot.UserId, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		bot = &model.Bot{
			Username:    GenerateTestUsername(),
			Description: "systemAdminBot",
		}
		bot, resp, err = th.SystemAdminClient.CreateBot(bot)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		user, _, err = client.ConvertBotToUser(bot.UserId, &model.UserPatch{Password: model.NewString("password")}, true)
		require.NoError(t, err)
		require.NotNil(t, user)
		require.Equal(t, bot.UserId, user.Id)
		require.Contains(t, user.GetRoles(), model.SystemAdminRoleId)

		_, resp, err = client.GetBot(bot.UserId, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func sToP(s string) *string {
	return &s
}
