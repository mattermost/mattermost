// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/web"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.uber.org/mock/gomock"
)

const (
	userID             = "userID"
	userEmail          = "user@example.com"
	teamID             = "teamID"
	teamName           = "teamName"
	teamDisplayName    = "teamDisplayName"
	channelID          = "channelID"
	channelName        = "channelName"
	channelDisplayName = "channelDisplayName"
)

func (s *MmctlUnitTestSuite) TestSearchChannelCmdF() {
	s.Run("Search for an existing channel on an existing team", func() {
		printer.Clean()
		mockTeam := model.Team{Id: teamID}
		mockChannel := model.Channel{Name: channelName}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamID, "")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByName(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockChannel, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Search for an existing channel without specifying team", func() {
		printer.Clean()
		otherTeamID := "example-team-id-2"
		mockTeams := []*model.Team{
			{Id: otherTeamID},
			{Id: teamID},
		}
		mockChannel := model.Channel{Name: channelName}

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 0, DefaultPageSize).
			Return(mockTeams, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 1, DefaultPageSize).
			Return([]*model.Team{}, &model.Response{}, nil).
			Times(1)

		// first call is for the other team, that doesn't have the channel
		s.client.
			EXPECT().
			GetChannelByName(context.TODO(), channelName, otherTeamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		// second call is for the team that contains the channel
		s.client.
			EXPECT().
			GetChannelByName(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, &cobra.Command{}, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockChannel, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Search for a nonexistent channel", func() {
		printer.Clean()
		mockTeam := model.Team{Id: teamID}

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamID, "")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByName(context.TODO(), channelName, teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, cmd, []string{channelName})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "channel "+channelName+" was not found in team "+teamID)
	})

	s.Run("Search for a channel in a nonexistent team", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("team", teamID, "")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := searchChannelCmdF(s.client, cmd, []string{channelName})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
		s.EqualError(err, "team "+teamID+" was not found")
	})
}

func (s *MmctlUnitTestSuite) TestModifyChannelCmdF() {
	s.Run("Both public and private the same value (false)", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", false, "")
		cmd.Flags().Bool("private", false, "")

		err := modifyChannelCmdF(s.client, cmd, []string{})
		s.Require().EqualError(err, "you must specify only one of --public or --private")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Both public and private the same value (true)", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", true, "")

		err := modifyChannelCmdF(s.client, cmd, []string{})
		s.Require().EqualError(err, "you must specify only one of --public or --private")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify non-existing channel", func() {
		printer.Clean()
		args := []string{channelID}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), args[0]).
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel %q", args[0]))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify a channel from a non-existing team", func() {
		printer.Clean()
		team := "mockTeam"
		channel := channelID
		args := []string{team + ":" + channel}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), team, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), team, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel %q", args[0]))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify direct channel", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypeDirect,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), args[0]).
			Return(channel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "you can only change the type of public/private channels")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify group channel", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypeGroup,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), args[0]).
			Return(channel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "you can only change the type of public/private channels")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Try to modify channel privacy and get error", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypePrivate,
		}
		mockError := errors.New("mock error")

		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), args[0]).
			Return(channel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelPrivacy(context.TODO(), channel.Id, model.ChannelTypeOpen).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("failed to update channel (%q) privacy: %s", channel.Id, mockError.Error()))
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Modify channel privacy to public", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypePrivate,
		}
		returnedChannel := &model.Channel{
			Id:   channel.Id,
			Type: model.ChannelTypeOpen,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", true, "")
		cmd.Flags().Bool("private", false, "")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), args[0]).
			Return(channel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelPrivacy(context.TODO(), channel.Id, model.ChannelTypeOpen).
			Return(returnedChannel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().NoError(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Modify channel privacy to private", func() {
		printer.Clean()
		channel := &model.Channel{
			Id:   channelID,
			Type: model.ChannelTypeOpen,
		}
		returnedChannel := &model.Channel{
			Id:   channel.Id,
			Type: model.ChannelTypePrivate,
		}
		args := []string{channel.Id}

		cmd := &cobra.Command{}
		cmd.Flags().String("username", "mockUser", "")
		cmd.Flags().Bool("public", false, "")
		cmd.Flags().Bool("private", true, "")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), args[0]).
			Return(channel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateChannelPrivacy(context.TODO(), channel.Id, model.ChannelTypePrivate).
			Return(returnedChannel, &model.Response{}, nil).
			Times(1)

		err := modifyChannelCmdF(s.client, cmd, args)
		s.Require().NoError(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("attribute flag", func() {
		f := newChannelAttributeFixture()
		secret := optionIDOf(f.classification, "Secret")
		f.program.Attrs["required"] = true

		channel := &model.Channel{Id: model.NewId(), Name: "town-hall", Type: model.ChannelTypeOpen}
		classificationItem := model.PropertyValuePatchItem{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)}

		newModifyCmd := func(public, private bool, attributes ...string) *cobra.Command {
			cmd := newTestCmd(s.T(), ModifyChannelCmd)
			s.Require().NoError(cmd.Flags().Set("public", strconv.FormatBool(public)))
			s.Require().NoError(cmd.Flags().Set("private", strconv.FormatBool(private)))
			for _, attribute := range attributes {
				s.Require().NoError(cmd.Flags().Set("attribute", attribute))
			}
			return cmd
		}
		expectChannel := func() {
			s.client.
				EXPECT().
				GetChannel(context.TODO(), channel.Id).
				Return(channel, &model.Response{}, nil).
				Times(1)
		}
		expectRead := func(values ...*model.PropertyValue) {
			s.client.
				EXPECT().
				GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
				Return(values, &model.Response{}, nil).
				Times(1)
		}

		s.Run("without the flag only UpdateChannelPrivacy is called", func() {
			printer.Clean()
			expectChannel()
			s.client.
				EXPECT().
				UpdateChannelPrivacy(context.TODO(), channel.Id, model.ChannelTypePrivate).
				Return(channel, &model.Response{}, nil).
				Times(1)

			s.Require().NoError(modifyChannelCmdF(s.client, newModifyCmd(false, true), []string{channel.Id}))
		})

		s.Run("public with the flag is an error before any request", func() {
			printer.Clean()

			err := modifyChannelCmdF(s.client, newModifyCmd(true, false, "Classification=Secret"), []string{channel.Id})
			s.Require().EqualError(err, "--attribute can be used only with --private")
		})

		s.Run("the flag without private or public is an error before any request", func() {
			printer.Clean()

			err := modifyChannelCmdF(s.client, newModifyCmd(false, false, "Classification=Secret"), []string{channel.Id})
			s.Require().EqualError(err, "you must specify only one of --public or --private")
		})

		s.Run("makes the channel private with the resolved values and reads them back", func() {
			printer.Clean()
			expectChannel()
			s.expectChannelAttributeFieldSearch(f.fields())
			s.client.
				EXPECT().
				UpdateChannelPrivacyWithPropertyValues(context.TODO(), channel.Id, model.ChannelTypePrivate, []model.PropertyValuePatchItem{classificationItem}).
				Return(channel, &model.Response{}, nil).
				Times(1)
			expectRead(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)})

			s.Require().NoError(modifyChannelCmdF(s.client, newModifyCmd(false, true, "classification=secret"), []string{channel.Id}))
			s.Require().Empty(printer.GetLines())
		})

		s.Run("an unknown option sends no privacy request", func() {
			printer.Clean()
			expectChannel()
			s.expectChannelAttributeFieldSearch(f.fields())

			err := modifyChannelCmdF(s.client, newModifyCmd(false, true, "Classification=Nope"), []string{channel.Id})
			s.Require().Error(err)
		})

		s.Run("an already private channel with the flag is an error before any write", func() {
			printer.Clean()
			private := &model.Channel{Id: model.NewId(), Name: "ops", Type: model.ChannelTypePrivate}
			s.client.
				EXPECT().
				GetChannel(context.TODO(), private.Id).
				Return(private, &model.Response{}, nil).
				Times(1)

			err := modifyChannelCmdF(s.client, newModifyCmd(false, true, "Classification=Secret"), []string{private.Id})
			s.Require().EqualError(err, `channel "`+private.Id+`" is already private; set its attribute values with "mmctl channel attributes set"`)
		})

		s.Run("a missing attribute error names the required attributes the channel lacks", func() {
			printer.Clean()
			expectChannel()
			s.expectChannelAttributeFieldSearch(f.fields())
			missingRequired := model.NewAppError("updateChannelPrivacy", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
			missingRequired.Message = "This channel is missing required attributes."
			s.client.
				EXPECT().
				UpdateChannelPrivacyWithPropertyValues(context.TODO(), channel.Id, model.ChannelTypePrivate, []model.PropertyValuePatchItem{classificationItem}).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)
			expectRead()

			err := modifyChannelCmdF(s.client, newModifyCmd(false, true, "Classification=Secret"), []string{channel.Id})
			s.Require().Error(err)
			s.Require().Contains(err.Error(), "This channel is missing required attributes.")
			s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Program\n")
		})

		s.Run("without the flag a missing attribute error skips the attributes the channel holds", func() {
			printer.Clean()
			expectChannel()
			missingRequired := model.NewAppError("updateChannelPrivacy", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
			missingRequired.Message = "This channel is missing required attributes."
			gomock.InOrder(
				s.client.
					EXPECT().
					UpdateChannelPrivacy(context.TODO(), channel.Id, model.ChannelTypePrivate).
					Return(nil, &model.Response{}, missingRequired).
					Times(1),
				s.client.
					EXPECT().
					SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
					Return(f.fields(), &model.Response{StatusCode: http.StatusOK}, nil).
					Times(1),
			)
			expectRead(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)})

			err := modifyChannelCmdF(s.client, newModifyCmd(false, true), []string{channel.Id})
			s.Require().Error(err)
			s.Require().Contains(err.Error(), "failed to update channel (")
			s.Require().Contains(err.Error(), "This channel is missing required attributes.")
			s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Program\n")
			s.Require().NotContains(err.Error(), "Classification")
		})

		s.Run("without the flag a failed field search leaves only the server error", func() {
			printer.Clean()
			expectChannel()
			missingRequired := model.NewAppError("updateChannelPrivacy", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
			missingRequired.Message = "This channel is missing required attributes."
			s.client.
				EXPECT().
				UpdateChannelPrivacy(context.TODO(), channel.Id, model.ChannelTypePrivate).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)
			s.client.
				EXPECT().
				SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
				Times(1)

			err := modifyChannelCmdF(s.client, newModifyCmd(false, true), []string{channel.Id})
			s.Require().Error(err)
			s.Require().Equal(`failed to update channel ("`+channel.Id+`") privacy: `+missingRequired.Error(), err.Error())
		})

		s.Run("without the flag another server error makes no field search", func() {
			printer.Clean()
			expectChannel()
			forbidden := model.NewAppError("updateChannelPrivacy", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			s.client.
				EXPECT().
				UpdateChannelPrivacy(context.TODO(), channel.Id, model.ChannelTypePrivate).
				Return(nil, &model.Response{}, forbidden).
				Times(1)

			err := modifyChannelCmdF(s.client, newModifyCmd(false, true), []string{channel.Id})
			s.Require().EqualError(err, `failed to update channel ("`+channel.Id+`") privacy: `+forbidden.Error())
		})

		s.Run("a read-back that doesn't hold the values is an error", func() {
			printer.Clean()
			f.classification.Permissions = &model.Permissions{}
			defer func() { f.classification.Permissions = nil }()
			expectChannel()
			s.expectChannelAttributeFieldSearch(f.fields())
			s.client.
				EXPECT().
				UpdateChannelPrivacyWithPropertyValues(context.TODO(), channel.Id, model.ChannelTypePrivate, []model.PropertyValuePatchItem{classificationItem}).
				Return(channel, &model.Response{}, nil).
				Times(1)
			expectRead()

			err := modifyChannelCmdF(s.client, newModifyCmd(false, true, "Classification=Secret"), []string{channel.Id})
			s.Require().ErrorContains(err, "the channel was updated, but the server didn't save the attribute values")
		})
	})
}

