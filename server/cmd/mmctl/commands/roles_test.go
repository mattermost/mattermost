// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestMakeAdminCmd() {
	s.Run("Add admin privileges to user", func() {
		printer.Clean()

		mockUser := &model.User{Id: "1", Email: "u1@example.com", Roles: "system_user"}
		newRoles := "system_user system_admin"

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockUser.Email, "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateUserRoles(context.Background(), mockUser.Id, newRoles).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := rolesSystemAdminCmdF(s.client, &cobra.Command{}, []string{mockUser.Email})
		s.Require().Nil(err)

		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(fmt.Sprintf("System admin role assigned to user %q. Current roles are: %s", mockUser.Email, "system_user, system_admin"), printer.GetLines()[0])
	})

	s.Run("Adding admin privileges to existing admin", func() {
		printer.Clean()

		roles := "system_user system_admin"
		mockUser := &model.User{Id: "1", Email: "u1@example.com", Roles: roles}

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockUser.Email, "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		err := rolesSystemAdminCmdF(s.client, &cobra.Command{}, []string{mockUser.Email})
		s.Require().Nil(err)

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Add admin to non existing user", func() {
		printer.Clean()

		emailArg := "doesnotexist@example.com"

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), emailArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.Background(), emailArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.Background(), emailArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := rolesSystemAdminCmdF(s.client, &cobra.Command{}, []string{emailArg})
		s.Require().ErrorContains(err, "unable to find user")

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to find user %q", emailArg), printer.GetErrorLines()[0])
	})

	s.Run("Error while updating admin role", func() {
		printer.Clean()

		mockUser := &model.User{Id: "1", Email: "u1@example.com", Roles: "system_user"}
		newRoles := "system_user system_admin"

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockUser.Email, "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateUserRoles(context.Background(), mockUser.Id, newRoles).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("mock error")).
			Times(1)

		err := rolesSystemAdminCmdF(s.client, &cobra.Command{}, []string{mockUser.Email})
		s.Require().ErrorContains(err, "can't update roles for user")

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("can't update roles for user %q", mockUser.Email))
	})
}

func (s *MmctlUnitTestSuite) TestMakeMemberCmd() {
	s.Run("Remove admin privileges for admin", func() {
		printer.Clean()

		mockUser := &model.User{Id: "1", Email: "u1@example.com", Roles: "system_user system_admin"}

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockUser.Email, "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateUserRoles(context.Background(), mockUser.Id, "system_user").
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := rolesMemberCmdF(s.client, &cobra.Command{}, []string{mockUser.Email})
		s.Require().Nil(err)

		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(fmt.Sprintf("System admin role revoked for user %q. Current roles are: %s", mockUser.Email, "system_user"), printer.GetLines()[0])
	})

	s.Run("Remove admin privileges from non admin user", func() {
		printer.Clean()

		mockUser := &model.User{Id: "1", Email: "u1@example.com", Roles: "system_user"}

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockUser.Email, "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		err := rolesMemberCmdF(s.client, &cobra.Command{}, []string{mockUser.Email})
		s.Require().Nil(err)

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Error while revoking admin role", func() {
		printer.Clean()

		mockUser := &model.User{Id: "1", Email: "u1@example.com", Roles: "system_user system_admin"}

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), mockUser.Email, "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			UpdateUserRoles(context.Background(), mockUser.Id, "system_user").
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("mock error")).
			Times(1)

		err := rolesMemberCmdF(s.client, &cobra.Command{}, []string{mockUser.Email})
		s.Require().ErrorContains(err, "can't update roles for user")

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("can't update roles for user %q", mockUser.Email))
	})

	s.Run("Remove admin from non existing user", func() {
		printer.Clean()

		emailArg := "doesnotexist@example.com"

		s.client.
			EXPECT().
			GetUserByEmail(context.Background(), emailArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.Background(), emailArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.Background(), emailArg, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		err := rolesMemberCmdF(s.client, &cobra.Command{}, []string{emailArg})
		s.Require().ErrorContains(err, "unable to find user")

		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(fmt.Sprintf("unable to find user %q", emailArg), printer.GetErrorLines()[0])
	})
}
