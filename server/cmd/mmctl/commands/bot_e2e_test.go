// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestListBotCmdF() {
	s.SetupTestHelper().InitBasic().DeleteBots()

	s.RunForSystemAdminAndLocal("List Bot", func(c client.Client) {
		printer.Clean()

		bot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: s.th.BasicUser.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, bot.UserId)
			s.Require().Nil(err)
		}()

		deletedBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: s.th.BasicUser.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, deletedBot.UserId)
			s.Require().Nil(err)
		}()

		deletedBot, appErr = s.th.App.UpdateBotActive(s.th.Context, deletedBot.UserId, false)
		s.Require().Nil(appErr)

		err := botListCmdF(c, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Equal(1, len(printer.GetLines()))

		listedBot, ok := printer.GetLines()[0].(*model.Bot)
		s.Require().True(ok)
		s.Require().Equal(bot.Username, listedBot.Username)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("List Bot only orphaned", func(c client.Client) {
		printer.Clean()

		user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId(), DeleteAt: 1})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteUser(s.th.Context, user)
			s.Require().Nil(err)
		}()

		bot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: s.th.BasicUser.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, bot.UserId)
			s.Require().Nil(err)
		}()

		deletedBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, deletedBot.UserId)
			s.Require().Nil(err)
		}()

		deletedBot, appErr = s.th.App.UpdateBotActive(s.th.Context, deletedBot.UserId, false)
		s.Require().Nil(appErr)

		orphanBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, orphanBot.UserId)
			s.Require().Nil(err)
		}()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("orphaned", true, "")

		err := botListCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Equal(1, len(printer.GetLines()))

		listedBot, ok := printer.GetLines()[0].(*model.Bot)
		s.Require().True(ok)
		s.Require().Equal(orphanBot.Username, listedBot.Username)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("List all Bots", func(c client.Client) {
		printer.Clean()

		user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId(), DeleteAt: 1})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteUser(s.th.Context, user)
			s.Require().Nil(err)
		}()

		bot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: s.th.BasicUser2.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, bot.UserId)
			s.Require().Nil(err)
		}()

		orphanBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, orphanBot.UserId)
			s.Require().Nil(err)
		}()

		deletedBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: s.th.BasicUser2.Id})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, deletedBot.UserId)
			s.Require().Nil(err)
		}()

		deletedBot, appErr = s.th.App.UpdateBotActive(s.th.Context, deletedBot.UserId, false)
		s.Require().Nil(appErr)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("all", true, "")

		err := botListCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Equal(3, len(printer.GetLines()))
		resultBot, ok := printer.GetLines()[0].(*model.Bot)
		s.True(ok)
		s.Require().Equal(bot, resultBot)
		resultOrphanBot, ok := printer.GetLines()[1].(*model.Bot)
		s.True(ok)
		s.Require().Equal(orphanBot, resultOrphanBot)
		resultDeletedBot, ok := printer.GetLines()[2].(*model.Bot)
		s.True(ok)
		s.Require().Equal(deletedBot, resultDeletedBot)
	})

	s.Run("List Bots without permission", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		err := botListCmdF(s.th.Client, cmd, []string{})
		s.Require().Error(err)
		s.Require().Equal("Failed to fetch bots: You do not have the appropriate permissions.", err.Error())
	})
}