func (s *MmctlUnitTestSuite) TestArchiveChannelCmdF() {
	s.Run("Archive channel without args returns an error", func() {
		printer.Clean()

		err := archiveChannelsCmdF(s.client, &cobra.Command{}, []string{})
		mockErr := errors.New("enter at least one channel to archive")

		expected := mockErr.Error()
		actual := err.Error()

		s.Require().Equal(expected, actual)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Archive an existing channel on an existing team", func() {
		printer.Clean()

		mockTeam := model.Team{Id: teamID}
		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := teamID + ":" + channelName

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.TODO(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, []string{args})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Archive an existing channel specified by channel id", func() {
		printer.Clean()

		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := []string{channelName}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.TODO(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Archive several channels specified by channel id", func() {
		printer.Clean()

		channelArg1 := "some-channel"
		channelID1 := "some-channel-id"
		mockChannel1 := model.Channel{Id: channelID1, Name: channelArg1}

		channelArg2 := "some-other-channel"
		channelID2 := "some-other-channel-id"
		mockChannel2 := model.Channel{Id: channelID2, Name: channelArg2}

		cmd := &cobra.Command{}
		args := []string{channelArg1, channelArg2}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg1).
			Return(&mockChannel1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg2).
			Return(&mockChannel2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.TODO(), channelID1).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteChannel(context.TODO(), channelID2).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Fail to archive a channel on a non-existent team", func() {
		printer.Clean()

		teamArg := "some-non-existent-team-id"
		channelArg := "some-channel"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelArg}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive a non-existing channel on an existent team", func() {
		printer.Clean()

		teamArg := "some-non-existing-team-id"
		mockTeam := model.Team{Id: teamArg}
		channelArg := "some-non-existing-channel"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelArg}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelArg, teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive a non-existing channel", func() {
		printer.Clean()

		channelArg := "some-non-existing-channel"
		cmd := &cobra.Command{}
		args := []string{channelArg}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive an existing channel when client throws error", func() {
		printer.Clean()

		channelArg := "some-channel"
		channelID := "some-channel-id"
		mockChannel := model.Channel{Id: channelID, Name: channelArg}

		cmd := &cobra.Command{}
		args := []string{channelArg}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		mockErr := errors.New("mock error")
		s.client.
			EXPECT().
			DeleteChannel(context.TODO(), channelID).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockErr).
			Times(1)

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to archive channel '%s' error: %s", channelArg, mockErr.Error())
		s.Require().Equal(expected, actual)
	})

	s.Run("Fail to archive when team and channel not provided", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		args := []string{":"}

		err := archiveChannelsCmdF(s.client, cmd, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)

		expected := printer.GetErrorLines()[0]
		actual := fmt.Sprintf("Unable to find channel '%s'", args[0])
		s.Require().Equal(expected, actual)
	})

	s.Run("Avoid path traversal with a valid team name", func() {
		printer.Clean()
		arg := "team:/../hello/channel-test"

		err := archiveChannelsCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().Error(err)
		s.Require().Equal("Unable to find channel 'team:/../hello/channel-test'", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestListChannelsCmd() {
	emptyChannels := []*model.Channel{}

	s.Run("Team is not found", func() {
		printer.Clean()
		args := []string{""}
		args[0] = teamID
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, "unable to find team \""+teamID+"\"")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("unable to find team \""+teamID+"\"", printer.GetErrorLines()[0])
	})

	s.Run("Team has no channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		// Empty channels of a team
		publicChannels := []*model.Channel{}
		archivedChannels := []*model.Channel{}
		privateChannels := []*model.Channel{}
		userChannels := []*model.Channel{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Team with public channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		publicChannelName1 := "ChannelName1"
		publicChannel1 := &model.Channel{Name: publicChannelName1}

		publicChannelName2 := "ChannelName2"
		publicChannel2 := &model.Channel{Name: publicChannelName2}

		publicChannels := []*model.Channel{publicChannel1, publicChannel2}
		archivedChannels := []*model.Channel{} // Empty archived channels
		privateChannels := []*model.Channel{}  // Empty private channels
		userChannels := []*model.Channel{}     // Empty user channels

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
	})

	s.Run("Show channel IDs with --show-ids", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		defer printer.SetFormat(printer.FormatJSON)

		args := []string{teamID}
		cmd := &cobra.Command{}
		cmd.Flags().Bool("show-ids", true, "")

		team := &model.Team{
			Id: teamID,
		}

		publicChannel := &model.Channel{Id: "publicChannelId1", Name: "publicChannel1"}
		archivedChannel := &model.Channel{Id: "archivedChannelId1", Name: "archivedChannel1"}
		privateChannel := &model.Channel{Id: "privateChannelId1", Name: "privateChannel1"}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return([]*model.Channel{publicChannel}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return([]*model.Channel{archivedChannel}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return([]*model.Channel{privateChannel}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 3)
		s.Require().Equal("publicChannelId1: publicChannel1", printer.GetLines()[0])
		s.Require().Equal("archivedChannelId1: archivedChannel1 (archived)", printer.GetLines()[1])
		s.Require().Equal("privateChannelId1: privateChannel1 (private)", printer.GetLines()[2])
	})

	s.Run("Omit channel IDs without --show-ids", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		defer printer.SetFormat(printer.FormatJSON)

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		publicChannel := &model.Channel{Id: "publicChannelId1", Name: "publicChannel1"}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return([]*model.Channel{publicChannel}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 1)
		s.Require().Equal("publicChannel1", printer.GetLines()[0])
	})

	s.Run("show-ids flag is registered on the command", func() {
		flag := ListChannelsCmd.Flags().Lookup("show-ids")
		s.Require().NotNil(flag)
		s.Require().Equal("i", flag.Shorthand)
		s.Require().Equal("false", flag.DefValue)
	})

	s.Run("Team with archived channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		archivedChannelName1 := "ChannelName1"
		archivedChannel1 := &model.Channel{Name: archivedChannelName1}

		archivedChannelName2 := "ChannelName2"
		archivedChannel2 := &model.Channel{Name: archivedChannelName2}

		publicChannels := []*model.Channel{} // Empty public channels
		archivedChannels := []*model.Channel{archivedChannel1, archivedChannel2}
		privateChannels := []*model.Channel{} // Empty private channels
		userChannels := []*model.Channel{}    // Empty user channels

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], archivedChannel1)
		s.Require().Equal(printer.GetLines()[1], archivedChannel2)
	})

	s.Run("Team with public, archived and private channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannel2 := &model.Channel{Name: "archivedChannelName2"}
		archivedChannels := []*model.Channel{archivedChannel1, archivedChannel2}

		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		privateChannel1 := &model.Channel{Name: "privateChannel1"}
		privateChannel2 := &model.Channel{Name: "privateChannel2"}
		privateChannels := []*model.Channel{privateChannel1, privateChannel2}
		userChannels := []*model.Channel{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 6)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], archivedChannel2)
		s.Require().Equal(printer.GetLines()[4], privateChannel1)
		s.Require().Equal(printer.GetLines()[5], privateChannel2)
	})

	s.Run("User does not have permissions to get all private channels in team", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		team := &model.Team{
			Id: teamID,
		}
		cmd.PersistentFlags().Bool("local", false, "allows communicating with the server through a unix socket")
		_ = viper.BindPFlag("local", cmd.PersistentFlags().Lookup("local"))

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		publicChannel1 := &model.Channel{Name: "publicChannelName1"}

		privateChannel1 := &model.Channel{Name: "privateChannel1", Type: model.ChannelTypePrivate}
		privateChannel2 := &model.Channel{Name: "privateChannel2", Type: model.ChannelTypePrivate}
		userChannels := []*model.Channel{archivedChannel1, publicChannel1, privateChannel1, privateChannel2}

		mockError := errors.New("user does not have permissions to list all private channels in team")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(userChannels, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], privateChannel1)
		s.Require().Equal(printer.GetLines()[1], privateChannel2)
	})

	s.Run("API fails to get team's public channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}

		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list public channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's archived channels list", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list archived channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's private channels list", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(1) // falls through to GetChannelsForTeamForUser in non-local mode

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list private channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's private channels list in local mode", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		cmd.PersistentFlags().Bool("local", true, "allows communicating with the server through a unix socket")
		_ = viper.BindPFlag("local", cmd.PersistentFlags().Lookup("local"))
		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(emptyChannels, &model.Response{}, mockError).
			Times(0) // does not fall through to GetChannelsForTeamForUser in local mode

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list private channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("API fails to get team's public, archived and private channels", func() {
		printer.Clean()

		args := []string{teamID}
		cmd := &cobra.Command{}
		cmd.PersistentFlags().Bool("local", false, "allows communicating with the server through a unix socket")
		_ = viper.BindPFlag("local", cmd.PersistentFlags().Lookup("local"))

		team := &model.Team{
			Id: teamID,
		}

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(team, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 3)
		s.Require().Equal(printer.GetErrorLines()[0], fmt.Sprintf("unable to list public channels for %q: %s", args[0], mockError.Error()))
		s.Require().Equal(printer.GetErrorLines()[1], fmt.Sprintf("unable to list archived channels for %q: %s", args[0], mockError.Error()))
		s.Require().Equal(printer.GetErrorLines()[2], fmt.Sprintf("unable to list private channels for %q: %s", args[0], mockError.Error()))
	})

	s.Run("Two teams, one is found and other is not found", func() {
		printer.Clean()

		teamID1 := "teamID1"
		teamID2 := "teamID2"
		args := []string{teamID1, teamID2}
		cmd := &cobra.Command{}

		team1 := &model.Team{Id: teamID1}

		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannels := []*model.Channel{archivedChannel1}

		privateChannel1 := &model.Channel{Name: "privateChannelName1"}
		privateChannels := []*model.Channel{privateChannel1}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID1, "").
			Return(team1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID2, "").
			Return(nil, &model.Response{}, nil). // Team 2 not found
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamID2, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID1, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, "unable to find team \""+teamID2+"\"")
		s.Len(printer.GetErrorLines(), 1)
		s.Require().Equal("unable to find team \""+teamID2+"\"", printer.GetErrorLines()[0])
		s.Len(printer.GetLines(), 4)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], privateChannel1)
	})

	s.Run("Two teams, one is found and other has API errors", func() {
		printer.Clean()

		teamID1 := "teamID1"
		teamID2 := "teamID2"
		args := []string{teamID1, teamID2}
		cmd := &cobra.Command{}

		team1 := &model.Team{Id: teamID1}
		team2 := &model.Team{Id: teamID2}

		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannels := []*model.Channel{archivedChannel1}

		privateChannel1 := &model.Channel{Name: "privateChannelName1"}
		privateChannels := []*model.Channel{privateChannel1}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID1, "").
			Return(team1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID1, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID2, "").
			Return(team2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID2, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID2, 0, web.PerPageMaximum, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID2, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, mockError).
			Times(1)
		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID2, "me", false, "").
			Return(privateChannels, &model.Response{}, mockError).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, mockError.Error())
		s.Len(printer.GetErrorLines(), 3)
		s.Len(printer.GetLines(), 4)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], privateChannel1)
	})

	s.Run("Two teams, both are not found", func() {
		printer.Clean()

		team1ID := "team1ID"
		team2ID := "team2ID"
		args := []string{team1ID, team2ID}
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), team1ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeam(context.TODO(), team2ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), team1ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), team2ID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().ErrorContains(err, "unable to find team \""+team1ID+"\"")
		s.Require().ErrorContains(err, "unable to find team \""+team2ID+"\"")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 2)
		s.Require().Equal("unable to find team \""+team1ID+"\"", printer.GetErrorLines()[0])
		s.Require().Equal("unable to find team \""+team2ID+"\"", printer.GetErrorLines()[1])
	})

	s.Run("Two teams, both have channels", func() {
		printer.Clean()

		teamID1 := "teamID1"
		teamID2 := "teamID2"
		args := []string{teamID1, teamID2}
		cmd := &cobra.Command{}

		team1 := &model.Team{Id: teamID1}
		team2 := &model.Team{Id: teamID2}

		// Using same channel name for both teams since there can be common channels
		publicChannel1 := &model.Channel{Name: "publicChannelName1"}
		publicChannel2 := &model.Channel{Name: "publicChannelName2"}
		publicChannels := []*model.Channel{publicChannel1, publicChannel2}

		archivedChannel1 := &model.Channel{Name: "archivedChannelName1"}
		archivedChannels := []*model.Channel{archivedChannel1}

		privateChannel1 := &model.Channel{Name: "privateChannelName1"}
		privateChannels := []*model.Channel{privateChannel1}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID1, "").
			Return(team1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID1, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID1, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID1, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID2, "").
			Return(team2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID2, 0, web.PerPageMaximum, "").
			Return(publicChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPublicChannelsForTeam(context.TODO(), teamID2, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID2, 0, web.PerPageMaximum, "").
			Return(archivedChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetDeletedChannelsForTeam(context.TODO(), teamID2, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID2, 0, web.PerPageMaximum, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPrivateChannelsForTeam(context.TODO(), teamID2, 1, web.PerPageMaximum, "").
			Return(emptyChannels, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelsForTeamForUser(context.TODO(), teamID2, "me", false, "").
			Return(privateChannels, &model.Response{}, nil).
			Times(0)

		err := listChannelsCmdF(s.client, cmd, args)

		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
		s.Len(printer.GetLines(), 8)
		s.Require().Equal(printer.GetLines()[0], publicChannel1)
		s.Require().Equal(printer.GetLines()[1], publicChannel2)
		s.Require().Equal(printer.GetLines()[2], archivedChannel1)
		s.Require().Equal(printer.GetLines()[3], privateChannel1)
		s.Require().Equal(printer.GetLines()[4], publicChannel1)
		s.Require().Equal(printer.GetLines()[5], publicChannel2)
		s.Require().Equal(printer.GetLines()[6], archivedChannel1)
		s.Require().Equal(printer.GetLines()[7], privateChannel1)
	})

	s.Run("Avoid path traversal", func() {
		printer.Clean()
		arg := "\"test/../hello?\"channel-test"

		err := listChannelsCmdF(s.client, &cobra.Command{}, []string{arg})
		s.Require().ErrorContains(err, "unable to find team \"\\\"test/../hello?\\\"channel-test\"")
		s.Require().Equal("unable to find team \"\\\"test/../hello?\\\"channel-test\"", printer.GetErrorLines()[0])
	})
}

func (s *MmctlUnitTestSuite) TestUnarchiveChannelCmdF() {
	s.Run("Unarchive channel without args returns an error", func() {
		printer.Clean()

		err := unarchiveChannelsCmdF(s.client, &cobra.Command{}, []string{})
		mockErr := errors.New("enter at least one channel")

		expected := mockErr.Error()
		actual := err.Error()
		s.Require().Equal(expected, actual)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unarchive an existing channel on an existing team", func() {
		printer.Clean()

		mockTeam := model.Team{Id: teamID}
		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := teamID + ":" + channelName

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, []string{args})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unarchive an existing channel specified by channel id", func() {
		printer.Clean()

		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := []string{channelName}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unarchive several channels specified by channel id", func() {
		printer.Clean()

		channelArg1 := "some-channel"
		channelID1 := "some-channel-id"
		mockChannel1 := model.Channel{Id: channelID1, Name: channelArg1}

		channelArg2 := "some-other-channel"
		channelID2 := "some-other-channel-id"
		mockChannel2 := model.Channel{Id: channelID2, Name: channelArg2}

		cmd := &cobra.Command{}
		args := []string{channelArg1, channelArg2}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg1).
			Return(&mockChannel1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg2).
			Return(&mockChannel2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.TODO(), channelID1).
			Return(&mockChannel1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			RestoreChannel(context.TODO(), channelID2).
			Return(&mockChannel2, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Fail to unarchive a channel on a non-existent team", func() {
		printer.Clean()

		teamArg := "some-non-existent-team-id"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelName}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		expectedError := fmt.Sprintf("Unable to find channel '%s'", args[0])

		s.Require().ErrorContains(err, expectedError)
		s.Require().Equal(expectedError, printer.GetErrorLines()[0])

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("Fail to unarchive a non-existing channel on an existent team", func() {
		printer.Clean()

		teamArg := "some-non-existing-team-id"
		mockTeam := model.Team{Id: teamArg}
		channelArg := "some-non-existing-channel"

		cmd := &cobra.Command{}
		args := []string{teamArg + ":" + channelArg}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamArg, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelArg, teamArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		expectedError := fmt.Sprintf("Unable to find channel '%s'", args[0])

		s.Require().ErrorContains(err, expectedError)
		s.Require().Equal(expectedError, printer.GetErrorLines()[0])

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("Fail to unarchive a non-existing channel", func() {
		printer.Clean()

		channelArg := "some-non-existing-channel"
		cmd := &cobra.Command{}
		args := []string{channelArg}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelArg).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		expectedError := fmt.Sprintf("Unable to find channel '%s'", args[0])

		s.Require().ErrorContains(err, expectedError)
		s.Require().Equal(expectedError, printer.GetErrorLines()[0])

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("Fail to unarchive an existing channel when client throws error", func() {
		printer.Clean()

		mockChannel := model.Channel{Id: channelID, Name: channelName}

		cmd := &cobra.Command{}
		args := []string{channelName}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		mockErr := errors.New("mock error")
		s.client.
			EXPECT().
			RestoreChannel(context.TODO(), channelID).
			Return(nil, &model.Response{}, mockErr).
			Times(1)

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		expectedError := fmt.Sprintf("Unable to unarchive channel '%s'. Error: %s", channelName, mockErr.Error())

		s.Require().ErrorContains(err, expectedError)
		s.Require().Equal(expectedError, printer.GetErrorLines()[0])

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("Fail to unarchive when team and channel not provided", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		args := []string{":"}

		err := unarchiveChannelsCmdF(s.client, cmd, args)
		expectedError := fmt.Sprintf("Unable to find channel '%s'", args[0])

		s.Require().ErrorContains(err, expectedError)
		s.Require().Equal(expectedError, printer.GetErrorLines()[0])

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
	})

	s.Run("attribute flag", func() {
		f := newChannelAttributeFixture()
		secret := optionIDOf(f.classification, "Secret")
		f.program.Attrs["required"] = true

		first := &model.Channel{Id: model.NewId(), Name: "first"}
		second := &model.Channel{Id: model.NewId(), Name: "second"}
		classificationItem := model.PropertyValuePatchItem{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)}
		items := []model.PropertyValuePatchItem{classificationItem}

		newUnarchiveCmd := func(attributes ...string) *cobra.Command {
			cmd := newTestCmd(s.T(), UnarchiveChannelCmd)
			for _, attribute := range attributes {
				s.Require().NoError(cmd.Flags().Set("attribute", attribute))
			}
			return cmd
		}
		expectChannels := func(channels ...*model.Channel) {
			for _, channel := range channels {
				s.client.
					EXPECT().
					GetChannel(context.TODO(), channel.Name).
					Return(channel, &model.Response{}, nil).
					Times(1)
			}
		}
		expectRead := func(channel *model.Channel, values ...*model.PropertyValue) {
			s.client.
				EXPECT().
				GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
				Return(values, &model.Response{}, nil).
				Times(1)
		}
		held := &model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)}

		s.Run("restores every channel with the values resolved once", func() {
			printer.Clean()
			s.expectChannelAttributeFieldSearch(f.fields())
			expectChannels(first, second)
			for _, channel := range []*model.Channel{first, second} {
				s.client.
					EXPECT().
					RestoreChannelWithPropertyValues(context.TODO(), channel.Id, items).
					Return(channel, &model.Response{}, nil).
					Times(1)
				expectRead(channel, held)
			}

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd("Classification=Secret"), []string{first.Name, second.Name})
			s.Require().NoError(err)
			s.Require().Empty(printer.GetErrorLines())
		})

		s.Run("one failure doesn't stop the rest and names the failing channel", func() {
			printer.Clean()
			s.expectChannelAttributeFieldSearch(f.fields())
			expectChannels(first, second)
			missingRequired := model.NewAppError("restoreChannel", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
			missingRequired.Message = "This channel is missing required attributes."
			s.client.
				EXPECT().
				RestoreChannelWithPropertyValues(context.TODO(), first.Id, items).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)
			expectRead(first)
			s.client.
				EXPECT().
				RestoreChannelWithPropertyValues(context.TODO(), second.Id, items).
				Return(second, &model.Response{}, nil).
				Times(1)
			expectRead(second, held)

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd("Classification=Secret"), []string{first.Name, second.Name})
			s.Require().Error(err)
			s.Require().Contains(err.Error(), "Unable to unarchive channel 'first'")
			s.Require().NotContains(err.Error(), "'second'")
			s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Program\n")
			s.Require().Len(printer.GetErrorLines(), 1)
		})

		s.Run("without the flag each refused channel gets the hint and the fields are fetched once", func() {
			printer.Clean()
			expectChannels(first, second)
			missingRequired := model.NewAppError("restoreChannel", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
			missingRequired.Message = "This channel is missing required attributes."
			s.client.
				EXPECT().
				RestoreChannel(context.TODO(), first.Id).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)
			s.expectChannelAttributeFieldSearch(f.fields())
			expectRead(first)
			s.client.
				EXPECT().
				RestoreChannel(context.TODO(), second.Id).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)
			expectRead(second, held)

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd(), []string{first.Name, second.Name})
			s.Require().Error(err)
			s.Require().Contains(err.Error(), "Unable to unarchive channel 'first'")
			s.Require().Contains(err.Error(), "Unable to unarchive channel 'second'")
			s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Classification, Program\n")
			s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Program\n")
			s.Require().Len(printer.GetErrorLines(), 2)
		})

		s.Run("without the flag a failed field search leaves only the server error", func() {
			printer.Clean()
			expectChannels(first)
			missingRequired := model.NewAppError("restoreChannel", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
			missingRequired.Message = "This channel is missing required attributes."
			s.client.
				EXPECT().
				RestoreChannel(context.TODO(), first.Id).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)
			s.client.
				EXPECT().
				SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
				Times(1)

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd(), []string{first.Name})
			s.Require().EqualError(err, "1 error occurred:\n\t* Unable to unarchive channel 'first'. Error: "+missingRequired.Error()+"\n\n")
		})

		s.Run("without the flag another server error makes no field search", func() {
			printer.Clean()
			expectChannels(first)
			forbidden := model.NewAppError("restoreChannel", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			s.client.
				EXPECT().
				RestoreChannel(context.TODO(), first.Id).
				Return(nil, &model.Response{}, forbidden).
				Times(1)

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd(), []string{first.Name})
			s.Require().ErrorContains(err, "Unable to unarchive channel 'first'. Error: "+forbidden.Error())
		})

		s.Run("a read-back that doesn't hold the values is a failure of that channel", func() {
			printer.Clean()
			f.classification.Permissions = &model.Permissions{}
			defer func() { f.classification.Permissions = nil }()
			s.expectChannelAttributeFieldSearch(f.fields())
			expectChannels(first)
			s.client.
				EXPECT().
				RestoreChannelWithPropertyValues(context.TODO(), first.Id, items).
				Return(first, &model.Response{}, nil).
				Times(1)
			expectRead(first)

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd("Classification=Secret"), []string{first.Name})
			s.Require().ErrorContains(err, "the channel was unarchived, but the server didn't save the attribute values")
			s.Require().Len(printer.GetErrorLines(), 1)
		})

		s.Run("an unknown option sends no request for any channel", func() {
			printer.Clean()
			s.expectChannelAttributeFieldSearch(f.fields())

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd("Classification=Nope"), []string{first.Name, second.Name})
			s.Require().Error(err)
			s.Require().Empty(printer.GetErrorLines())
		})

		s.Run("a flag-off server stops before any write", func() {
			printer.Clean()
			s.client.
				EXPECT().
				SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
				Times(1)

			err := unarchiveChannelsCmdF(s.client, newUnarchiveCmd("Classification=Secret"), []string{first.Name})
			s.Require().EqualError(err, "channel attributes aren't enabled on this server")
		})
	})
}

