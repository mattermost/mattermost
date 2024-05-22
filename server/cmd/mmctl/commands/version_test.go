// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestVersionCmd() {
	printer.Clean()
	printer.SetFormat(printer.FormatPlain)

	err := versionCmdF(&cobra.Command{}, []string{})
	s.Require().NoError(err)
	s.Require().Len(printer.GetErrorLines(), 0)
	s.Require().Len(printer.GetLines(), 1)
	line := printer.GetLines()[0]
	s.Require().Contains(line, "mmctl:")
	s.Require().Contains(line, "Version:")
	s.Require().Contains(line, "BuiltDate:")
	s.Require().Contains(line, "CommitDate:")
	s.Require().Contains(line, "GitTreeState:")
	s.Require().Contains(line, "GoVersion:")
	s.Require().Contains(line, "	go1.")
	s.Require().Contains(line, "Compiler:")
	s.Require().Contains(line, "Platform:")
}
