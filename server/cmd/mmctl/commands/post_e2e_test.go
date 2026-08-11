// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
)

func (s *MmctlE2ETestSuite) TestPostListCmd() {
	s.SetupTestHelper().InitBasic(s.T())

	var createNewChannelAndPosts = func() (string, *model.Post, *model.Post) {
		channelName := model.NewRandomString(10)
		channelDisplayName := "channelDisplayName"

		channel, err := s.th.App.CreateChannel(s.th.Context, &model.Channel{Name: channelName, DisplayName: channelDisplayName, Type: model.ChannelTypePrivate, TeamId: s.th.BasicTeam.Id}, false)
		s.Require().Nil(err)

		post1, _, err := s.th.App.CreatePost(s.th.Context, &model.Post{Message: model.NewRandomString(15), UserId: s.th.BasicUser.Id, ChannelId: channel.Id}, channel, model.CreatePostFlags{})
		s.Require().Nil(err)

		post2, _, err := s.th.App.CreatePost(s.th.Context, &model.Post{Message: model.NewRandomString(15), UserId: s.th.BasicUser.Id, ChannelId: channel.Id}, channel, model.CreatePostFlags{})
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
		//s.Require().Contains(err.Error(), "You do not have the appropriate permissions.")
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
		//s.Require().Contains(err.Error(), "You do not have the appropriate permissions.")
	})
}