func (s *MmctlUnitTestSuite) TestRenameChannelCmd() {
	s.Run("It should fail when no name and display name is supplied", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		args := []string{""}
		args[0] = "teamName:channelName"

		cmd.Flags().String("name", "", "Channel Name")
		cmd.Flags().String("display-name", "", channelDisplayName)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "require at least one flag to rename channel, either 'name' or 'display-name'")
	})

	s.Run("It should fail when empty team and channel name are supplied", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := ""
		channelName := ""
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when empty channel is supplied", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		channelName := ""
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}
		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail with empty team and non existing channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := ""
		channelName := "nonExistingChannelName"
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when team is not found", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "nonExistingteamName"
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when channel is not found", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		channelName := "nonExistingChannelName"
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find channel from %q", argsTeamChannel))
	})

	s.Run("It should fail when api fails to rename", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
			Name:        &newChannelName,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		mockError := model.NewAppError("at-random-location.go", "mock error", nil, "mocking a random error", 0)
		s.client.
			EXPECT().
			PatchChannel(context.TODO(), foundChannel.Id, channelPatch).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("cannot rename channel %q, error: %s", foundChannel.Name, mockError.Error()))
	})

	s.Run("It should work as expected", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
			Name:        &newChannelName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.TODO(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})

	s.Run("It should work with empty team and existing channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := ""
		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
			Name:        &newChannelName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.TODO(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})

	s.Run("It should work even if only name flag is passed", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := "newChannelName"
		newChannelDisplayName := ""
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			Name: &newChannelName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.TODO(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})

	s.Run("It should work even if only display name flag is passed", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		argsTeamChannel := teamName + ":" + channelName
		args := []string{argsTeamChannel}

		newChannelName := ""
		newChannelDisplayName := "New Channel Name"
		cmd.Flags().String("name", newChannelName, "Channel Name")
		cmd.Flags().String("display-name", newChannelDisplayName, channelDisplayName)

		foundTeam := &model.Team{
			Id:          teamID,
			DisplayName: teamDisplayName,
			Name:        teamName,
		}

		foundChannel := &model.Channel{
			Id:          channelID,
			Name:        channelName,
			DisplayName: channelDisplayName,
		}

		channelPatch := &model.ChannelPatch{
			DisplayName: &newChannelDisplayName,
		}

		updatedChannel := &model.Channel{
			Id:          channelID,
			Name:        newChannelName,
			DisplayName: newChannelDisplayName,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, foundTeam.Id, "").
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchChannel(context.TODO(), foundChannel.Id, channelPatch).
			Return(updatedChannel, &model.Response{}, nil).
			Times(1)

		err := renameChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], updatedChannel)
	})
}

