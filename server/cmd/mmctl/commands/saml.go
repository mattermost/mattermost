// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

var SamlCmd = &cobra.Command{
	Use:   "saml",
	Short: "SAML related utilities",
}

var SamlAuthDataResetCmd = &cobra.Command{
	Use:   "auth-data-reset",
	Short: "Reset AuthData field to Email",
	Long:  "Resets the AuthData field for SAML users to their email. Run this utility after setting the 'id' SAML attribute to an empty value.",
	Example: `  # Reset all SAML users' AuthData field to their email, including deleted users
  $ mmctl saml auth-data-reset --include-deleted

  # Show how many users would be affected by the reset
  $ mmctl saml auth-data-reset --dry-run

  # Skip confirmation for resetting the AuthData
  $ mmctl saml auth-data-reset -y

  # Only reset the AuthData for the following SAML users
  $ mmctl saml auth-data-reset --users userid1,userid2`,
	RunE: withClient(samlAuthDataResetCmdF),
}

func init() {
	SamlAuthDataResetCmd.Flags().Bool("include-deleted", false, "Include deleted users")
	SamlAuthDataResetCmd.Flags().Bool("dry-run", false, "Dry run only")
	SamlAuthDataResetCmd.Flags().BoolP("yes", "y", false, "Skip confirmation")
	SamlAuthDataResetCmd.Flags().StringSlice("users", nil, "Comma-separated list of user IDs to which the operation will be applied")

	SamlCmd.AddCommand(
		SamlAuthDataResetCmd,
	)
	RootCmd.AddCommand(SamlCmd)
}

func samlAuthDataResetCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	includeDeleted, _ := cmd.Flags().GetBool("include-deleted")
	dryRun, _ := cmd.Flags().GetBool("dry-run")
	confirmed, _ := cmd.Flags().GetBool("yes")
	userIDs, _ := cmd.Flags().GetStringSlice("users")

	if !dryRun && !confirmed {
		if err := getConfirmation("This action is irreversible. Are you sure you want to continue?", false); err != nil {
			return err
		}
	}

	numAffected, _, err := c.ResetSamlAuthDataToEmail(context.TODO(), includeDeleted, dryRun, userIDs)
	if err != nil {
		return err
	}

	if dryRun {
		printer.Print(fmt.Sprintf("%d user records would be affected.\n", numAffected))
	} else {
		printer.Print(fmt.Sprintf("%d user records were changed.\n", numAffected))
	}

	return nil
}
