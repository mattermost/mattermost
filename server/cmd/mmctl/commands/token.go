// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
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
	Use:   "generate [user] [description]",
	Short: "Generate token for a user",
	Long: "Generate token for a user. Use --expires-in to set an expiry, which may be required by " +
		"the server's MaximumPersonalAccessTokenLifetimeDays setting.",
	Example: `  generate testuser test-token
  generate testuser ci-token --expires-in 90d
  generate testuser short-lived --expires-in 12h`,
	RunE: withClient(generateTokenForAUserCmdF),
	Args: cobra.ExactArgs(2),
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
	GenerateUserTokenCmd.Flags().String("expires-in", "", "Duration after which the token expires (e.g. 90d, 12h, 30m). Accepts the standard Go duration syntax plus a 'd' (days) suffix. If empty, the token does not expire.")

	ListUserTokensCmd.Flags().Int("page", 0, "Page number to fetch for the list of users")
	ListUserTokensCmd.Flags().Int("per-page", DefaultPageSize, "Number of users to be fetched")
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
	expiresAt, err := resolveTokenExpiry(command)
	if err != nil {
		return err
	}

	userArg := args[0]
	user := getUserFromUserArg(c, userArg)
	if user == nil {
		return errors.Errorf("could not retrieve user information of %q", userArg)
	}

	token, _, err := c.CreateUserAccessToken(context.TODO(), user.Id, args[1], expiresAt)
	if err != nil {
		return errors.Errorf("could not create token for %q: %s", userArg, err.Error())
	}
	printer.PrintT("{{.Token}}: {{.Description}}", token)

	return nil
}

// resolveTokenExpiry converts the --expires-in flag into a Unix-millis timestamp
// suitable for UserAccessToken.ExpiresAt. Returns 0 when the flag is empty,
// meaning the token does not expire (subject to server policy).
func resolveTokenExpiry(command *cobra.Command) (int64, error) {
	raw, _ := command.Flags().GetString("expires-in")
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	d, err := parseExpiresIn(raw)
	if err != nil {
		return 0, errors.Wrap(err, "invalid --expires-in value")
	}
	if d <= 0 {
		return 0, errors.Errorf("--expires-in must be positive, got %q", raw)
	}
	return time.Now().Add(d).UnixMilli(), nil
}

// parseExpiresIn accepts a duration string. In addition to the standard Go
// duration syntax (e.g. "12h", "30m"), a trailing "d" is interpreted as days
// — the common case for token lifetimes which stdlib's time.ParseDuration
// does not support.
func parseExpiresIn(s string) (time.Duration, error) {
	if prefix, ok := strings.CutSuffix(s, "d"); ok {
		days, err := strconv.Atoi(prefix)
		if err != nil {
			return 0, errors.Errorf("%q is not a valid day count", s)
		}
		// time.Duration is int64 nanoseconds; days * 24h overflows past ~106751.
		// Cap at the server-side bound so the CLI rejects values that the server
		// would reject anyway, well below the int64-overflow point.
		if days > model.MaxPersonalAccessTokenLifetimeDays {
			return 0, errors.Errorf("%q exceeds maximum supported day count of %d", s, model.MaxPersonalAccessTokenLifetimeDays)
		}
		return time.Duration(days) * 24 * time.Hour, nil
	}
	return time.ParseDuration(s)
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
