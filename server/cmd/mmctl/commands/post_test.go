// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/viper"
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
			GetPost(context.TODO(), replyToArg, "").
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
			GetChannel(context.TODO(), channelArg).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.TODO(), "/posts?set_online=false", data).
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
			GetChannel(context.TODO(), channelArg).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.TODO(), "/posts?set_online=false", data).
			Return(nil, nil).
			Times(1)

		err = postCreateCmdF(s.client, cmd, []string{channelArg, msgArg})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("create a post in local mode should fail", func() {
		msgArg := "some text"
		channelArg := "example-channel"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		prevLocal := viper.GetBool("local")
		viper.Set("local", true)
		defer viper.Set("local", prevLocal)

		err := postCreateCmdF(s.client, cmd, []string{channelArg})
		s.Require().EqualError(err, "creating posts is not supported in local mode")
	})

	s.Run("create a direct message", func() {
		printer.Clean()
		msgArg := "some text"
		username := "target-user"
		meID := "my-user-id"
		targetUserID := "target-user-id"
		dmChannelID := "dm-channel-id"

		mockTargetUser := model.User{Id: targetUserID, Username: username}
		mockMe := model.User{Id: meID}
		mockChannel := model.Channel{Id: dmChannelID, Type: model.ChannelTypeDirect}
		mockPost := model.Post{Message: msgArg, ChannelId: dmChannelID}
		data, err := mockPost.ToJSON()
		s.Require().NoError(err)

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), username, "").
			Return(&mockTargetUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetMe(context.TODO(), "").
			Return(&mockMe, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateDirectChannel(context.TODO(), meID, targetUserID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.TODO(), "/posts?set_online=false", data).
			Return(nil, nil).
			Times(1)

		err = postCreateCmdF(s.client, cmd, []string{"@" + username})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("create a direct message with reply-to and burn-on-read", func() {
		printer.Clean()
		msgArg := "some text"
		username := "target-user"
		meID := "my-user-id"
		targetUserID := "target-user-id"
		dmChannelID := "dm-channel-id"
		replyToArg := "reply-to-post"
		rootID := "root-post-id"

		mockTargetUser := model.User{Id: targetUserID, Username: username}
		mockMe := model.User{Id: meID}
		mockChannel := model.Channel{Id: dmChannelID, Type: model.ChannelTypeDirect}
		mockReplyTo := model.Post{RootId: rootID}
		mockPost := model.Post{Message: msgArg, ChannelId: dmChannelID, RootId: rootID, Type: model.PostTypeBurnOnRead}
		data, err := mockPost.ToJSON()
		s.Require().NoError(err)

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")
		cmd.Flags().String("reply-to", replyToArg, "")
		cmd.Flags().Bool("burn-on-read", true, "")

		s.client.
			EXPECT().
			GetPost(context.TODO(), replyToArg, "").
			Return(&mockReplyTo, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), username, "").
			Return(&mockTargetUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetMe(context.TODO(), "").
			Return(&mockMe, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateDirectChannel(context.TODO(), meID, targetUserID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.TODO(), "/posts?set_online=false", data).
			Return(nil, nil).
			Times(1)

		err = postCreateCmdF(s.client, cmd, []string{"@" + username})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("direct message to a non-existing user", func() {
		printer.Clean()
		msgArg := "some text"
		username := "ghost"

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), username, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), username, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := postCreateCmdF(s.client, cmd, []string{"@" + username})
		var nfErr ErrEntityNotFound
		s.Require().ErrorAs(err, &nfErr)
		s.Require().Equal("user", nfErr.Type)
		s.Require().Equal(username, nfErr.ID)
	})

	s.Run("direct message fails to resolve the current user", func() {
		printer.Clean()
		msgArg := "some text"
		username := "target-user"
		targetUserID := "target-user-id"
		mockTargetUser := model.User{Id: targetUserID, Username: username}

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), username, "").
			Return(&mockTargetUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetMe(context.TODO(), "").
			Return(nil, &model.Response{}, errors.New("some-error")).
			Times(1)

		err := postCreateCmdF(s.client, cmd, []string{"@" + username})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "could not retrieve the current user")
	})

	s.Run("direct message fails to create the direct channel", func() {
		printer.Clean()
		msgArg := "some text"
		username := "target-user"
		meID := "my-user-id"
		targetUserID := "target-user-id"
		mockTargetUser := model.User{Id: targetUserID, Username: username}
		mockMe := model.User{Id: meID}

		cmd := &cobra.Command{}
		cmd.Flags().String("message", msgArg, "")

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), username, "").
			Return(&mockTargetUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetMe(context.TODO(), "").
			Return(&mockMe, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateDirectChannel(context.TODO(), meID, targetUserID).
			Return(nil, &model.Response{}, errors.New("some-error")).
			Times(1)

		err := postCreateCmdF(s.client, cmd, []string{"@" + username})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "could not create direct channel with 'target-user'")
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
			GetChannel(context.TODO(), channelArg).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPost(context.TODO(), replyToArg, "").
			Return(&mockReplyTo, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DoAPIPost(context.TODO(), "/posts?set_online=false", data).
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
			GetChannel(context.TODO(), channelName).
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
			GetChannel(context.TODO(), channelName).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsForChannel(context.TODO(), channelID, 0, 1, "", false, false).
			Return(mockPostList, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), userID, "").
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
			GetChannel(context.TODO(), channelName).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsSince(context.TODO(), channelID, sinceTimeMillis, false).
			Return(mockPostList, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), userID, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		err = postListCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Require().Equal(printer.GetLines()[0], mockPost)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestDeletePostsCmdF() {
	postID1 := "ux9bxc1b8bf1zdoj1tfu14836e"
	postID2 := "ux9bxc1b8bf1zdoj1tfu14836f"

	s.Run("invalid post id", func() {
		id := "invalid-id"

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")
		cmd.Flags().Bool("permanent", false, "")

		err := deletePostsCmdF(s.client, cmd, []string{id})
		s.Require().Nil(err)
		s.Require().Equal("Invalid postID: invalid-id", printer.GetErrorLines()[0])
	})

	s.Run("successfully permanently delete one post", func() {
		printer.Clean()
		s.client.
			EXPECT().
			PermanentDeletePost(context.TODO(), postID1).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")
		cmd.Flags().Bool("permanent", true, "")

		err := deletePostsCmdF(s.client, cmd, []string{postID1})
		s.Require().Nil(err)
		s.Require().Equal(postID1+" successfully deleted", printer.GetLines()[0])
	})

	s.Run("successfully soft delete one post", func() {
		printer.Clean()
		s.client.
			EXPECT().
			DeletePost(context.TODO(), postID1).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")
		cmd.Flags().Bool("permanent", false, "")

		err := deletePostsCmdF(s.client, cmd, []string{postID1})
		s.Require().Nil(err)
		s.Require().Equal(postID1+" successfully deleted", printer.GetLines()[0])
	})

	s.Run("successfully delete multiple posts", func() {
		printer.Clean()
		s.client.
			EXPECT().
			PermanentDeletePost(context.TODO(), postID1).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)
		s.client.
			EXPECT().
			PermanentDeletePost(context.TODO(), postID2).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")
		cmd.Flags().Bool("permanent", true, "")

		err := deletePostsCmdF(s.client, cmd, []string{postID1, postID2})
		s.Require().Nil(err)
		s.Require().Equal(postID1+" successfully deleted", printer.GetLines()[0])
		s.Require().Equal(postID2+" successfully deleted", printer.GetLines()[1])
	})

	s.Run("PermanentDeletePost api request returns an error", func() {
		printer.Clean()

		mockError := errors.New("an error occurred on deleting a post")

		s.client.
			EXPECT().
			PermanentDeletePost(context.TODO(), postID1).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")
		cmd.Flags().Bool("permanent", true, "")

		err := deletePostsCmdF(s.client, cmd, []string{postID1})
		s.Require().ErrorContains(err, "an error occurred on deleting a post")
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Error deleting post: "+postID1+". Error: an error occurred on deleting a post",
			printer.GetErrorLines()[0])
	})

	s.Run("Delete multiple posts but one fails with an error", func() {
		printer.Clean()
		mockError := errors.New("an error occurred on deleting a post")
		s.client.
			EXPECT().
			PermanentDeletePost(context.TODO(), postID1).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)
		s.client.
			EXPECT().
			PermanentDeletePost(context.TODO(), postID2).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")
		cmd.Flags().Bool("permanent", true, "")

		err := deletePostsCmdF(s.client, cmd, []string{postID1, postID2})
		s.Require().ErrorContains(err, "an error occurred on deleting a post")
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(postID1+" successfully deleted", printer.GetLines()[0])
		s.Require().Equal("Error deleting post: "+postID2+". Error: an error occurred on deleting a post",
			printer.GetErrorLines()[0])
	})
}
