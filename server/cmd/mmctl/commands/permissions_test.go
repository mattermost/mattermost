// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"net/http"

	gomock "github.com/golang/mock/gomock"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestAddPermissionsCmd() {
	s.Run("Adding a new permission to an existing role", func() {
		mockRole := &model.Role{
			Id:          "mock-id",
			Name:        "mock-role",
			Permissions: []string{"view", "edit"},
		}
		newPermission := "delete"

		expectedPermissions := mockRole.Permissions
		expectedPermissions = append(expectedPermissions, newPermission)
		expectedPatch := &model.RolePatch{
			Permissions: &expectedPermissions,
		}

		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(mockRole, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchRole(context.TODO(), mockRole.Id, expectedPatch).
			Return(&model.Role{}, &model.Response{}, nil).
			Times(1)

		args := []string{mockRole.Name, newPermission}
		err := addPermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
	})

	s.Run("Trying to add a new permission to a non existing role", func() {
		expectedError := errors.New("role_not_found")

		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, expectedError).
			Times(1)

		args := []string{"mockRole", "newPermission"}
		err := addPermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().Equal(expectedError, err)
	})

	s.Run("Adding a new sysconsole_* permission to a role", func() {
		mockRole := &model.Role{
			Id:          "mock-id",
			Name:        "mock-role",
			Permissions: []string{},
		}
		newPermission := "sysconsole_read_user_management_channels"

		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(mockRole, &model.Response{}, nil).
			Times(1)

		s.Run("with ancillary permissions", func() {
			expectedPermissions := mockRole.Permissions
			expectedPermissions = append(expectedPermissions, []string{newPermission, "read_public_channel", "read_channel", "read_public_channel_groups", "read_private_channel_groups"}...)
			expectedPatch := &model.RolePatch{
				Permissions: &expectedPermissions,
			}
			s.client.
				EXPECT().
				PatchRole(context.TODO(), mockRole.Id, expectedPatch).
				Return(&model.Role{}, &model.Response{}, nil).
				Times(1)
			args := []string{mockRole.Name, newPermission}
			cmd := &cobra.Command{}
			err := addPermissionsCmdF(s.client, cmd, args)
			s.Require().Nil(err)
		})
	})
}

func (s *MmctlUnitTestSuite) TestRemovePermissionsCmd() {
	s.Run("Removing a permission from an existing role", func() {
		mockRole := &model.Role{
			Id:          "mock-id",
			Name:        "mock-role",
			Permissions: []string{"view", "edit", "delete"},
		}

		expectedPatch := &model.RolePatch{
			Permissions: &[]string{"view", "edit"},
		}
		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(mockRole, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchRole(context.TODO(), mockRole.Id, expectedPatch).
			Return(&model.Role{}, &model.Response{}, nil).
			Times(1)

		args := []string{mockRole.Name, "delete"}
		err := removePermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
	})

	s.Run("Removing multiple permissions from an existing role", func() {
		mockRole := &model.Role{
			Id:          "mock-id",
			Name:        "mock-role",
			Permissions: []string{"view", "edit", "delete"},
		}

		expectedPatch := &model.RolePatch{
			Permissions: &[]string{"edit"},
		}
		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(mockRole, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchRole(context.TODO(), mockRole.Id, expectedPatch).
			Return(&model.Role{}, &model.Response{}, nil).
			Times(1)

		args := []string{mockRole.Name, "view", "delete"}
		err := removePermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
	})

	s.Run("Removing a non-existing permission from an existing role", func() {
		mockRole := &model.Role{
			Id:          "mock-id",
			Name:        "mock-role",
			Permissions: []string{"view", "edit"},
		}

		expectedPatch := &model.RolePatch{
			Permissions: &[]string{"view", "edit"},
		}
		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(mockRole, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			PatchRole(context.TODO(), mockRole.Id, expectedPatch).
			Return(&model.Role{}, &model.Response{}, nil).
			Times(1)

		args := []string{mockRole.Name, "delete"}
		err := removePermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
	})

	s.Run("Removing a permission from a non-existing role", func() {
		mockRole := model.Role{
			Name: "exampleName",
		}

		mockError := errors.New("role_not_found")
		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, mockError).
			Times(1)

		args := []string{mockRole.Name, "delete"}
		err := removePermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().EqualError(err, "role_not_found")
	})
}

func (s *MmctlUnitTestSuite) TestResetPermissionsCmd() {
	s.Run("A non-existent role", func() {
		mockRole := model.Role{
			Name: "exampleName",
		}

		mockError := errors.New("role_not_found")

		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, mockError).
			Times(1)

		args := []string{mockRole.Name}
		err := resetPermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().EqualError(err, "role_not_found")
	})

	s.Run("A role without default permissions", func() {
		mockRole := model.Role{
			Id:          "mock-id",
			Name:        "mock-role",
			Permissions: []string{"view", "edit", "delete"},
		}

		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(&mockRole, &model.Response{}, nil).
			Times(1)

		args := []string{mockRole.Name}
		err := resetPermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().EqualError(err, "no default permissions available for role")
	})

	s.Run("Resets the permissions", func() {
		mockRole := model.Role{
			Id:          "mock-id",
			Name:        "channel_admin",
			Permissions: []string{"view_foos", "delete_bars"},
		}

		expectedPermissions := []string{
			"manage_channel_roles",
			"use_group_mentions",
			"add_bookmark_public_channel",
			"edit_bookmark_public_channel",
			"delete_bookmark_public_channel",
			"order_bookmark_public_channel",
			"add_bookmark_private_channel",
			"edit_bookmark_private_channel",
			"delete_bookmark_private_channel",
			"order_bookmark_private_channel",
		}
		expectedPatch := &model.RolePatch{
			Permissions: &expectedPermissions,
		}

		s.client.
			EXPECT().
			GetRoleByName(context.TODO(), mockRole.Name).
			Return(&mockRole, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchRole(context.TODO(), mockRole.Id, expectedPatch).
			Return(&model.Role{}, &model.Response{}, nil).
			Times(1)

		args := []string{mockRole.Name}
		err := resetPermissionsCmdF(s.client, &cobra.Command{}, args)
		s.Require().Nil(err)
	})
}
