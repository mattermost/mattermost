// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/server/public/model"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestSamlAuthDataReset() {
	s.Run("Reset auth data without confirmation returns an error", func() {
		cmd := &cobra.Command{}
		err := samlAuthDataResetCmdF(s.client, cmd, nil)
		s.Require().NotNil(err)
		s.Require().EqualError(err, "could not proceed, either enable --confirm flag or use an interactive shell to complete operation: this is not an interactive shell")
	})

	s.Run("Reset auth data without errors", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().Bool("yes", true, "")
		outputMessage := "1 user records were changed.\n"

		s.client.
			EXPECT().
			ResetSamlAuthDataToEmail(false, false, []string{}).
			Return(int64(1), &model.Response{}, nil).
			Times(1)

		err := samlAuthDataResetCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessage)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reset auth data dry run", func() {
		printer.Clean()
		outputMessage := "1 user records would be affected.\n"

		cmd := &cobra.Command{}
		cmd.Flags().Bool("dry-run", true, "")

		s.client.
			EXPECT().
			ResetSamlAuthDataToEmail(false, true, []string{}).
			Return(int64(1), &model.Response{}, nil).
			Times(1)

		err := samlAuthDataResetCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessage)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reset auth data with specified users", func() {
		printer.Clean()
		users := []string{"user1"}
		s.client.
			EXPECT().
			ResetSamlAuthDataToEmail(false, false, users).
			Return(int64(1), &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("yes", true, "")
		cmd.Flags().StringSlice("users", users, "")

		err := samlAuthDataResetCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}
