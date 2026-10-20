// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

func (s *MmctlUnitTestSuite) TestGetChannelArgs() {
	s.Run("channel not found", func() {
		notFoundChannel := "notfoundchannel"
		notFoundErr := errors.New("channel not found")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), notFoundChannel).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
			Times(1)

		channels, err := getChannelsFromArgs(s.client, []string{notFoundChannel})
		s.Require().Empty(channels)
		s.Require().NotNil(err)
		s.Require().EqualError(err, fmt.Sprintf("1 error occurred:\n\t* channel %s not found\n\n", notFoundChannel))
	})
	s.Run("bad request", func() {
		badRequestChannel := "badrequest"
		badRequestErr := errors.New("channel bad request")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), badRequestChannel).
			Return(nil, &model.Response{StatusCode: http.StatusBadRequest}, badRequestErr).
			Times(1)

		channels, err := getChannelsFromArgs(s.client, []string{badRequestChannel})
		s.Require().Empty(channels)
		s.Require().NotNil(err)
		s.Require().EqualError(err, fmt.Sprintf("1 error occurred:\n\t* channel %s not found\n\n", badRequestChannel))
	})
	s.Run("forbidden", func() {
		forbidden := "forbidden"
		forbiddenErr := errors.New("channel forbidden")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), forbidden).
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, forbiddenErr).
			Times(1)

		channels, err := getChannelsFromArgs(s.client, []string{forbidden})
		s.Require().Empty(channels)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "1 error occurred:\n\t* channel forbidden\n\n")
	})
	s.Run("internal server error", func() {
		errChannel := "internalServerError"
		internalServerErrorErr := errors.New("channel internalServerError")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), errChannel).
			Return(nil, &model.Response{StatusCode: http.StatusInternalServerError}, internalServerErrorErr).
			Times(1)

		channels, err := getChannelsFromArgs(s.client, []string{errChannel})
		s.Require().Empty(channels)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "1 error occurred:\n\t* channel internalServerError\n\n")
	})
	s.Run("success", func() {
		successID := "success"
		successChannel := &model.Channel{Id: successID}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), successID).
			Return(successChannel, nil, nil).
			Times(1)

		channels, summary := getChannelsFromArgs(s.client, []string{successID})
		s.Require().Nil(summary)
		s.Require().Len(channels, 1)
		s.Require().Equal(successChannel, channels[0])
	})

	s.Run("success with team on channel", func() {
		channelID := "success"
		teamID := "myTeamID"
		successTeam := &model.Team{Id: teamID}
		successChannel := &model.Channel{Id: channelID}

		s.client.
			EXPECT().
			GetTeam(context.TODO(), teamID, "").
			Return(successTeam, nil, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.TODO(), channelID, teamID, "").
			Return(successChannel, nil, nil).
			Times(1)

		channels, summary := getChannelsFromArgs(s.client, []string{fmt.Sprintf("%v:%v", teamID, channelID)})
		s.Require().Nil(summary)
		s.Require().Len(channels, 1)
		s.Require().Equal(successChannel, channels[0])
	})
}

