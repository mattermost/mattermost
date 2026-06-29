// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestRolesListPlain() {
	s.Run("Prints all role names", func() {
		printer.Clean()

		roles := []*model.Role{
			{Id: "r1", Name: "system_admin"},
			{Id: "r2", Name: "system_user"},
		}

		s.client.
			EXPECT().
			GetAllRoles(context.TODO()).
			Return(roles, &model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := rolesListCmdF(s.client, nil, nil)
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().NotEmpty(lines)
	})
}

func (s *MmctlUnitTestSuite) TestRolesListJSON() {
	s.Run("prints JSON list of all role objects", func() {
		printer.Clean()

		roles := []*model.Role{
			{Id: "r1", Name: "system_admin"},
			{Id: "r2", Name: "system_user"},
		}

		s.client.
			EXPECT().
			GetAllRoles(context.TODO()).
			Return(roles, &model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		viper.Set("json", true)
		defer viper.Set("json", false)

		err := rolesListCmdF(s.client, nil, nil)
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().NotEmpty(lines)

		_, jerr := json.Marshal(lines)
		s.Require().NoError(jerr)
	})
}

func (s *MmctlUnitTestSuite) TestRolesListPermissionError() {
	s.Run("Test permission denied message for getting roles", func() {
		printer.Clean()

		forbiddenErr := fmt.Errorf("forbidden")
		s.client.
			EXPECT().
			GetAllRoles(context.TODO()).
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, forbiddenErr).
			Times(1)

		err := rolesListCmdF(s.client, nil, nil)

		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to get roles")
	})
}
