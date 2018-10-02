// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
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
		// If no team is specified, list all teams
		teams, err = app.GetAllTeams()
		if err != nil {
			return err
		}
	} else {
		teams = getTeamsFromTeamArgs(app, args)
	}

	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}

		incomingResult := app.Srv.Store.Webhook().GetIncomingByTeam(team.Id, -1, -1)
		outgoingResult := app.Srv.Store.Webhook().GetOutgoingByTeam(team.Id, -1, -1)

		if result := <-incomingResult; result.Err == nil {
			CommandPrettyPrintln("Incoming Webhooks:")
			hooks := result.Data.([]*model.IncomingWebhook)
			for _, hook := range hooks {
				CommandPrettyPrintln("\t" + hook.DisplayName + " (" + hook.Id + ")")
			}
		} else {
			CommandPrintErrorln("Unable to list incoming webhooks for '" + args[i] + "'")
		}

		if result := <-outgoingResult; result.Err == nil {
			hooks := result.Data.([]*model.OutgoingWebhook)
			CommandPrettyPrintln("Outgoing Webhooks:")
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