func (s *MmctlUnitTestSuite) TestMoveChannelCmdF() {
	s.Run("Move a channel to another team by using names", func() {
		printer.Clean()

		dstTeamName := "destination-team-name"
		dstTeamID := "destination-team-id"
		mockTeam1 := model.Team{
			Name: dstTeamName,
			Id:   dstTeamID,
		}

		srcTeamName := "source-team-name"
		srcTeamID := "source-team-id"
		mockTeam2 := model.Team{
			Name: srcTeamName,
			Id:   srcTeamID,
		}

		channelName := "channel-name"
		channelID := "channel-id"
		mockChannel := model.Channel{
			Name:   channelName,
			TeamId: mockTeam2.Id,
			Id:     channelID,
		}

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), dstTeamName, "").
			Return(&mockTeam1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeam(context.TODO(), srcTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), srcTeamName, "").
			Return(&mockTeam2, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, mockTeam2.Id, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), mockChannel.Id, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			MoveChannel(context.TODO(), mockChannel.Id, mockTeam1.Id, false).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamName, srcTeamName + ":" + channelName})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal(&mockChannel, printer.GetLines()[0])
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should fail for not being able to find the destination team", func() {
		printer.Clean()

		dstTeamName := "destination-team-name"

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), dstTeamName, "").
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamName, "team:channel"})

		s.Require().EqualError(err, fmt.Sprintf("unable to find destination team %q", dstTeamName))
	})

	s.Run("Should fail for not being able to find the channel", func() {
		printer.Clean()

		dstTeamName := "destination-team-name"
		dstTeamID := "destination-team-id"
		mockTeam1 := model.Team{
			Name: dstTeamName,
			Id:   dstTeamID,
		}

		channelID := "channel-id"

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam1, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(nil, &model.Response{}, errors.New("")).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to find channel %q", channelID))

		s.Require().EqualError(err, expected.Error())
	})

	s.Run("Fail on client.MoveChannel to another team by using Ids", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam1 := model.Team{
			Id: dstTeamID,
		}

		channelID := "channel-id"

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam1, &model.Response{}, errors.New("")).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(&model.Channel{Id: channelID, Name: "some-name"}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			MoveChannel(context.TODO(), channelID, mockTeam1.Id, false).
			Return(nil, &model.Response{}, errors.New("some-error")).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to move channel %q: some-error", "some-name"))

		s.Require().EqualError(err, expected.Error())
	})

	s.Run("List the missing users and skip the move when they are not in the destination team", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam := model.Team{Name: "destination-team-name", Id: dstTeamID}

		channelID := "channel-id"
		mockChannel := model.Channel{Name: "channel-name", TeamId: "source-team-id", Id: channelID}

		inTeamUser := &model.User{Id: "in-team-user-id"}
		missingUser := &model.User{Id: "missing-user-id", Username: "missing-user"}
		channelMembers := model.ChannelMembers{
			{UserId: inTeamUser.Id, ChannelId: channelID},
			{UserId: missingUser.Id, ChannelId: channelID},
		}

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(channelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 1, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamMembersByIds(context.TODO(), dstTeamID, []string{inTeamUser.Id, missingUser.Id}).
			Return([]*model.TeamMember{{UserId: inTeamUser.Id, TeamId: dstTeamID}}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{missingUser.Id}).
			Return([]*model.User{missingUser}, &model.Response{}, nil).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "missing-user")
		s.Require().NotContains(err.Error(), "in-team-user")
		s.Require().Contains(err.Error(), "--auto-add-users")
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Auto-add the missing users to the destination team before moving the channel", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam := model.Team{Name: "destination-team-name", Id: dstTeamID}

		channelID := "channel-id"
		mockChannel := model.Channel{Name: "channel-name", TeamId: "source-team-id", Id: channelID}

		inTeamUser := &model.User{Id: "in-team-user-id"}
		missingUser := &model.User{Id: "missing-user-id", Username: "missing-user"}
		channelMembers := model.ChannelMembers{
			{UserId: inTeamUser.Id, ChannelId: channelID},
			{UserId: missingUser.Id, ChannelId: channelID},
		}

		cmd := &cobra.Command{}
		cmd.Flags().Bool("auto-add-users", true, "")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(channelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 1, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamMembersByIds(context.TODO(), dstTeamID, []string{inTeamUser.Id, missingUser.Id}).
			Return([]*model.TeamMember{{UserId: inTeamUser.Id, TeamId: dstTeamID}}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{missingUser.Id}).
			Return([]*model.User{missingUser}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			AddTeamMember(context.TODO(), dstTeamID, missingUser.Id).
			Return(&model.TeamMember{TeamId: dstTeamID, UserId: missingUser.Id}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			MoveChannel(context.TODO(), channelID, dstTeamID, false).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(missingUser, printer.GetLines()[0])
		s.Require().Equal(&mockChannel, printer.GetLines()[1])
	})

	s.Run("Report a failure to auto-add a user and skip the move", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam := model.Team{Name: "destination-team-name", Id: dstTeamID}

		channelID := "channel-id"
		mockChannel := model.Channel{Name: "channel-name", TeamId: "source-team-id", Id: channelID}

		missingUser := &model.User{Id: "missing-user-id", Username: "missing-user"}
		channelMembers := model.ChannelMembers{
			{UserId: missingUser.Id, ChannelId: channelID},
		}

		cmd := &cobra.Command{}
		cmd.Flags().Bool("auto-add-users", true, "")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(channelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 1, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamMembersByIds(context.TODO(), dstTeamID, []string{missingUser.Id}).
			Return([]*model.TeamMember{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{missingUser.Id}).
			Return([]*model.User{missingUser}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			AddTeamMember(context.TODO(), dstTeamID, missingUser.Id).
			Return(nil, &model.Response{}, errors.New("add-error")).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "unable to add user \"missing-user\"")
		s.Require().Contains(err.Error(), "add-error")
	})

	s.Run("With --force, skip the team membership check and remove users while moving", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam := model.Team{Name: "destination-team-name", Id: dstTeamID}

		channelID := "channel-id"
		mockChannel := model.Channel{Name: "channel-name", TeamId: "source-team-id", Id: channelID}

		cmd := &cobra.Command{}
		cmd.Flags().Bool("force", true, "")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		// With --force the missing-user check is bypassed entirely; the strict
		// mock controller would fail if GetChannelMembers/GetTeamMembersByIds were
		// called. force is propagated to the move call.
		s.client.
			EXPECT().
			MoveChannel(context.TODO(), channelID, dstTeamID, true).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(&mockChannel, printer.GetLines()[0])
	})

	s.Run("Report an error when the channel members cannot be fetched", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam := model.Team{Name: "destination-team-name", Id: dstTeamID}

		channelID := "channel-id"
		mockChannel := model.Channel{Name: "channel-name", TeamId: "source-team-id", Id: channelID}

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(nil, &model.Response{}, errors.New("fetch-error")).
			Times(1)

		// The move must be skipped when membership cannot be determined.
		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "unable to determine missing team members for channel \"channel-name\"")
		s.Require().Contains(err.Error(), "fetch-error")
	})

	s.Run("Detect deactivated channel members missing from the destination team", func() {
		printer.Clean()

		dstTeamID := "destination-team-id"
		mockTeam := model.Team{Name: "destination-team-name", Id: dstTeamID}

		channelID := "channel-id"
		mockChannel := model.Channel{Name: "channel-name", TeamId: "source-team-id", Id: channelID}

		deactivatedUser := &model.User{Id: "deactivated-user-id", Username: "deactivated-user", DeleteAt: 1}
		channelMembers := model.ChannelMembers{
			{UserId: deactivatedUser.Id, ChannelId: channelID},
		}

		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), dstTeamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelID).
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 0, DefaultPageSize, "").
			Return(channelMembers, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelMembers(context.TODO(), channelID, 1, DefaultPageSize, "").
			Return(model.ChannelMembers{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamMembersByIds(context.TODO(), dstTeamID, []string{deactivatedUser.Id}).
			Return([]*model.TeamMember{}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUsersByIds(context.TODO(), []string{deactivatedUser.Id}).
			Return([]*model.User{deactivatedUser}, &model.Response{}, nil).
			Times(1)

		err := moveChannelCmdF(s.client, cmd, []string{dstTeamID, channelID})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "deactivated-user")
		s.Require().Contains(err.Error(), "--auto-add-users")
	})
}

