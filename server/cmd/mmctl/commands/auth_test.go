// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"os/user"
	"path/filepath"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func (s *MmctlUnitTestSuite) TestAuthList() {
	originalUser := *currentUser
	defer func() {
		SetUser(&originalUser)
	}()

	tmp, errMkDir := os.MkdirTemp("", "mmctl-")
	s.Require().NoError(errMkDir)
	s.T().Cleanup(func() {
		s.Require().NoError(os.RemoveAll(tmp))
	})

	testUser, err := user.Current()
	s.Require().NoError(err)
	testUser.HomeDir = tmp
	SetUser(testUser)
	viper.Set("config", filepath.Join(xdgConfigHomeVar, configParent, configFileName))

	s.Run("short name", func() {
		printer.Clean()

		credentials := Credentials{
			Name:        "MyN",
			Username:    "Un",
			AuthToken:   "",
			AuthMethod:  "",
			InstanceURL: "IURL",
			Active:      true,
		}

		err = CleanCredentials()
		s.Require().NoError(err)
		err = SaveCredentials(credentials)
		s.Require().NoError(err)

		errListCmdF := listCmdF(&cobra.Command{}, []string{})
		s.Require().NoError(errListCmdF)
		s.Require().Len(printer.GetErrorLines(), 0)
		lines := printer.GetLines()
		s.Require().Len(lines, 4)
		s.Require().Contains(lines[2], "|      * |  MyN |       Un |        IURL |")
		s.Require().Contains(lines[1], "|--------|------|----------|-------------|")
		s.Require().Contains(lines[0], "| Active | Name | Username | InstanceURL |")
	})

	s.Run("normal name", func() {
		printer.Clean()

		credentials := Credentials{
			Name:        "MyName",
			Username:    "MyUsername",
			AuthToken:   "",
			AuthMethod:  "",
			InstanceURL: "My Instance URL",
			Active:      true,
		}

		err = CleanCredentials()
		s.Require().NoError(err)
		err = SaveCredentials(credentials)
		s.Require().NoError(err)

		errListCmdF := listCmdF(&cobra.Command{}, []string{})
		s.Require().NoError(errListCmdF)
		s.Require().Len(printer.GetErrorLines(), 0)
		lines := printer.GetLines()
		s.Require().Len(lines, 4)
		s.Require().Contains(lines[2], "|      * | MyName | MyUsername | My Instance URL |")
		s.Require().Contains(lines[1], "|--------|--------|------------|-----------------|")
		s.Require().Contains(lines[0], "| Active |   Name |   Username |     InstanceURL |")
	})
}