func (s *MmctlE2ETestSuite) TestPostCreateCmd() {
	s.SetupTestHelper().InitBasic(s.T())

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
		prevLocal := viper.GetBool("local")
		viper.Set("local", true)
		defer viper.Set("local", prevLocal)

		err := postCreateCmdF(s.th.LocalClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "creating posts is not supported in local mode")
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Send a direct message for System Admin Client", func() {
		printer.Clean()

		msgArg := model.NewRandomString(15)

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{"@" + s.th.BasicUser2.Username})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)

		dmChannel, appErr := s.th.App.GetOrCreateDirectChannel(s.th.Context, s.th.SystemAdminUser.Id, s.th.BasicUser2.Id)
		s.Require().Nil(appErr)

		posts, appErr := s.th.App.GetPosts(s.th.Context, dmChannel.Id, 0, 10)
		s.Require().Nil(appErr)

		var matched []*model.Post
		for _, post := range posts.Posts {
			if post.Message == msgArg {
				matched = append(matched, post)
			}
		}
		s.Require().Len(matched, 1, "expected exactly one direct message with the sent text")
		s.Require().Equal(s.th.SystemAdminUser.Id, matched[0].UserId)
		s.Require().Equal(dmChannel.Id, matched[0].ChannelId)
	})

	s.Run("Send a direct message for Client", func() {
		printer.Clean()

		msgArg := model.NewRandomString(15)

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		err := postCreateCmdF(s.th.Client, cmd, []string{"@" + s.th.BasicUser2.Username})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)

		dmChannel, appErr := s.th.App.GetOrCreateDirectChannel(s.th.Context, s.th.BasicUser.Id, s.th.BasicUser2.Id)
		s.Require().Nil(appErr)

		posts, appErr := s.th.App.GetPosts(s.th.Context, dmChannel.Id, 0, 10)
		s.Require().Nil(appErr)

		var matched []*model.Post
		for _, post := range posts.Posts {
			if post.Message == msgArg {
				matched = append(matched, post)
			}
		}
		s.Require().Len(matched, 1, "expected exactly one direct message with the sent text")
		s.Require().Equal(s.th.BasicUser.Id, matched[0].UserId)
		s.Require().Equal(dmChannel.Id, matched[0].ChannelId)
	})

	s.Run("Send a direct message for Local Client should fail", func() {
		printer.Clean()

		msgArg := model.NewRandomString(15)

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		prevLocal := viper.GetBool("local")
		viper.Set("local", true)
		defer viper.Set("local", prevLocal)

		err := postCreateCmdF(s.th.LocalClient, cmd, []string{"@" + s.th.BasicUser2.Username})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "creating posts is not supported in local mode")
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Send a direct message to a non-existing user should fail", func() {
		printer.Clean()

		msgArg := model.NewRandomString(15)
		missingUsername := model.NewUsername()

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{"@" + missingUsername})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), missingUsername)
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
		prevLocal := viper.GetBool("local")
		viper.Set("local", true)
		defer viper.Set("local", prevLocal)

		err := postCreateCmdF(s.th.LocalClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "creating posts is not supported in local mode")
		s.Len(printer.GetErrorLines(), 0)
	})

	findPostByMessage := func(channelID, message string) *model.Post {
		posts, appErr := s.th.App.GetPosts(s.th.Context, channelID, 0, 60)
		s.Require().Nil(appErr)

		var matched []*model.Post
		for _, post := range posts.Posts {
			if post.Message == message {
				matched = append(matched, post)
			}
		}
		s.Require().Len(matched, 1, "expected exactly one post with the sent text")
		return matched[0]
	}

	s.Run("Create a post with a file attachment", func() {
		printer.Clean()

		msgArg := model.NewRandomString(15)
		fileContent := []byte("mmctl attachment contents")
		filePath := filepath.Join(s.T().TempDir(), "attachment.txt")
		s.Require().NoError(os.WriteFile(filePath, fileContent, 0600))

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().StringArray("file", []string{filePath}, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)

		post := findPostByMessage(s.th.BasicChannel.Id, msgArg)
		s.Require().Len(post.FileIds, 1)

		infos, _, appErr := s.th.App.GetFileInfosForPost(s.th.Context, post, false, false)
		s.Require().Nil(appErr)
		s.Require().Len(infos, 1)
		s.Require().Equal("attachment.txt", infos[0].Name)
		s.Require().Equal(int64(len(fileContent)), infos[0].Size)
	})

	s.Run("Create a post with multiple file attachments", func() {
		printer.Clean()

		msgArg := model.NewRandomString(15)
		dir := s.T().TempDir()

		firstContent := []byte("first attachment")
		firstPath := filepath.Join(dir, "first.txt")
		s.Require().NoError(os.WriteFile(firstPath, firstContent, 0600))

		secondContent := []byte("second attachment")
		secondPath := filepath.Join(dir, "second.txt")
		s.Require().NoError(os.WriteFile(secondPath, secondContent, 0600))

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().StringArray("file", []string{firstPath, secondPath}, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)

		post := findPostByMessage(s.th.BasicChannel.Id, msgArg)
		s.Require().Len(post.FileIds, 2)

		infos, _, appErr := s.th.App.GetFileInfosForPost(s.th.Context, post, false, false)
		s.Require().Nil(appErr)
		s.Require().Len(infos, 2)

		names := []string{infos[0].Name, infos[1].Name}
		s.Require().ElementsMatch([]string{"first.txt", "second.txt"}, names)
	})

	s.Run("Create a post with only a file attachment and no message", func() {
		printer.Clean()

		fileContent := []byte("attachment only, no message")
		filePath := filepath.Join(s.T().TempDir(), "only.txt")
		s.Require().NoError(os.WriteFile(filePath, fileContent, 0600))

		cmd := &cobra.Command{}
		cmd.Flags().String("message", "", "")
		cmd.Flags().StringArray("file", []string{filePath}, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)

		posts, appErr := s.th.App.GetPosts(s.th.Context, s.th.BasicChannel.Id, 0, 60)
		s.Require().Nil(appErr)

		var matched []*model.Post
		for _, post := range posts.Posts {
			if post.Message == "" && post.Type == "" && len(post.FileIds) == 1 {
				matched = append(matched, post)
			}
		}
		s.Require().Len(matched, 1, "expected exactly one message-less post with a single file attachment")

		infos, _, appErr := s.th.App.GetFileInfosForPost(s.th.Context, matched[0], false, false)
		s.Require().Nil(appErr)
		s.Require().Len(infos, 1)
		s.Require().Equal("only.txt", infos[0].Name)
	})

	s.Run("Create a post with no message and no file should fail", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("message", "", "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "a post must have a message or at least one file attachment")
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Create a post with a missing file should fail", func() {
		printer.Clean()

		missingPath := filepath.Join(s.T().TempDir(), "does-not-exist.txt")

		cmd := &cobra.Command{}
		cmd.Flags().String("message", model.NewRandomString(15), "")
		cmd.Flags().StringArray("file", []string{missingPath}, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "could not read file")
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Create a post with the successful attachments when one upload fails", func() {
		printer.Clean()

		msgArg := model.NewRandomString(15)
		dir := s.T().TempDir()

		goodContent := []byte("good attachment")
		goodPath := filepath.Join(dir, "good.txt")
		s.Require().NoError(os.WriteFile(goodPath, goodContent, 0600))

		// An empty file is rejected by the server on upload, so it exercises the
		// mid-batch upload failure path while the readable file still succeeds.
		emptyPath := filepath.Join(dir, "empty.txt")
		s.Require().NoError(os.WriteFile(emptyPath, []byte{}, 0600))

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().StringArray("file", []string{goodPath, emptyPath}, "")

		err := postCreateCmdF(s.th.SystemAdminClient, cmd, []string{s.th.BasicTeam.Name + ":" + s.th.BasicChannel.Name})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "could not upload file")
		s.Len(printer.GetErrorLines(), 0)

		post := findPostByMessage(s.th.BasicChannel.Id, msgArg)
		s.Require().Len(post.FileIds, 1)

		infos, _, appErr := s.th.App.GetFileInfosForPost(s.th.Context, post, false, false)
		s.Require().Nil(appErr)
		s.Require().Len(infos, 1)
		s.Require().Equal("good.txt", infos[0].Name)
	})
}