func (s *MmctlUnitTestSuite) TestGetChannelFromArg_PrefersIdWhenChannelPartLooksLikeId() {
	resolvers := []struct {
		name string
		call func(arg string) (*model.Channel, error)
	}{
		{
			name: "getChannelFromChannelArg",
			call: func(arg string) (*model.Channel, error) {
				return getChannelFromChannelArg(s.client, arg), nil
			},
		},
		{
			name: "getChannelFromArg",
			call: func(arg string) (*model.Channel, error) {
				return getChannelFromArg(s.client, arg)
			},
		},
	}

	for _, resolver := range resolvers {
		s.Run(resolver.name+" returns the channel with the matching id", func() {
			teamID := model.NewId()
			channelID := model.NewId()
			team := &model.Team{Id: teamID}
			idChannel := &model.Channel{Id: channelID, Name: "town-square"}
			nameChannel := &model.Channel{Id: model.NewId(), Name: channelID}

			s.client.
				EXPECT().
				GetTeam(context.TODO(), teamID, "").
				Return(team, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), channelID, teamID, "").
				Return(nameChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannel(context.TODO(), channelID).
				Return(idChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()

			channel, err := resolver.call(fmt.Sprintf("%s:%s", teamID, channelID))
			s.Require().NoError(err)
			s.Require().NotNil(channel)
			s.Require().Equal(idChannel.Id, channel.Id)
		})

		s.Run(resolver.name+" returns the channel when looking up by id", func() {
			teamID := model.NewId()
			channelID := model.NewId()
			team := &model.Team{Id: teamID}
			idChannel := &model.Channel{Id: channelID, Name: "town-square"}
			notFoundErr := errors.New("channel not found")

			s.client.
				EXPECT().
				GetTeam(context.TODO(), teamID, "").
				Return(team, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), channelID, teamID, "").
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannel(context.TODO(), channelID).
				Return(idChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()

			channel, err := resolver.call(fmt.Sprintf("%s:%s", teamID, channelID))
			s.Require().NoError(err)
			s.Require().NotNil(channel)
			s.Require().Equal(idChannel.Id, channel.Id)
		})

		s.Run(resolver.name+" returns the channel when looking up by name", func() {
			teamID := model.NewId()
			channelName := "town-square"
			team := &model.Team{Id: teamID}
			namedChannel := &model.Channel{Id: model.NewId(), Name: channelName}

			s.client.
				EXPECT().
				GetTeam(context.TODO(), teamID, "").
				Return(team, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), channelName, teamID, "").
				Return(namedChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)

			channel, err := resolver.call(fmt.Sprintf("%s:%s", teamID, channelName))
			s.Require().NoError(err)
			s.Require().NotNil(channel)
			s.Require().Equal(namedChannel.Id, channel.Id)
		})

		s.Run(resolver.name+" returns the named channel when the channel part looks like an id and no channel has that id", func() {
			teamID := model.NewId()
			channelPart := model.NewId()
			team := &model.Team{Id: teamID}
			namedChannel := &model.Channel{Id: model.NewId(), Name: channelPart}
			notFoundErr := errors.New("channel not found")

			s.client.
				EXPECT().
				GetTeam(context.TODO(), teamID, "").
				Return(team, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetChannel(context.TODO(), channelPart).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), channelPart, teamID, "").
				Return(namedChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)

			channel, err := resolver.call(fmt.Sprintf("%s:%s", teamID, channelPart))
			s.Require().NoError(err)
			s.Require().NotNil(channel)
			s.Require().Equal(namedChannel.Id, channel.Id)
		})

		s.Run(resolver.name+" returns the channel with the matching id when the channel part differs only by letter case", func() {
			teamID := model.NewId()
			channelID := "a" + model.NewId()[1:]
			arg := strings.ToUpper(channelID)
			team := &model.Team{Id: teamID}
			idChannel := &model.Channel{Id: channelID, Name: "town-square"}
			nameChannel := &model.Channel{Id: model.NewId(), Name: channelID}
			notFoundErr := errors.New("channel not found")

			s.client.
				EXPECT().
				GetTeam(context.TODO(), teamID, "").
				Return(team, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetChannel(context.TODO(), arg).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannel(context.TODO(), channelID).
				Return(idChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), arg, teamID, "").
				Return(nameChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), channelID, teamID, "").
				Return(nameChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()

			channel, err := resolver.call(fmt.Sprintf("%s:%s", teamID, arg))
			s.Require().NoError(err)
			s.Require().NotNil(channel)
			s.Require().Equal(idChannel.Id, channel.Id)
		})

		s.Run(resolver.name+" returns the named channel when the channel part looks like an id except for letter case and no channel has that id", func() {
			teamID := model.NewId()
			channelID := "a" + model.NewId()[1:]
			arg := strings.ToUpper(channelID)
			team := &model.Team{Id: teamID}
			namedChannel := &model.Channel{Id: model.NewId(), Name: arg}
			notFoundErr := errors.New("channel not found")

			s.client.
				EXPECT().
				GetTeam(context.TODO(), teamID, "").
				Return(team, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetChannel(context.TODO(), arg).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannel(context.TODO(), channelID).
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), arg, teamID, "").
				Return(namedChannel, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetChannelByNameIncludeDeleted(context.TODO(), channelID, teamID, "").
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()

			channel, err := resolver.call(fmt.Sprintf("%s:%s", teamID, arg))
			s.Require().NoError(err)
			s.Require().NotNil(channel)
			s.Require().Equal(namedChannel.Id, channel.Id)
		})
	}
}
