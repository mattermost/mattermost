// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package commands

import (
	"context"
	"fmt"
	"net/http"
	"strings"

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

func (s *MmctlUnitTestSuite) TestGetUserFromArg_PrefersIdWhenArgLooksLikeId() {
	resolvers := []struct {
		name string
		call func(arg string) (*model.User, error)
	}{
		{
			name: "getUserFromUserArg",
			call: func(arg string) (*model.User, error) {
				return getUserFromUserArg(s.client, arg), nil
			},
		},
		{
			name: "getUserFromArg",
			call: func(arg string) (*model.User, error) {
				return getUserFromArg(s.client, arg)
			},
		},
	}

	for _, resolver := range resolvers {
		s.Run(resolver.name+" returns the user with the matching id", func() {
			targetID := model.NewId()
			idUser := &model.User{Id: targetID, Username: "iduser"}
			usernameUser := &model.User{Id: model.NewId(), Username: targetID}

			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), targetID, "").
				Return(usernameUser, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()
			s.client.
				EXPECT().
				GetUser(context.TODO(), targetID, "").
				Return(idUser, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()

			user, err := resolver.call(targetID)
			s.Require().NoError(err)
			s.Require().NotNil(user)
			s.Require().Equal(idUser.Id, user.Id)
		})

		s.Run(resolver.name+" returns the user when looking up by id", func() {
			targetID := model.NewId()
			idUser := &model.User{Id: targetID, Username: "iduser"}
			notFoundErr := errors.New("user not found")

			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), targetID, "").
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetUser(context.TODO(), targetID, "").
				Return(idUser, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()

			user, err := resolver.call(targetID)
			s.Require().NoError(err)
			s.Require().NotNil(user)
			s.Require().Equal(idUser.Id, user.Id)
		})

		s.Run(resolver.name+" returns the user when looking up by username", func() {
			namedUser := &model.User{Id: model.NewId(), Username: "named-user"}

			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), namedUser.Username, "").
				Return(namedUser, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)

			user, err := resolver.call(namedUser.Username)
			s.Require().NoError(err)
			s.Require().NotNil(user)
			s.Require().Equal(namedUser.Id, user.Id)
		})

		s.Run(resolver.name+" returns the user when looking up by email", func() {
			emailUser := &model.User{Id: model.NewId(), Email: "success@success.com"}

			s.client.
				EXPECT().
				GetUserByEmail(context.TODO(), emailUser.Email, "").
				Return(emailUser, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)

			user, err := resolver.call(emailUser.Email)
			s.Require().NoError(err)
			s.Require().NotNil(user)
			s.Require().Equal(emailUser.Id, user.Id)
		})

		s.Run(resolver.name+" returns the user with the matching id when the arg differs only by letter case", func() {
			targetID := "a" + model.NewId()[1:]
			arg := strings.ToUpper(targetID)
			idUser := &model.User{Id: targetID, Username: "iduser"}
			usernameUser := &model.User{Id: model.NewId(), Username: targetID}
			notFoundErr := errors.New("user not found")

			s.client.
				EXPECT().
				GetUser(context.TODO(), arg, "").
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetUser(context.TODO(), targetID, "").
				Return(idUser, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()
			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), arg, "").
				Return(usernameUser, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()
			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), targetID, "").
				Return(usernameUser, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()

			user, err := resolver.call(arg)
			s.Require().NoError(err)
			s.Require().NotNil(user)
			s.Require().Equal(idUser.Id, user.Id)
		})

		s.Run(resolver.name+" returns the user when the arg looks like an id and no user has that id", func() {
			targetID := model.NewId()
			namedUser := &model.User{Id: model.NewId(), Username: targetID}
			notFoundErr := errors.New("user not found")

			s.client.
				EXPECT().
				GetUser(context.TODO(), targetID, "").
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), targetID, "").
				Return(namedUser, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)

			user, err := resolver.call(targetID)
			s.Require().NoError(err)
			s.Require().NotNil(user)
			s.Require().Equal(namedUser.Id, user.Id)
		})

		s.Run(resolver.name+" returns the user when the arg looks like an id except for letter case and no user has that id", func() {
			targetID := "a" + model.NewId()[1:]
			arg := strings.ToUpper(targetID)
			namedUser := &model.User{Id: model.NewId(), Username: targetID}
			notFoundErr := errors.New("user not found")

			s.client.
				EXPECT().
				GetUser(context.TODO(), arg, "").
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetUser(context.TODO(), targetID, "").
				Return(nil, &model.Response{StatusCode: http.StatusNotFound}, notFoundErr).
				AnyTimes()
			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), arg, "").
				Return(namedUser, &model.Response{StatusCode: http.StatusOK}, nil).
				Times(1)
			s.client.
				EXPECT().
				GetUserByUsername(context.TODO(), targetID, "").
				Return(namedUser, &model.Response{StatusCode: http.StatusOK}, nil).
				AnyTimes()

			user, err := resolver.call(arg)
			s.Require().NoError(err)
			s.Require().NotNil(user)
			s.Require().Equal(namedUser.Id, user.Id)
		})
	}
}
