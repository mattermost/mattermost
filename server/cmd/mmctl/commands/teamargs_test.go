// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

func (s *MmctlUnitTestSuite) TestGetTeamArgs() {
	s.Run("team not found", func() {
		notFoundTeam := "notfoundteam"
		notFoundErr := errors.New("team not found")

		s.client.
			EXPECT().
			GetTeam(context.Background(), notFoundTeam, "").
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.Background(), notFoundTeam, "").
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
			Times(1)

		teams, err := getTeamsFromArgs(s.client, []string{notFoundTeam})
		s.Require().Empty(teams)
		s.Require().NotNil(err)
		s.Require().EqualError(err, fmt.Sprintf("1 error occurred:\n\t* team %s not found\n\n", notFoundTeam))
	})
	s.Run("bad request", func() {
		badRequestTeam := "badrequest"
		badRequestErr := errors.New("team bad request")

		s.client.
			EXPECT().
			GetTeam(context.Background(), badRequestTeam, "").
			Return(nil, &model.Response{StatusCode: http.StatusBadRequest}, badRequestErr).
			Times(1)
		s.client.
			EXPECT().
			GetTeamByName(context.Background(), badRequestTeam, "").
			Return(nil, &model.Response{StatusCode: http.StatusBadRequest}, badRequestErr).
			Times(1)

		teams, err := getTeamsFromArgs(s.client, []string{badRequestTeam})
		s.Require().Empty(teams)
		s.Require().NotNil(err)
		s.Require().EqualError(err, fmt.Sprintf("1 error occurred:\n\t* team %s not found\n\n", badRequestTeam))
	})
	s.Run("forbidden", func() {
		forbidden := "forbidden"
		forbiddenErr := errors.New("team forbidden")

		s.client.
			EXPECT().
			GetTeam(context.Background(), forbidden, "").
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, forbiddenErr).
			Times(1)

		teams, err := getTeamsFromArgs(s.client, []string{forbidden})
		s.Require().Empty(teams)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "1 error occurred:\n\t* team forbidden\n\n")
	})
	s.Run("internal server error", func() {
		errTeam := "internalServerError"
		internalServerErrorErr := errors.New("team internalServerError")

		s.client.
			EXPECT().
			GetTeam(context.Background(), errTeam, "").
			Return(nil, &model.Response{StatusCode: http.StatusInternalServerError}, internalServerErrorErr).
			Times(1)

		teams, err := getTeamsFromArgs(s.client, []string{errTeam})
		s.Require().Empty(teams)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "1 error occurred:\n\t* team internalServerError\n\n")
	})
	s.Run("success", func() {
		successID := "success@success.com"
		successTeam := &model.Team{Id: successID}

		s.client.
			EXPECT().
			GetTeam(context.Background(), successID, "").
			Return(successTeam, nil, nil).
			Times(1)

		teams, summary := getTeamsFromArgs(s.client, []string{successID})
		s.Require().Nil(summary)
		s.Require().Len(teams, 1)
		s.Require().Equal(successTeam, teams[0])
	})
}
