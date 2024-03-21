// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestListWebhookCmd() {
	teamID := "teamID"
	incomingWebhookID := "incomingWebhookID"
	incomingWebhookDisplayName := "incomingWebhookDisplayName"
	outgoingWebhookID := "outgoingWebhookID"
	outgoingWebhookDisplayName := "outgoingWebhookDisplayName"

	s.Run("Listing all webhooks", func() {
		printer.Clean()

		mockTeam := model.Team{
			Id: teamID,
		}
		mockIncomingWebhook := model.IncomingWebhook{
			Id:          incomingWebhookID,
			DisplayName: incomingWebhookDisplayName,
		}
		mockOutgoingWebhook := model.OutgoingWebhook{
			Id:          outgoingWebhookID,
			DisplayName: outgoingWebhookDisplayName,
		}

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 0, DefaultPageSize).
			Return([]*model.Team{&mockTeam}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 1, DefaultPageSize).
			Return([]*model.Team{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetIncomingWebhooksForTeam(context.TODO(), teamID, 0, 100000000, "").
			Return([]*model.IncomingWebhook{&mockIncomingWebhook}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetOutgoingWebhooksForTeam(context.TODO(), teamID, 0, 100000000, "").
			Return([]*model.OutgoingWebhook{&mockOutgoingWebhook}, &model.Response{}, nil).
			Times(1)

		err := listWebhookCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 2)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&mockIncomingWebhook, printer.GetLines()[0])
		s.Require().Equal(&mockOutgoingWebhook, printer.GetLines()[1])
	})

	s.Run("List webhooks by team", func() {
		printer.Clean()

		mockTeam := model.Team{
			Id: teamID,
		}
		mockIncomingWebhook := model.IncomingWebhook{
			Id:          incomingWebhookID,
			DisplayName: incomingWebhookDisplayName,
		}
		mockOutgoingWebhook := model.OutgoingWebhook{
			Id:          outgoingWebhookID,
			DisplayName: outgoingWebhookDisplayName,
		}
		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetIncomingWebhooksForTeam(context.TODO(), teamID, 0, 100000000, "").
			Return([]*model.IncomingWebhook{&mockIncomingWebhook}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetOutgoingWebhooksForTeam(context.TODO(), teamID, 0, 100000000, "").
			Return([]*model.OutgoingWebhook{&mockOutgoingWebhook}, &model.Response{}, nil).
			Times(1)

		err := listWebhookCmdF(s.client, &cobra.Command{}, []string{teamID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 2)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&mockIncomingWebhook, printer.GetLines()[0])
		s.Require().Equal(&mockOutgoingWebhook, printer.GetLines()[1])
	})

	s.Run("Unable to list webhooks", func() {
		printer.Clean()

		mockTeam := model.Team{
			Id: teamID,
		}
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 0, DefaultPageSize).
			Return([]*model.Team{&mockTeam}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 1, DefaultPageSize).
			Return([]*model.Team{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetIncomingWebhooksForTeam(context.TODO(), teamID, 0, 100000000, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetOutgoingWebhooksForTeam(context.TODO(), teamID, 0, 100000000, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := listWebhookCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 2)
		s.Require().Equal("Unable to list incoming webhooks for '"+teamID+"'", printer.GetErrorLines()[0])
		s.Require().Equal("Unable to list outgoing webhooks for '"+teamID+"'", printer.GetErrorLines()[1])
	})
}

func (s *MmctlUnitTestSuite) TestCreateIncomingWebhookCmd() {
	incomingWebhookID := "incomingWebhookID"
	channelID := "channelID"
	userID := "userID"
	emailID := "emailID"
	userName := "userName"
	displayName := "displayName"

	cmd := &cobra.Command{}
	cmd.Flags().String("channel", channelID, "")
	cmd.Flags().String("user", emailID, "")
	cmd.Flags().String("display-name", displayName, "")

	s.Run("Successfully create new incoming webhook", func() {
		printer.Clean()

		mockChannel := model.Channel{
			Id: channelID,
		}
		mockUser := model.User{
			Id:       userID,
			Email:    emailID,
			Username: userName,
		}
		mockIncomingWebhook := model.IncomingWebhook{
			ChannelId:   channelID,
			Username:    userName,
			DisplayName: displayName,
			UserId:      userID,
		}
		returnedIncomingWebhook := mockIncomingWebhook
		returnedIncomingWebhook.Id = incomingWebhookID

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), emailID, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateIncomingWebhook(context.TODO(), &mockIncomingWebhook).
			Return(&returnedIncomingWebhook, &model.Response{}, nil).
			Times(1)

		err := createIncomingWebhookCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&returnedIncomingWebhook, printer.GetLines()[0])
	})

	s.Run("Incoming webhook creation error", func() {
		printer.Clean()

		mockChannel := model.Channel{
			Id: channelID,
		}
		mockUser := model.User{
			Id:       userID,
			Email:    emailID,
			Username: userName,
		}
		mockIncomingWebhook := model.IncomingWebhook{
			ChannelId:   channelID,
			Username:    userName,
			DisplayName: displayName,
			UserId:      userID,
		}
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), emailID, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateIncomingWebhook(context.TODO(), &mockIncomingWebhook).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := createIncomingWebhookCmdF(s.client, cmd, []string{})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to create webhook", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestModifyIncomingWebhookCmd() {
	incomingWebhookID := "incomingWebhookID"
	channelID := "channelID"
	userName := "userName"
	displayName := "displayName"

	s.Run("Successfully modify incoming webhook", func() {
		printer.Clean()

		mockIncomingWebhook := model.IncomingWebhook{
			Id:            incomingWebhookID,
			ChannelId:     channelID,
			Username:      userName,
			DisplayName:   displayName,
			ChannelLocked: false,
		}

		lockToChannel := true
		updatedIncomingWebhook := mockIncomingWebhook
		updatedIncomingWebhook.ChannelLocked = lockToChannel

		cmd := &cobra.Command{}

		_ = cmd.Flags().Set("lock-to-channel", strconv.FormatBool(lockToChannel))

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), incomingWebhookID, "").
			Return(&mockIncomingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateIncomingWebhook(context.TODO(), &mockIncomingWebhook).
			Return(&updatedIncomingWebhook, &model.Response{}, nil).
			Times(1)

		err := modifyIncomingWebhookCmdF(s.client, cmd, []string{incomingWebhookID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&updatedIncomingWebhook, printer.GetLines()[0])
	})

	s.Run("modify incoming webhook errored", func() {
		printer.Clean()

		mockIncomingWebhook := model.IncomingWebhook{
			Id:            incomingWebhookID,
			ChannelId:     channelID,
			Username:      userName,
			DisplayName:   displayName,
			ChannelLocked: false,
		}

		lockToChannel := true

		mockError := errors.New("mock error")

		cmd := &cobra.Command{}

		_ = cmd.Flags().Set("lock-to-channel", strconv.FormatBool(lockToChannel))

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), incomingWebhookID, "").
			Return(&mockIncomingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateIncomingWebhook(context.TODO(), &mockIncomingWebhook).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := modifyIncomingWebhookCmdF(s.client, cmd, []string{incomingWebhookID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to modify incoming webhook", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestCreateOutgoingWebhookCmd() {
	teamID := "teamID"
	outgoingWebhookID := "outgoingWebhookID"
	userID := "userID"
	emailID := "emailID"
	userName := "userName"
	triggerWhen := "exact"

	cmd := &cobra.Command{}
	cmd.Flags().String("team", teamID, "")
	cmd.Flags().String("user", emailID, "")
	cmd.Flags().String("trigger-when", triggerWhen, "")

	s.Run("Successfully create outgoing webhook", func() {
		printer.Clean()

		mockTeam := model.Team{
			Id: teamID,
		}
		mockUser := model.User{
			Id:       userID,
			Email:    emailID,
			Username: userName,
		}
		mockOutgoingWebhook := model.OutgoingWebhook{
			CreatorId:    userID,
			Username:     userName,
			TeamId:       teamID,
			TriggerWords: []string{},
			TriggerWhen:  0,
			CallbackURLs: []string{},
		}

		createdOutgoingWebhook := mockOutgoingWebhook
		createdOutgoingWebhook.Id = outgoingWebhookID

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), emailID, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateOutgoingWebhook(context.TODO(), &mockOutgoingWebhook).
			Return(&createdOutgoingWebhook, &model.Response{}, nil).
			Times(1)

		err := createOutgoingWebhookCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&createdOutgoingWebhook, printer.GetLines()[0])
	})

	s.Run("Create outgoing webhook error", func() {
		printer.Clean()

		mockTeam := model.Team{
			Id: teamID,
		}
		mockUser := model.User{
			Id:       userID,
			Email:    emailID,
			Username: userName,
		}
		mockOutgoingWebhook := model.OutgoingWebhook{
			CreatorId:    userID,
			Username:     userName,
			TeamId:       teamID,
			TriggerWords: []string{},
			TriggerWhen:  0,
			CallbackURLs: []string{},
		}
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), emailID, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateOutgoingWebhook(context.TODO(), &mockOutgoingWebhook).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := createOutgoingWebhookCmdF(s.client, cmd, []string{})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to create outgoing webhook", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestModifyOutgoingWebhookCmd() {
	outgoingWebhookID := "outgoingWebhookID"

	s.Run("Successfully modify outgoing webhook", func() {
		printer.Clean()

		mockOutgoingWebhook := model.OutgoingWebhook{
			Id:           outgoingWebhookID,
			TriggerWords: []string{},
			CallbackURLs: []string{},
			TriggerWhen:  0,
		}

		updatedOutgoingWebhook := mockOutgoingWebhook
		updatedOutgoingWebhook.TriggerWhen = 1

		cmd := &cobra.Command{}
		cmd.Flags().StringArray("url", []string{}, "")
		cmd.Flags().StringArray("trigger-word", []string{}, "")
		cmd.Flags().String("trigger-when", "start", "")

		s.client.
			EXPECT().
			GetOutgoingWebhook(context.TODO(), outgoingWebhookID).
			Return(&mockOutgoingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateOutgoingWebhook(context.TODO(), &mockOutgoingWebhook).
			Return(&updatedOutgoingWebhook, &model.Response{}, nil).
			Times(1)

		err := modifyOutgoingWebhookCmdF(s.client, cmd, []string{outgoingWebhookID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&updatedOutgoingWebhook, printer.GetLines()[0])
	})

	s.Run("Modify outgoing webhook error", func() {
		printer.Clean()

		mockOutgoingWebhook := model.OutgoingWebhook{
			Id:           outgoingWebhookID,
			TriggerWords: []string{},
			CallbackURLs: []string{},
			TriggerWhen:  0,
		}
		mockError := errors.New("mock error")

		cmd := &cobra.Command{}
		cmd.Flags().StringArray("url", []string{}, "")
		cmd.Flags().StringArray("trigger-word", []string{}, "")
		cmd.Flags().String("trigger-when", "start", "")

		s.client.
			EXPECT().
			GetOutgoingWebhook(context.TODO(), outgoingWebhookID).
			Return(&mockOutgoingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateOutgoingWebhook(context.TODO(), &mockOutgoingWebhook).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := modifyOutgoingWebhookCmdF(s.client, cmd, []string{outgoingWebhookID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to modify outgoing webhook", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestDeleteWebhookCmd() {
	incomingWebhookID := "incomingWebhookID"
	outgoingWebhookID := "outgoingWebhookID"

	s.Run("Successfully delete incoming webhook", func() {
		printer.Clean()

		mockIncomingWebhook := model.IncomingWebhook{Id: incomingWebhookID}

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), incomingWebhookID, "").
			Return(&mockIncomingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteIncomingWebhook(context.TODO(), incomingWebhookID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := deleteWebhookCmdF(s.client, &cobra.Command{}, []string{incomingWebhookID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&mockIncomingWebhook, printer.GetLines()[0])
	})

	s.Run("Successfully delete outgoing webhook", func() {
		printer.Clean()

		mockError := errors.New("mock error")
		mockOutgoingWebhook := model.OutgoingWebhook{Id: outgoingWebhookID}

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), outgoingWebhookID, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetOutgoingWebhook(context.TODO(), outgoingWebhookID).
			Return(&mockOutgoingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteOutgoingWebhook(context.TODO(), outgoingWebhookID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := deleteWebhookCmdF(s.client, &cobra.Command{}, []string{outgoingWebhookID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&mockOutgoingWebhook, printer.GetLines()[0])
	})

	s.Run("delete incoming webhook error", func() {
		printer.Clean()

		mockIncomingWebhook := model.IncomingWebhook{Id: incomingWebhookID}
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), incomingWebhookID, "").
			Return(&mockIncomingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteIncomingWebhook(context.TODO(), incomingWebhookID).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := deleteWebhookCmdF(s.client, &cobra.Command{}, []string{incomingWebhookID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to delete webhook '"+incomingWebhookID+"'", printer.GetErrorLines()[0])
	})

	s.Run("delete outgoing webhook error", func() {
		printer.Clean()

		mockError := errors.New("mock error")
		mockOutgoingWebhook := model.OutgoingWebhook{Id: outgoingWebhookID}

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), outgoingWebhookID, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetOutgoingWebhook(context.TODO(), outgoingWebhookID).
			Return(&mockOutgoingWebhook, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteOutgoingWebhook(context.TODO(), outgoingWebhookID).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := deleteWebhookCmdF(s.client, &cobra.Command{}, []string{outgoingWebhookID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("Unable to delete webhook '"+outgoingWebhookID+"'", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestShowWebhookCmd() {
	incomingWebhookID := "incomingWebhookID"
	outgoingWebhookID := "outgoingWebhookID"
	nonExistentID := "nonExistentID"

	s.Run("Successfully show incoming webhook", func() {
		printer.Clean()

		mockIncomingWebhook := model.IncomingWebhook{Id: incomingWebhookID}

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), incomingWebhookID, "").
			Return(&mockIncomingWebhook, &model.Response{}, nil).
			Times(1)

		err := showWebhookCmdF(s.client, &cobra.Command{}, []string{incomingWebhookID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(mockIncomingWebhook, printer.GetLines()[0])
	})

	s.Run("Successfully show outgoing webhook", func() {
		printer.Clean()

		mockError := errors.New("mock error")
		mockOutgoingWebhook := model.OutgoingWebhook{Id: outgoingWebhookID}

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), outgoingWebhookID, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetOutgoingWebhook(context.TODO(), outgoingWebhookID).
			Return(&mockOutgoingWebhook, &model.Response{}, nil).
			Times(1)

		err := showWebhookCmdF(s.client, &cobra.Command{}, []string{outgoingWebhookID})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(mockOutgoingWebhook, printer.GetLines()[0])
	})

	s.Run("Error in show webhook", func() {
		printer.Clean()

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetIncomingWebhook(context.TODO(), nonExistentID, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetOutgoingWebhook(context.TODO(), nonExistentID).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := showWebhookCmdF(s.client, &cobra.Command{}, []string{nonExistentID})
		s.Require().Error(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal("Webhook with id '"+nonExistentID+"' not found", err.Error())
	})
}