func (s *MmctlE2ETestSuite) TestBotEnableCmd() {
	s.SetupTestHelper().InitBasic()
	s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableBotAccountCreation = true })

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("enable a bot", func(c client.Client) {
		printer.Clean()

		newBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdateBotActive(s.th.Context, newBot.UserId, false)
		s.Require().Nil(appErr)

		err := botEnableCmdF(c, &cobra.Command{}, []string{newBot.UserId})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		printedBot := printer.GetLines()[0].(*model.Bot)
		s.Require().Equal(newBot.UserId, printedBot.UserId)
		s.Require().Equal(newBot.Username, printedBot.Username)
		s.Require().Equal(newBot.OwnerId, printedBot.OwnerId)

		bot, appErr := s.th.App.GetBot(s.th.Context, newBot.UserId, false)
		s.Require().Nil(appErr)
		s.Require().Equal(newBot.UserId, bot.UserId)
		s.Require().Equal(newBot.Username, bot.Username)
		s.Require().Equal(newBot.OwnerId, bot.OwnerId)
	})

	s.Run("enable a bot without permissions", func() {
		printer.Clean()

		newBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdateBotActive(s.th.Context, newBot.UserId, false)
		s.Require().Nil(appErr)

		err := botEnableCmdF(s.th.Client, &cobra.Command{}, []string{newBot.UserId})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		s.Require().Contains(printer.GetErrorLines()[0], "could not enable bot")
	})

	s.RunForSystemAdminAndLocal("enable a nonexistent bot", func(c client.Client) {
		printer.Clean()

		err := botEnableCmdF(c, &cobra.Command{}, []string{"nonexistent-bot-userid"})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		s.Require().Contains(printer.GetErrorLines()[0], "can't find user 'nonexistent-bot-userid'")
	})

	s.RunForSystemAdminAndLocal("enable an already enabled bot", func(c client.Client) {
		printer.Clean()

		newBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdateBotActive(s.th.Context, newBot.UserId, true)
		s.Require().Nil(appErr)

		err := botEnableCmdF(c, &cobra.Command{}, []string{newBot.UserId})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		printedBot := printer.GetLines()[0].(*model.Bot)
		s.Require().Equal(newBot.UserId, printedBot.UserId)
		s.Require().Equal(newBot.Username, printedBot.Username)
		s.Require().Equal(newBot.OwnerId, printedBot.OwnerId)

		bot, appErr := s.th.App.GetBot(s.th.Context, newBot.UserId, false)
		s.Require().Nil(appErr)
		s.Require().Equal(newBot.UserId, bot.UserId)
		s.Require().Equal(newBot.Username, bot.Username)
		s.Require().Equal(newBot.OwnerId, bot.OwnerId)
	})
}

func (s *MmctlE2ETestSuite) TestBotDisableCmd() {
	s.SetupTestHelper().InitBasic()
	s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableBotAccountCreation = true })

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("disable a bot", func(c client.Client) {
		printer.Clean()

		newBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdateBotActive(s.th.Context, newBot.UserId, true)
		s.Require().Nil(appErr)

		err := botDisableCmdF(c, &cobra.Command{}, []string{newBot.UserId})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		printedBot := printer.GetLines()[0].(*model.Bot)
		s.Require().Equal(newBot.UserId, printedBot.UserId)
		s.Require().Equal(newBot.Username, printedBot.Username)
		s.Require().Equal(newBot.OwnerId, printedBot.OwnerId)

		_, appErr = s.th.App.GetBot(s.th.Context, newBot.UserId, false)
		s.Require().NotNil(appErr)
		s.Require().Equal("store.sql_bot.get.missing.app_error", appErr.Id)
	})

	s.Run("disable a bot without permissions", func() {
		printer.Clean()

		newBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdateBotActive(s.th.Context, newBot.UserId, true)
		s.Require().Nil(appErr)

		err := botDisableCmdF(s.th.Client, &cobra.Command{}, []string{newBot.UserId})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		s.Require().Contains(printer.GetErrorLines()[0], "could not disable bot")
	})

	s.RunForSystemAdminAndLocal("disable a nonexistent bot", func(c client.Client) {
		printer.Clean()

		err := botDisableCmdF(c, &cobra.Command{}, []string{"nonexistent-bot-userid"})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		s.Require().Contains(printer.GetErrorLines()[0], "can't find user 'nonexistent-bot-userid'")
	})

	s.RunForSystemAdminAndLocal("disable an already disabled bot", func(c client.Client) {
		printer.Clean()

		newBot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: user.Id})
		s.Require().Nil(appErr)

		_, appErr = s.th.App.UpdateBotActive(s.th.Context, newBot.UserId, false)
		s.Require().Nil(appErr)

		err := botDisableCmdF(c, &cobra.Command{}, []string{newBot.UserId})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		printedBot := printer.GetLines()[0].(*model.Bot)
		s.Require().Equal(newBot.UserId, printedBot.UserId)
		s.Require().Equal(newBot.Username, printedBot.Username)
		s.Require().Equal(newBot.OwnerId, printedBot.OwnerId)

		_, appErr = s.th.App.GetBot(s.th.Context, newBot.UserId, false)
		s.Require().NotNil(appErr)
		s.Require().Equal("store.sql_bot.get.missing.app_error", appErr.Id)
	})
}

