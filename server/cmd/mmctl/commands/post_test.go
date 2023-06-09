// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestPostCreateCmdF() {
	s.Run("create a post with empty text", func() {
		cmd := &cobra.Command{}

		err := postCreateCmdF(s.client, cmd, []string{"some-channel", ""})
		s.Require().EqualError(err, "message cannot be empty")
	})

	s.Run("no channel specified", func() {
		msgArg := "some text"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		err := postCreateCmdF(s.client, cmd, []string{"", msgArg})
		s.Require().EqualError(err, "Unable to find channel ''")
	})

	s.Run("wrong reply msg", func() {
		msgArg := "some text"
		replyToArg := "a-non-existing-post"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().String("reply-to", replyToArg, "")

		s.client.
			EXPECT().
			GetPost(context.Background(), replyToArg, "").
			Return(nil, &model.Response{}, errors.New("some-error")).
			Times(1)

		err := postCreateCmdF(s.client, cmd, []string{msgArg})
		s.Require().Contains(err.Error(), "some-error")
	})

	s.Run("error when creating a post", func() {
		msgArg := "some text"
		channelArg := "example-channel"
		mockChannel := model.Channel{Name: channelArg}
		mockPost := &model.Post{Message: msgArg}
		data, err := mockPost.ToJSON()
		s.Require().NoError(err)

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.Background(), "/posts?set_online=false", data).
			Return(nil, errors.New("some-error")).
			Times(1)

		err = postCreateCmdF(s.client, cmd, []string{channelArg, msgArg})
		s.Require().Contains(err.Error(), "could not create post")
	})

	s.Run("create a post", func() {
		msgArg := "some text"
		channelArg := "example-channel"
		mockChannel := model.Channel{Name: channelArg}
		mockPost := model.Post{Message: msgArg}
		data, err := mockPost.ToJSON()
		s.Require().NoError(err)

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.Background(), "/posts?set_online=false", data).
			Return(nil, nil).
			Times(1)

		err = postCreateCmdF(s.client, cmd, []string{channelArg, msgArg})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("reply to an existing post", func() {
		msgArg := "some text"
		replyToArg := "an-existing-post"
		rootID := "some-root-id"
		channelArg := "example-channel"
		mockChannel := model.Channel{Name: channelArg}
		mockReplyTo := model.Post{RootId: rootID}
		mockPost := model.Post{Message: msgArg, RootId: rootID}
		data, err := mockPost.ToJSON()
		s.Require().NoError(err)

		cmd := &cobra.Command{}
		cmd.Flags().String("reply-to", replyToArg, "")
		cmd.Flags().String("message", msgArg, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelArg, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPost(context.Background(), replyToArg, "").
			Return(&mockReplyTo, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.Background(), "/posts?set_online=false", data).
			Return(nil, nil).
			Times(1)

		err = postCreateCmdF(s.client, cmd, []string{channelArg, msgArg})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestPostListCmdF() {
	s.Run("no channel specified", func() {
		sinceArg := "invalid-date"

		cmd := &cobra.Command{}
		cmd.Flags().String("since", sinceArg, "")

		err := postListCmdF(s.client, cmd, []string{"", sinceArg})
		s.Require().EqualError(err, "Unable to find channel ''")
	})

	s.Run("invalid time for since flag", func() {
		sinceArg := "invalid-date"
		mockChannel := model.Channel{Name: channelName}

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("since", sinceArg, "")

		err := postListCmdF(s.client, cmd, []string{channelName, sinceArg})
		s.Require().Contains(err.Error(), "invalid since time 'invalid-date'")
	})

	s.Run("list posts for a channel", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}
		mockPost := &model.Post{Message: "some text", Id: "some-id", UserId: userID, CreateAt: model.GetMillisForTime(time.Now())}
		mockPostList := model.NewPostList()
		mockPostList.AddPost(mockPost)
		mockPostList.AddOrder(mockPost.Id)
		mockUser := model.User{Id: userID, Username: "some-user"}

		cmd := &cobra.Command{}
		cmd.Flags().Int("number", 1, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsForChannel(context.Background(), channelID, 0, 1, "", false, false).
			Return(mockPostList, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.Background(), userID, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		printer.Clean()
		err := postListCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], mockPost)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("list posts for a channel from a certain time (valid date)", func() {
		printer.Clean()

		ISO8601ValidString := "2006-01-02T15:04:05-07:00"

		sinceArg := "2006-01-02T15:04:05-07:00"
		sinceTime, err := time.Parse(ISO8601ValidString, sinceArg)
		s.Require().Nil(err)

		sinceTimeMillis := model.GetMillisForTime(sinceTime)

		mockChannel := model.Channel{Name: channelName, Id: channelID}
		mockPost := &model.Post{Message: "some text", Id: "some-id", UserId: userID}
		mockPostList := model.NewPostList()
		mockPostList.AddPost(mockPost)
		mockPostList.AddOrder(mockPost.Id)
		mockUser := model.User{Id: userID, Username: "some-user"}

		cmd := &cobra.Command{}
		cmd.Flags().Int("number", 1, "")
		cmd.Flags().String("since", sinceArg, "")

		s.client.
			EXPECT().
			GetChannel(context.Background(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsSince(context.Background(), channelID, sinceTimeMillis, false).
			Return(mockPostList, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.Background(), userID, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		err = postListCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Require().Equal(printer.GetLines()[0], mockPost)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
	})
}
