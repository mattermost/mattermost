// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"

	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestlogsCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("Display single log line", func(c client.Client) {
		cmd := &cobra.Command{}
		cmd.Flags().Int("number", 1, "")

		data, err := testLogsCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Len(data, 2)
	})

	s.RunForSystemAdminAndLocal("Display in logrus for formatting", func(c client.Client) {
		cmd := &cobra.Command{}
		cmd.Flags().Bool("logrus", true, "")
		cmd.Flags().Int("number", 1, "")

		data, err := testLogsCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Len(data, 2)
		s.Contains(data[1], "time=")
		s.Contains(data[1], "level=")
		s.Contains(data[1], "msg=")
	})

	s.Run("Should not allow normal user to retrieve logs", func() {
		cmd := &cobra.Command{}
		cmd.Flags().Int("number", 1, "")

		_, err := testLogsCmdF(s.th.Client, cmd, []string{})
		s.Require().Error(err)
	})
}
