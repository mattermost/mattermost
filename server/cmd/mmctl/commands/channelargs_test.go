// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func (s *MmctlUnitTestSuite) TestGetChannelArgs() {
	s.Run("channel not found", func() {
		notFoundChannel := "notfoundchannel"
		notFoundErr := errors.New("channel not found")

		s.client.
			EXPECT().
			GetChannel(context.Background(), notFoundChannel, "").
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
			GetChannel(context.Background(), badRequestChannel, "").
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
			GetChannel(context.Background(), forbidden, "").
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
			GetChannel(context.Background(), errChannel, "").
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
			GetChannel(context.Background(), successID, "").
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
			GetTeam(context.Background(), teamID, "").
			Return(successTeam, nil, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByNameIncludeDeleted(context.Background(), channelID, teamID, "").
			Return(successChannel, nil, nil).
			Times(1)

		channels, summary := getChannelsFromArgs(s.client, []string{fmt.Sprintf("%v:%v", teamID, channelID)})
		s.Require().Nil(summary)
		s.Require().Len(channels, 1)
		s.Require().Equal(successChannel, channels[0])
	})
}
