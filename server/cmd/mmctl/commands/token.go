// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"net/http"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var TokenCmd = &cobra.Command{
	Use:   "token",
	Short: "manage users' access tokens",
}

var GenerateUserTokenCmd = &cobra.Command{
	Use:     "generate [user] [description]",
	Short:   "Generate token for a user",
	Long:    "Generate token for a user",
	Example: "  generate testuser test-token",
	RunE:    withClient(generateTokenForAUserCmdF),
	Args:    cobra.ExactArgs(2),
}

var RevokeUserTokenCmd = &cobra.Command{
	Use:     "revoke [token-ids]",
	Short:   "Revoke tokens for a user",
	Long:    "Revoke tokens for a user",
	Example: "  revoke testuser test-token-id",
	RunE:    withClient(revokeTokenForAUserCmdF),
	Args:    cobra.MinimumNArgs(1),
}

var ListUserTokensCmd = &cobra.Command{
	Use:     "list [user]",
	Short:   "List users tokens",
	Long:    "List the tokens of a user",
	Example: "  user tokens testuser",
	RunE:    withClient(listTokensOfAUserCmdF),
	Args:    cobra.ExactArgs(1),
}

func init() {
	ListUserTokensCmd.Flags().Int("page", 0, "Page number to fetch for the list of users")
	ListUserTokensCmd.Flags().Int("per-page", 200, "Number of users to be fetched")
	ListUserTokensCmd.Flags().Bool("all", false, "Fetch all tokens. --page flag will be ignore if provided")
	ListUserTokensCmd.Flags().Bool("active", true, "List only active tokens")
	ListUserTokensCmd.Flags().Bool("inactive", false, "List only inactive tokens")

	TokenCmd.AddCommand(
		GenerateUserTokenCmd,
		RevokeUserTokenCmd,
		ListUserTokensCmd,
	)

	RootCmd.AddCommand(
		TokenCmd,
	)
}

func generateTokenForAUserCmdF(c client.Client, command *cobra.Command, args []string) error {
	userArg := args[0]
	user := getUserFromUserArg(c, userArg)
	if user == nil {
		return errors.Errorf("could not retrieve user information of %q", userArg)
	}

	token, _, err := c.CreateUserAccessToken(context.TODO(), user.Id, args[1])
	if err != nil {
		return errors.Errorf("could not create token for %q: %s", userArg, err.Error())
	}
	printer.PrintT("{{.Token}}: {{.Description}}", token)

	return nil
}

func listTokensOfAUserCmdF(c client.Client, command *cobra.Command, args []string) error {
	page, _ := command.Flags().GetInt("page")
	perPage, _ := command.Flags().GetInt("per-page")
	showAll, _ := command.Flags().GetBool("all")
	active, _ := command.Flags().GetBool("active")
	inactive, _ := command.Flags().GetBool("inactive")

	if showAll {
		page = 0
		perPage = 9999
	}

	userArg := args[0]

	user := getUserFromUserArg(c, userArg)
	if user == nil {
		return errors.Errorf("could not retrieve user information of %q", userArg)
	}

	tokens, _, err := c.GetUserAccessTokensForUser(context.TODO(), user.Id, page, perPage)
	if err != nil {
		return errors.Errorf("could not retrieve tokens for user %q: %s", userArg, err.Error())
	}

	if len(tokens) == 0 {
		return errors.Errorf("there are no tokens for the %q", userArg)
	}

	for _, t := range tokens {
		if t.IsActive && !inactive {
			printer.PrintT("{{.Id}}: {{.Description}}", t)
		}
		if !t.IsActive && !active {
			printer.PrintT("{{.Id}}: {{.Description}}", t)
		}
	}
	return nil
}

func revokeTokenForAUserCmdF(c client.Client, command *cobra.Command, args []string) error {
	for _, id := range args {
		res, err := c.RevokeUserAccessToken(context.TODO(), id)
		if err != nil {
			return errors.Errorf("could not revoke token %q: %s", id, err.Error())
		}
		if res.StatusCode != http.StatusOK {
			return errors.Errorf("could not revoke token %q", id)
		}
	}
	return nil
}
