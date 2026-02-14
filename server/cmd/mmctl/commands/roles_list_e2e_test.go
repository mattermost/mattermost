// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestRolesListCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("List all available roles", func(c client.Client) {
		printer.Clean()

		err := rolesListCmdF(c, &cobra.Command{}, []string{})
		s.Require().Nil(err)

		lines := printer.GetLines()
		s.Require().NotEmpty(lines, "Should return at least one role")

		// Verify all returned items are valid Role objects with names
		for i, line := range lines {
			role, ok := line.(*model.Role)
			s.Require().True(ok, "Line %d should be a *model.Role object", i)
			s.Require().NotEmpty(role.Name, "Role %d should have a non-empty name", i)
		}

		s.Len(printer.GetErrorLines(), 0, "Should not have any error output")
	})

	s.Run("List roles without permissions should fail", func() {
		printer.Clean()

		err := rolesListCmdF(s.th.Client, &cobra.Command{}, []string{})

		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to get roles")
	})
}
