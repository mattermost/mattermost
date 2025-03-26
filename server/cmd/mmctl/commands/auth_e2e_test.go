// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestAuthLoginWithTrailingSlashInInstanceURL() {
	s.SetupTestHelper().InitBasic()

	s.Run("URL with trailing slash", func() {
		// loginCmdf doesn't return an error in this case. It prints to stderr instead.
		printer.Clean()

		// cobra wont let us run a subcommand directly. When we try to `Execute`
		// the subcommand, cobra executes the parent command.
		// Instead of calling RootCmd, with its various subcommands and options,
		// we duplicate part of the the LoginCmd here.
		cmd := &cobra.Command{}
		cmd.Flags().StringP("name", "n", "name", "Name for the credentials")
		cmd.Flags().StringP("username", "u", s.th.BasicUser.Username, "Username for the credentials")
		cmd.Flags().StringP("password", "p", s.th.BasicUser.Password, "Password for the credentials")
		cmd.Flags().StringP("access-token", "a", "", "Access token to use instead of username/password")
		cmd.Flags().StringP("mfa-token", "m", "", "MFA token for the credentials")
		cmd.Flags().Bool("no-activate", false, "If present, it won't activate the credentials after login")

		_ = loginCmdF(cmd, []string{s.th.Client.URL + "/"}) // add a trailing slash
		errLines := printer.GetErrorLines()
		s.Require().Lenf(errLines, 0, "expected no error, got %q", errLines)
	})
}
