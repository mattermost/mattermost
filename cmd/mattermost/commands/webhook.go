// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var WebhookCmd = &cobra.Command{
	Use:   "webhook",
	Short: "Management of webhooks",
}

var WebhookListCmd = &cobra.Command{
	Use:     "list",
	Short:   "List webhooks",
	Long:    "list all webhooks",
	Example: "  webhook list myteam",
	RunE:    listWebhookCmdF,
}

func listWebhookCmdF(command *cobra.Command, args []string) error {
	app, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer app.Shutdown()

	var teams []*model.Team
	if len(args) < 1 {
		var getErr *model.AppError
		// If no team is specified, list all teams
		teams, getErr = app.GetAllTeams()
		if getErr != nil {
			return getErr
		}
	} else {
		teams = getTeamsFromTeamArgs(app, args)
	}

	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}

		// Fetch all hooks with a very large limit so we get them all.
		incomingResult := app.Srv.Store.Webhook().GetIncomingByTeam(team.Id, 0, 100000000)
		outgoingResult := app.Srv.Store.Webhook().GetOutgoingByTeam(team.Id, 0, 100000000)

		if result := <-incomingResult; result.Err == nil {
			CommandPrettyPrintln(fmt.Sprintf("Incoming webhooks for %s (%s):", team.DisplayName, team.Name))
			hooks := result.Data.([]*model.IncomingWebhook)
			for _, hook := range hooks {
				CommandPrettyPrintln("\t" + hook.DisplayName + " (" + hook.Id + ")")
			}
		} else {
			CommandPrintErrorln("Unable to list incoming webhooks for '" + args[i] + "'")
		}

		if result := <-outgoingResult; result.Err == nil {
			hooks := result.Data.([]*model.OutgoingWebhook)
			CommandPrettyPrintln(fmt.Sprintf("Outgoing webhooks for %s (%s):", team.DisplayName, team.Name))
			for _, hook := range hooks {
				CommandPrettyPrintln("\t" + hook.DisplayName + " (" + hook.Id + ")")
			}
		} else {
			CommandPrintErrorln("Unable to list outgoing webhooks for '" + args[i] + "'")
		}
	}
	return nil
}

func init() {
	WebhookCmd.AddCommand(
		WebhookListCmd,
	)

	RootCmd.AddCommand(WebhookCmd)
}