func (s *MmctlE2ETestSuite) TestBotAssignCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("Assign Bot", func(c client.Client) {
		printer.Clean()

		botOwner, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteUser(s.th.Context, botOwner)
			s.Require().Nil(err)
		}()

		newBotOwner, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteUser(s.th.Context, newBotOwner)
			s.Require().Nil(err)
		}()

		bot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: botOwner.Id})
		s.Require().Nil(appErr)
		s.Require().Equal(bot.OwnerId, botOwner.Id)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, bot.UserId)
			s.Require().Nil(err)
		}()

		err := botAssignCmdF(c, &cobra.Command{}, []string{bot.UserId, newBotOwner.Id})
		s.Require().Nil(err)
		s.Require().Equal(1, len(printer.GetLines()))
		newBot, ok := printer.GetLines()[0].(*model.Bot)
		s.True(ok)
		s.Require().Equal(newBotOwner.Id, newBot.OwnerId)
	})

	s.Run("Assign Bot without permission", func() {
		printer.Clean()

		botOwner, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteUser(s.th.Context, botOwner)
			s.Require().Nil(err)
		}()

		newBotOwner, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
		s.Require().Nil(appErr)
		defer func() {
			err := s.th.App.PermanentDeleteUser(s.th.Context, newBotOwner)
			s.Require().Nil(err)
		}()

		bot, appErr := s.th.App.CreateBot(s.th.Context, &model.Bot{Username: model.NewId(), OwnerId: botOwner.Id})
		s.Require().Nil(appErr)
		s.Require().Equal(bot.OwnerId, botOwner.Id)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, bot.UserId)
			s.Require().Nil(err)
		}()

		err := botAssignCmdF(s.th.Client, &cobra.Command{}, []string{bot.UserId, newBotOwner.Id})
		s.Require().NotNil(err)
		s.Require().EqualError(err, fmt.Sprintf(`can not assign bot '%s' to user '%s'`, bot.UserId, newBotOwner.Id), err.Error())
	})
}

func (s *MmctlE2ETestSuite) TestBotCreateCmdF() {
	s.SetupTestHelper().InitBasic()

	createBots := *s.th.App.Config().ServiceSettings.EnableBotAccountCreation
	s.th.App.UpdateConfig(func(c *model.Config) { *c.ServiceSettings.EnableBotAccountCreation = true })
	defer s.th.App.UpdateConfig(func(c *model.Config) { *c.ServiceSettings.EnableBotAccountCreation = createBots })

	s.Run("MM-T3941 Create Bot with an access token", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("with-token", true, "")

		err := botCreateCmdF(s.th.Client, cmd, []string{"testbot"})
		s.Require().Error(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())

		printer.Clean()

		err = botCreateCmdF(s.th.SystemAdminClient, cmd, []string{"testbot"})
		s.Require().NoError(err)
		s.Require().Equal(2, len(printer.GetLines()))
		bot, ok := printer.GetLines()[0].(*model.Bot)
		s.Require().True(ok)
		defer func() {
			err := s.th.App.PermanentDeleteBot(s.th.Context, bot.UserId)
			s.Require().Nil(err)
		}()
		token, ok := printer.GetLines()[1].(*model.UserAccessToken)
		s.Require().True(ok)
		defer func() {
			err := s.th.App.RevokeUserAccessToken(s.th.Context, token)
			s.Require().Nil(err)
		}()
		s.Require().Empty(printer.GetErrorLines())
	})
}