func (s *MmctlUnitTestSuite) TestCreateChannelCmd() {
	s.Run("should not create channel without display name", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		args := []string{teamName + ":" + channelName}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "display-name is required")
	})

	s.Run("should not create channel without name", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "name is required")
	})

	s.Run("should not create channel without team", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, "team is required")
	})

	s.Run("should fail when team does not exist", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().EqualError(err, fmt.Sprintf("unable to find team: %s", teamName))
	})

	s.Run("should create public channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")

		foundTeam := &model.Team{
			Id:          "teamId",
			Name:        teamName,
			DisplayName: "teamDisplayName",
		}

		foundChannel := &model.Channel{
			TeamId:      "teamId",
			Name:        channelName,
			DisplayName: channelDisplayName,
			Type:        model.ChannelTypeOpen,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateChannel(context.TODO(), foundChannel).
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], foundChannel)
	})

	s.Run("should create private channel", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")
		cmd.Flags().Bool("private", true, "Create a private channel")

		foundTeam := &model.Team{
			Id:          "teamId",
			Name:        teamName,
			DisplayName: "teamDisplayName",
		}

		foundChannel := &model.Channel{
			TeamId:      "teamId",
			Name:        channelName,
			DisplayName: channelDisplayName,
			Type:        model.ChannelTypePrivate,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateChannel(context.TODO(), foundChannel).
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], foundChannel)
	})

	s.Run("should create channel with header and purpose", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		teamName := "teamName"
		channelName := "channelName"
		channelDisplayName := "channelDisplayName"
		header := "someHeader"
		purpose := "somePurpose"
		argsTeamChannel := teamName + ":" + channelName + ":" + channelDisplayName
		args := []string{argsTeamChannel}

		cmd.Flags().String("team", teamName, "Team Name")
		cmd.Flags().String("name", channelName, "Channel Name")
		cmd.Flags().String("display-name", channelDisplayName, "Channel Display Name")
		cmd.Flags().String("header", header, "Channel header")
		cmd.Flags().String("purpose", purpose, "Channel purpose")
		cmd.Flags().Bool("private", true, "Create a private channel")

		foundTeam := &model.Team{
			Id:          "teamId",
			Name:        teamName,
			DisplayName: "teamDisplayName",
		}

		foundChannel := &model.Channel{
			TeamId:      "teamId",
			Name:        channelName,
			DisplayName: channelDisplayName,
			Header:      header,
			Purpose:     purpose,
			Type:        model.ChannelTypePrivate,
		}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(foundTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateChannel(context.TODO(), foundChannel).
			Return(foundChannel, &model.Response{}, nil).
			Times(1)

		err := createChannelCmdF(s.client, cmd, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], foundChannel)
	})

	s.Run("attribute flag", func() {
		f := newChannelAttributeFixture()
		secret := optionIDOf(f.classification, "Secret")
		borealis := optionIDOf(f.program, "Borealis")
		f.program.Attrs["required"] = true

		team := &model.Team{Id: "teamId", Name: "teamName"}
		newChannel := &model.Channel{TeamId: team.Id, Name: "ops", DisplayName: "Ops", Type: model.ChannelTypeOpen}
		createdChannel := &model.Channel{Id: model.NewId(), TeamId: team.Id, Name: "ops", DisplayName: "Ops", Type: model.ChannelTypeOpen}

		newCreateCmd := func(attributes ...string) *cobra.Command {
			cmd := newTestCmd(s.T(), ChannelCreateCmd)
			s.Require().NoError(cmd.Flags().Set("team", "teamName"))
			s.Require().NoError(cmd.Flags().Set("name", "ops"))
			s.Require().NoError(cmd.Flags().Set("display-name", "Ops"))
			for _, attribute := range attributes {
				s.Require().NoError(cmd.Flags().Set("attribute", attribute))
			}
			return cmd
		}

		expectTeam := func() {
			s.client.
				EXPECT().
				GetTeam(context.TODO(), "teamName", "").
				Return(team, &model.Response{}, nil).
				Times(1)
		}

		classificationItem := model.PropertyValuePatchItem{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)}
		request := func(items ...model.PropertyValuePatchItem) *model.ChannelCreateRequest {
			return &model.ChannelCreateRequest{Channel: *newChannel, PropertyValues: items}
		}
		expectRead := func(values ...*model.PropertyValue) {
			s.client.
				EXPECT().
				GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, createdChannel.Id, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
				Return(values, &model.Response{}, nil).
				Times(1)
		}
		missingRequired := model.NewAppError("createChannel", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
		missingRequired.Message = "This channel is missing required attributes."

		s.Run("without the flag only CreateChannel is called", func() {
			printer.Clean()
			expectTeam()
			s.client.
				EXPECT().
				CreateChannel(context.TODO(), newChannel).
				Return(createdChannel, &model.Response{}, nil).
				Times(1)

			err := createChannelCmdF(s.client, newCreateCmd(), nil)
			s.Require().NoError(err)
			s.Require().Equal([]any{createdChannel}, printer.GetLines())
		})

		s.Run("creates the channel with the resolved values and reads them back", func() {
			printer.Clean()
			expectTeam()
			s.expectChannelAttributeFieldSearch(f.fields())
			s.client.
				EXPECT().
				CreateChannelWithPropertyValues(context.TODO(), request(classificationItem)).
				Return(createdChannel, &model.Response{}, nil).
				Times(1)
			expectRead(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(` "` + secret + `" `)})

			err := createChannelCmdF(s.client, newCreateCmd("classification=secret"), nil)
			s.Require().NoError(err)
			s.Require().Equal([]any{createdChannel}, printer.GetLines())
		})

		s.Run("an unknown attribute or option sends no create request", func() {
			for _, attribute := range []string{"Nope=1", "Classification=Nope"} {
				printer.Clean()
				expectTeam()
				s.expectChannelAttributeFieldSearch(f.fields())

				err := createChannelCmdF(s.client, newCreateCmd(attribute), nil)
				s.Require().Error(err, attribute)
				s.Require().Empty(printer.GetLines())
			}
		})

		s.Run("a missing attribute error names only the required attributes not passed", func() {
			printer.Clean()
			expectTeam()
			s.expectChannelAttributeFieldSearch(f.fields())
			s.client.
				EXPECT().
				CreateChannelWithPropertyValues(context.TODO(), request(classificationItem)).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)

			err := createChannelCmdF(s.client, newCreateCmd("Classification=Secret"), nil)
			s.Require().Error(err)
			s.Require().Contains(err.Error(), "This channel is missing required attributes.")
			s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Program\n")
			s.Require().NotContains(err.Error(), "Classification,")
			s.Require().Contains(err.Error(), `Run "mmctl channel attributes fields"`)
			s.Require().Empty(printer.GetLines())
		})

		s.Run("a missing attribute error with no visible required field prints only the server message", func() {
			printer.Clean()
			expectTeam()
			s.expectChannelAttributeFieldSearch([]*model.PropertyField{f.notes})
			notesItem := model.PropertyValuePatchItem{FieldID: f.notes.ID, Value: json.RawMessage(`"x"`)}
			s.client.
				EXPECT().
				CreateChannelWithPropertyValues(context.TODO(), request(notesItem)).
				Return(nil, &model.Response{}, missingRequired).
				Times(1)

			err := createChannelCmdF(s.client, newCreateCmd("Notes=x"), nil)
			s.Require().Equal(missingRequired, err)
		})

		s.Run("another server error is returned as is", func() {
			printer.Clean()
			expectTeam()
			s.expectChannelAttributeFieldSearch(f.fields())
			forbidden := model.NewAppError("createChannel", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			s.client.
				EXPECT().
				CreateChannelWithPropertyValues(context.TODO(), request(classificationItem)).
				Return(nil, &model.Response{}, forbidden).
				Times(1)

			err := createChannelCmdF(s.client, newCreateCmd("Classification=Secret"), nil)
			s.Require().Equal(forbidden, err)
		})

		s.Run("without the flag a missing attribute error names the required attributes after the failure", func() {
			printer.Clean()
			expectTeam()
			gomock.InOrder(
				s.client.
					EXPECT().
					CreateChannel(context.TODO(), newChannel).
					Return(nil, &model.Response{}, missingRequired).
					Times(1),
				s.client.
					EXPECT().
					SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
					Return(f.fields(), &model.Response{StatusCode: http.StatusOK}, nil).
					Times(1),
			)

			err := createChannelCmdF(s.client, newCreateCmd(), nil)
			s.Require().Error(err)
			s.Require().Contains(err.Error(), "This channel is missing required attributes.")
			s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Classification, Program\n")
			s.Require().Empty(printer.GetLines())
		})

		s.Run("without the flag a failed field search leaves only the server error", func() {
			for _, status := range []int{http.StatusNotFound, http.StatusForbidden} {
				printer.Clean()
				expectTeam()
				s.client.
					EXPECT().
					CreateChannel(context.TODO(), newChannel).
					Return(nil, &model.Response{}, missingRequired).
					Times(1)
				s.client.
					EXPECT().
					SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
					Return(nil, &model.Response{StatusCode: status}, errors.New("refused")).
					Times(1)

				err := createChannelCmdF(s.client, newCreateCmd(), nil)
				s.Require().Equal(missingRequired, err)
			}
		})

		s.Run("without the flag another server error makes no field search", func() {
			printer.Clean()
			expectTeam()
			forbidden := model.NewAppError("createChannel", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			s.client.
				EXPECT().
				CreateChannel(context.TODO(), newChannel).
				Return(nil, &model.Response{}, forbidden).
				Times(1)

			err := createChannelCmdF(s.client, newCreateCmd(), nil)
			s.Require().Equal(forbidden, err)
		})

		s.Run("a read-back that doesn't hold the values still reports the creation and is an error", func() {
			printer.Clean()
			f.classification.Permissions = &model.Permissions{}
			defer func() { f.classification.Permissions = nil }()
			expectTeam()
			s.expectChannelAttributeFieldSearch(f.fields())
			s.client.
				EXPECT().
				CreateChannelWithPropertyValues(context.TODO(), request(classificationItem)).
				Return(createdChannel, &model.Response{}, nil).
				Times(1)
			expectRead(&model.PropertyValue{FieldID: f.program.ID, Value: json.RawMessage(`"` + borealis + `"`)})

			err := createChannelCmdF(s.client, newCreateCmd("Classification=Secret"), nil)
			s.Require().EqualError(err, "the channel was created, but the server didn't save the attribute values; the server may be older than this mmctl")
			s.Require().Equal([]any{createdChannel}, printer.GetLines())
		})

		s.Run("a flag-off server stops before any write", func() {
			printer.Clean()
			expectTeam()
			s.client.
				EXPECT().
				SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
				Times(1)

			err := createChannelCmdF(s.client, newCreateCmd("Classification=Secret"), nil)
			s.Require().EqualError(err, "channel attributes aren't enabled on this server")
		})
	})
}

