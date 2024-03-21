// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestGetUserFromArgs() {
	s.Run("user not found", func() {
		notFoundEmail := "emailNotfound@notfound.com"
		notFoundErr := errors.New("user not found")
		printer.Clean()
		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), notFoundEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
			Times(1)
		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), notFoundEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
			Times(1)
		s.client.
			EXPECT().
			GetUser(context.TODO(), notFoundEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
			Times(1)

		users, err := getUsersFromArgs(s.client, []string{notFoundEmail})
		s.Require().Empty(users)
		s.Require().NotNil(err)
		s.Require().EqualError(err, fmt.Sprintf("1 error occurred:\n\t* user %s not found\n\n", notFoundEmail))
	})

	s.Run("bad request don't throw unexpected error", func() {
		badRequestEmail := "emailbadrequest@badrequest.com"
		badRequestErr := errors.New("bad request")
		printer.Clean()
		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), badRequestEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusBadRequest}, badRequestErr).
			Times(1)
		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), badRequestEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusBadRequest}, badRequestErr).
			Times(1)
		s.client.
			EXPECT().
			GetUser(context.TODO(), badRequestEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusBadRequest}, badRequestErr).
			Times(1)

		users, err := getUsersFromArgs(s.client, []string{badRequestEmail})
		s.Require().Empty(users)
		s.Require().NotNil(err)
		s.Require().EqualError(err, fmt.Sprintf("1 error occurred:\n\t* user %s not found\n\n", badRequestEmail))
	})

	s.Run("unexpected error throws according error", func() {
		unexpectedErrEmail := "emailunexpected@unexpected.com"
		unexpectedErr := errors.New("internal server error")
		printer.Clean()
		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), unexpectedErrEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusInternalServerError}, unexpectedErr).
			Times(1)
		users, err := getUsersFromArgs(s.client, []string{unexpectedErrEmail})
		s.Require().Empty(users)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "1 error occurred:\n\t* internal server error\n\n")
	})
	s.Run("forbidden error stops searching", func() {
		forbiddenErrEmail := "forbidden@forbidden.com"
		forbiddenErr := errors.New("forbidden")
		printer.Clean()
		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), forbiddenErrEmail, "").
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, forbiddenErr).
			Times(1)
		users, err := getUsersFromArgs(s.client, []string{forbiddenErrEmail})
		s.Require().Empty(users)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "1 error occurred:\n\t* forbidden\n\n")
	})
	s.Run("success", func() {
		successEmail := "success@success.com"
		successUser := &model.User{Email: successEmail}
		printer.Clean()
		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), successEmail, "").
			Return(successUser, nil, nil).
			Times(1)
		users, err := getUsersFromArgs(s.client, []string{successEmail})
		s.Require().NoError(err)
		s.Require().Len(users, 1)
		s.Require().Equal(successUser, users[0])
	})
}
