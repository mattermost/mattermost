// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
)

func (s *MmctlE2ETestSuite) TestPostListCmd() {
	s.SetupTestHelper().InitBasic()

	var createNewChannelAndPosts = func() (string, *model.Post, *model.Post) {
		channelName := model.NewRandomString(10)
		channelDisplayName := "channelDisplayName"

		channel, err := s.th.App.CreateChannel(s.th.Context, &model.Channel{Name: channelName, DisplayName: channelDisplayName, Type: model.ChannelTypeOpen, TeamId: s.th.BasicTeam.Id}, false)
		s.Require().Nil(err)

		post1, err := s.th.App.CreatePost(s.th.Context, &model.Post{Message: model.NewRandomString(15), UserId: s.th.BasicUser.Id, ChannelId: channel.Id}, channel, false, false)
		s.Require().Nil(err)

		post2, err := s.th.App.CreatePost(s.th.Context, &model.Post{Message: model.NewRandomString(15), UserId: s.th.BasicUser.Id, ChannelId: channel.Id}, channel, false, false)
		s.Require().Nil(err)

		return channelName, post1, post2
	}

	s.RunForSystemAdminAndLocal("List all posts for a channel", func(c client.Client) {
		printer.Clean()

		teamName := s.th.BasicTeam.Name
		channelName, post1, post2 := createNewChannelAndPosts()

		cmd := &cobra.Command{}
		cmd.Flags().Int("number", 2, "")

		err := postListCmdF(c, cmd, []string{teamName + ":" + channelName})
		s.Require().Nil(err)
		s.Equal(2, len(printer.GetLines()))

		printedPost1, ok := printer.GetLines()[0].(*model.Post)
		s.Require().True(ok)
		s.Require().Equal(printedPost1.Message, post1.Message)

		printedPost2, ok := printer.GetLines()[1].(*model.Post)
		s.Require().True(ok)
		s.Require().Equal(printedPost2.Message, post2.Message)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("List all posts for a channel without permissions", func() {
		printer.Clean()

		teamName := s.th.BasicTeam.Name
		channelName, _, _ := createNewChannelAndPosts()

		cmd := &cobra.Command{}
		cmd.Flags().Int("number", 2, "")

		err := postListCmdF(s.th.Client, cmd, []string{teamName + ":" + channelName})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "You do not have the appropriate permissions.")
	})

	s.RunForSystemAdminAndLocal("List all posts for a channel with since flag", func(c client.Client) {
		printer.Clean()

		ISO8601ValidString := "2006-01-02T15:04:05-07:00"
		teamName := s.th.BasicTeam.Name
		channelName, post1, post2 := createNewChannelAndPosts()

		cmd := &cobra.Command{}
		cmd.Flags().String("since", ISO8601ValidString, "")

		err := postListCmdF(c, cmd, []string{teamName + ":" + channelName})
		s.Require().Nil(err)
		s.Equal(2, len(printer.GetLines()))

		printedPost1, ok := printer.GetLines()[0].(*model.Post)
		s.Require().True(ok)
		s.Require().Equal(printedPost1.Message, post1.Message)

		printedPost2, ok := printer.GetLines()[1].(*model.Post)
		s.Require().True(ok)
		s.Require().Equal(printedPost2.Message, post2.Message)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("List all posts for a channel with since flag without permissions", func() {
		printer.Clean()

		ISO8601ValidString := "2006-01-02T15:04:05-07:00"
		teamName := s.th.BasicTeam.Name
		channelName, _, _ := createNewChannelAndPosts()

		cmd := &cobra.Command{}
		cmd.Flags().String("since", ISO8601ValidString, "")

		err := postListCmdF(s.th.Client, cmd, []string{teamName + ":" + channelName})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "You do not have the appropriate permissions.")
	})
}

func (s *MmctlE2ETestSuite) TestPostCreateCmd() {
	s.SetupTestHelper().InitBasic()

	s.Run("Create a post for System Admin Client", func() {
		printer.Clean()

		msgArg := "some text"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Create a post for Client", func() {
		printer.Clean()

		msgArg := "some text"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		err := postCreateCmdF(s.th.Client, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Create a post for Local Client should fail", func() {
		printer.Clean()

		msgArg := "some text"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		err := postCreateCmdF(s.th.LocalClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().NotNil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reply to a an existing post for System Admin Client", func() {
		printer.Clean()

		msgArg := "some text"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().String("reply-to", s.th.BasicPost.Id, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reply to a an existing post for Client", func() {
		printer.Clean()

		msgArg := "some text"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().String("reply-to", s.th.BasicPost.Id, "")

		err := postCreateCmdF(s.th.Client, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reply to a an existing post for Local Client should fail", func() {
		printer.Clean()

		msgArg := "some text"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().String("reply-to", s.th.BasicPost.Id, "")

		err := postCreateCmdF(s.th.LocalClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().NotNil(err)
		s.Len(printer.GetErrorLines(), 0)
	})
}
