// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

)

func (s *MmctlUnitTestSuite) TestSampledataCmd() {
	s.Run("should fail because you have more team memberships than teams", func() {
		printer.Clean()

		s.cmd.Flags().Int("teams", 10, "")
		s.cmd.Flags().Int("team-memberships", 11, "")
		err := sampledataCmdF(s.client, s.cmd, []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "more team memberships than teams")
	})

	s.Run("should fail because you have more channel memberships than channels per team", func() {
		printer.Clean()

		s.cmd.Flags().Int("channels-per-team", 10, "")
		s.cmd.Flags().Int("channel-memberships", 11, "")
		err := sampledataCmdF(s.client, s.cmd, []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "more channel memberships than channels per team")
	})

	s.Run("should fail because you have group channels and don't have enough users (6 users)", func() {
		printer.Clean()

		s.cmd.Flags().Int("group-channels", 1, "")
		s.cmd.Flags().Int("users", 5, "")
		err := sampledataCmdF(s.client, s.cmd, []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "group channels generation with less than 6 users")
	})

	s.Run("should not fail with less than 6 users and no group channels", func() {
		printer.Clean()

		tmpFile, err := os.CreateTemp("", "mmctl-sampledata-test-")
		s.Require().NoError(err)
		tmpFile.Close()
		defer os.Remove(tmpFile.Name())

		s.cmd.Flags().String("bulk", tmpFile.Name(), "")
		s.cmd.Flags().Int("group-channels", 0, "")
		s.cmd.Flags().Int("users", 5, "")
		err = sampledataCmdF(s.client, s.cmd, []string{})
		s.Require().NoError(err)
	})
}
