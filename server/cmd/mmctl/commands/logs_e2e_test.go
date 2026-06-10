// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"

)

func (s *MmctlE2ETestSuite) TestlogsCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("Display single log line", func(c client.Client) {
		s.cmd.Flags().Int("number", 1, "")

		data, err := testLogsCmdF(c, s.cmd, []string{})
		s.Require().Nil(err)
		s.Require().Len(data, 2)
	})

	s.RunForSystemAdminAndLocal("Display in logrus for formatting", func(c client.Client) {
		s.cmd.Flags().Bool("logrus", true, "")
		s.cmd.Flags().Int("number", 1, "")

		data, err := testLogsCmdF(c, s.cmd, []string{})
		s.Require().Nil(err)
		s.Require().Len(data, 2)
		s.Contains(data[1], "time=")
		s.Contains(data[1], "level=")
		s.Contains(data[1], "msg=")
	})

	s.Run("Should not allow normal user to retrieve logs", func() {
		s.cmd.Flags().Int("number", 1, "")

		_, err := testLogsCmdF(s.th.Client, s.cmd, []string{})
		s.Require().Error(err)
	})
}
