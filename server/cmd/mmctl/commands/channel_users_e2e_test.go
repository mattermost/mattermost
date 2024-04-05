// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestChannelUsersAddCmdF() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
	s.Require().Nil(appErr)

	_, _, appErr = s.th.App.AddUserToTeam(s.th.Context, s.th.BasicTeam.Id, user.Id, "")
	s.Require().Nil(appErr)

	channelName := api4.GenerateTestChannelName()
	channel, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
		TeamId:      s.th.BasicTeam.Id,
		Name:        channelName,
		DisplayName: "dn_" + channelName,
		Type:        model.ChannelTypeOpen,
	}, false)
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Add user to nonexistent channel", func(c client.Client) {
		printer.Clean()

		nonexistentChannelName := "nonexistent"
		err := channelUsersAddCmdF(c, &cobra.Command{}, []string{nonexistentChannelName, user.Id})
		s.Require().NotNil(err)
		s.Require().Equal(fmt.Sprintf("unable to find channel %q", nonexistentChannelName), err.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Add user to nonexistent channel/Client", func() {
		printer.Clean()

		_, appErr := s.th.App.AddChannelMember(s.th.Context, s.th.BasicUser.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		defer func() {
			appErr := s.th.App.RemoveUserFromChannel(s.th.Context, s.th.BasicUser.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()

		nonexistentChannelName := "nonexistent"
		err := channelUsersAddCmdF(s.th.Client, &cobra.Command{}, []string{nonexistentChannelName, user.Id})
		s.Require().NotNil(err)
		s.Require().Equal(fmt.Sprintf("unable to find channel %q", nonexistentChannelName), err.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("Add nonexistent user to channel", func(c client.Client) {
		printer.Clean()

		nonexistentUserName := "nonexistent"
		err := channelUsersAddCmdF(c, &cobra.Command{}, []string{channel.Id, nonexistentUserName})
		s.Require().ErrorContains(err, "unable to find user")
		s.Require().ErrorContains(err, nonexistentUserName)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("Add nonexistent user to channel/Client", func() {
		printer.Clean()

		_, appErr := s.th.App.AddChannelMember(s.th.Context, s.th.BasicUser.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		defer func() {
			appErr := s.th.App.RemoveUserFromChannel(s.th.Context, s.th.BasicUser.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()

		nonexistentUserName := "nonexistent"
		err := channelUsersAddCmdF(s.th.Client, &cobra.Command{}, []string{channel.Id, nonexistentUserName})
		s.Require().ErrorContains(err, "unable to find user")
		s.Require().ErrorContains(err, nonexistentUserName)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("Add user to channel without permission/Client", func() {
		printer.Clean()

		err := channelUsersAddCmdF(s.th.Client, &cobra.Command{}, []string{channel.Id, user.Id})
		s.Require().ErrorContains(err, "unable to add")
		s.Require().ErrorContains(err, user.Id)
		s.Require().ErrorContains(err, channelName)
		s.Require().ErrorContains(err, "You do not have the appropriate permissions")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to add %q to %q. Error: You do not have the appropriate permissions.", user.Id, channelName), printer.GetErrorLines()[0])
	})

	s.Run("Add user to channel/Client", func() {
		printer.Clean()

		_, appErr := s.th.App.AddChannelMember(s.th.Context, s.th.BasicUser.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.RemoveUserFromChannel(s.th.Context, s.th.BasicUser.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()

		err := channelUsersAddCmdF(s.th.Client, &cobra.Command{}, []string{channel.Id, user.Id})
		s.Require().Nil(err)
		defer func() {
			appErr = s.th.App.RemoveUserFromChannel(s.th.Context, user.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		members, appErr := s.th.App.GetChannelMembersByIds(s.th.Context, channel.Id, []string{user.Id})
		s.Require().Nil(appErr)
		s.Require().Len(members, 1)
		s.Require().Equal(user.Id, (members)[0].UserId)
	})

	s.RunForSystemAdminAndLocal("Add user to channel", func(c client.Client) {
		printer.Clean()

		err := channelUsersAddCmdF(c, &cobra.Command{}, []string{channel.Id, user.Id})
		s.Require().Nil(err)
		defer func() {
			appErr := s.th.App.RemoveUserFromChannel(s.th.Context, user.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		members, appErr := s.th.App.GetChannelMembersByIds(s.th.Context, channel.Id, []string{user.Id})
		s.Require().Nil(appErr)
		s.Require().Len(members, 1)
		s.Require().Equal(user.Id, (members)[0].UserId)
	})
}

func (s *MmctlE2ETestSuite) TestChannelUsersRemoveCmd() {
	s.SetupTestHelper().InitBasic()

	user, appErr := s.th.App.CreateUser(s.th.Context, &model.User{Email: s.th.GenerateTestEmail(), Username: model.NewId(), Password: model.NewId()})
	s.Require().Nil(appErr)

	_, _, appErr = s.th.App.AddUserToTeam(s.th.Context, s.th.BasicTeam.Id, user.Id, "")
	s.Require().Nil(appErr)

	channelName := api4.GenerateTestChannelName()
	channel, appErr := s.th.App.CreateChannel(s.th.Context, &model.Channel{
		TeamId:      s.th.BasicTeam.Id,
		Name:        channelName,
		DisplayName: "dn_" + channelName,
		Type:        model.ChannelTypeOpen,
	}, false)
	s.Require().Nil(appErr)

	s.RunForSystemAdminAndLocal("Remove user from nonexistent channel", func(c client.Client) {
		printer.Clean()

		nonexistentChannelName := "nonexistent"
		err := channelUsersRemoveCmdF(c, &cobra.Command{}, []string{nonexistentChannelName, user.Id})
		s.Require().NotNil(err)
		s.Require().Equal(fmt.Sprintf("unable to find channel %q", nonexistentChannelName), err.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Remove user from nonexistent channel/Client", func() {
		printer.Clean()

		_, appErr = s.th.App.AddChannelMember(s.th.Context, s.th.BasicUser.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.RemoveUserFromChannel(s.th.Context, s.th.BasicUser.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()

		nonexistentChannelName := "nonexistent"
		err := channelUsersRemoveCmdF(s.th.Client, &cobra.Command{}, []string{nonexistentChannelName, user.Id})
		s.Require().NotNil(err)
		s.Require().Equal(fmt.Sprintf("unable to find channel %q", nonexistentChannelName), err.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("Remove nonexistent user from channel", func(c client.Client) {
		printer.Clean()

		nonexistentUserName := "nonexistent"
		err := channelUsersRemoveCmdF(c, &cobra.Command{}, []string{channel.Id, nonexistentUserName})
		s.Require().ErrorContains(err, "unable to find user")
		s.Require().ErrorContains(err, nonexistentUserName)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to find user %q", nonexistentUserName), printer.GetErrorLines()[0])
	})

	s.Run("Remove nonexistent user from channel/Client", func() {
		printer.Clean()

		_, appErr = s.th.App.AddChannelMember(s.th.Context, s.th.BasicUser.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.RemoveUserFromChannel(s.th.Context, s.th.BasicUser.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()

		nonexistentUserName := "nonexistent"
		err := channelUsersRemoveCmdF(s.th.Client, &cobra.Command{}, []string{channel.Id, nonexistentUserName})
		s.Require().ErrorContains(err, "unable to find user")
		s.Require().ErrorContains(err, nonexistentUserName)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to find user %q", nonexistentUserName), printer.GetErrorLines()[0])
	})

	s.Run("Remove user from channel without permission/Client", func() {
		printer.Clean()

		var members model.ChannelMembers
		_, appErr = s.th.App.AddChannelMember(s.th.Context, user.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		members, appErr = s.th.App.GetChannelMembersByIds(s.th.Context, channel.Id, []string{user.Id})
		s.Require().Nil(appErr)
		s.Require().Len(members, 1)
		s.Require().Equal(user.Id, (members)[0].UserId)

		err := channelUsersRemoveCmdF(s.th.Client, &cobra.Command{}, []string{channel.Id, user.Id})
		s.Require().ErrorContains(err, "unable to remove")
		s.Require().ErrorContains(err, user.Id)
		s.Require().ErrorContains(err, channelName)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("unable to remove %q from %q", user.Id, channelName))
		s.Require().Contains(printer.GetErrorLines()[0], "You do not have the appropriate permissions")
	})

	s.Run("Remove user from channel/Client", func() {
		printer.Clean()

		_, appErr = s.th.App.AddChannelMember(s.th.Context, s.th.BasicUser.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		defer func() {
			appErr = s.th.App.RemoveUserFromChannel(s.th.Context, s.th.BasicUser.Id, s.th.SystemAdminUser.Id, channel)
			s.Require().Nil(appErr)
		}()

		var members model.ChannelMembers
		_, appErr = s.th.App.AddChannelMember(s.th.Context, user.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		members, appErr = s.th.App.GetChannelMembersByIds(s.th.Context, channel.Id, []string{user.Id})
		s.Require().Nil(appErr)
		s.Require().Len(members, 1)
		s.Require().Equal(user.Id, (members)[0].UserId)

		err := channelUsersRemoveCmdF(s.th.Client, &cobra.Command{}, []string{channel.Id, user.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		members, appErr = s.th.App.GetChannelMembersByIds(s.th.Context, channel.Id, []string{user.Id})
		s.Require().Nil(appErr)
		s.Require().Len(members, 0)
	})

	s.RunForSystemAdminAndLocal("Remove user from channel", func(c client.Client) {
		printer.Clean()

		_, appErr = s.th.App.AddChannelMember(s.th.Context, user.Id, channel, app.ChannelMemberOpts{})
		s.Require().Nil(appErr)
		members, appErr := s.th.App.GetChannelMembersByIds(s.th.Context, channel.Id, []string{user.Id})
		s.Require().Nil(appErr)
		s.Require().Len(members, 1)
		s.Require().Equal(user.Id, (members)[0].UserId)

		err := channelUsersRemoveCmdF(c, &cobra.Command{}, []string{channel.Id, user.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)

		members, appErr = s.th.App.GetChannelMembersByIds(s.th.Context, channel.Id, []string{user.Id})
		s.Require().Nil(appErr)
		s.Require().Len(members, 0)
	})
}