func (s *MmctlUnitTestSuite) TestDeleteChannelsCmd() {
	teamName := "team1"
	teamID := "teamId"
	mockTeam := model.Team{
		Name: teamName,
		Id:   teamID,
	}

	channelName := "channel1"
	channelID := "channel1Id"
	mockChannel := model.Channel{
		Name: channelName,
		Id:   channelID,
	}

	s.Run("Delete channels without confirm flag returns an error", func() {
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		err := deleteChannelsCmdF(s.client, cmd, []string{"some"})
		s.Require().NotNil(err)
		s.Require().Equal("could not proceed, either enable --confirm flag or use an interactive shell to complete operation: this is not an interactive shell", err.Error())
	})

	s.Run("Delete channel that does not exist in db returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName).
			Return(nil, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg := teamID + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg})
		var expected error
		expected = multierror.Append(expected, errors.New("unable to find channel '"+arg+"'"))
		s.Require().EqualError(err, expected.Error())
	})

	s.Run("Delete channel from team that does not exist in db returns an error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), teamName, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg := teamName + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg})

		var expected error
		expected = multierror.Append(expected, errors.New("unable to find channel '"+arg+"'"))
		s.Require().EqualError(err, expected.Error())
	})

	s.Run("Delete channel should delete channel", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			PermanentDeleteChannel(context.TODO(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg := teamID + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg})
		s.Require().Nil(err)
		s.Require().Equal(&mockChannel, printer.GetLines()[0])
	})

	s.Run("Delete two channels, first one does not exist", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(&mockTeam, nil, nil).
			Times(2)

		channelNameDoesNotExist := "this channel does not exist"
		mockError := errors.New("channel does not exist error")

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelNameDoesNotExist, teamID, "").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelNameDoesNotExist).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
			Return(&mockChannel, nil, nil).
			Times(1)

		s.client.
			EXPECT().
			PermanentDeleteChannel(context.TODO(), channelID).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		arg1 := teamID + ":" + channelNameDoesNotExist
		arg2 := teamID + ":" + channelName
		err := deleteChannelsCmdF(s.client, cmd, []string{arg1, arg2})

		var expected error
		expected = multierror.Append(expected, fmt.Errorf("unable to find channel '%s'", arg1))
		s.Require().EqualError(err, expected.Error())
		s.Require().Equal(&mockChannel, printer.GetLines()[0])
	})
}
