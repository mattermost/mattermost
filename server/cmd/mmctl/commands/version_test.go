// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestVersionCmd() {
	s.Run("TODO", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := versionCmdF(&cobra.Command{}, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		line := printer.GetLines()[0]
		s.Require().Contains("mmctl:", line)
		s.Require().Contains("Version:", line)
		s.Require().Contains("BuiltDate:", line)
		s.Require().Contains("CommitDate:", line)
		s.Require().Contains("GitTreeState:", line)
		s.Require().Contains("GoVersion:", line)
		s.Require().Contains("	go1.", line)
		s.Require().Contains("Compiler:", line)
		s.Require().Contains("Platform:", line)
	})
}
