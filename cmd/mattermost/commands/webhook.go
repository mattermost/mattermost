package commands

import (
	"math"

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

	if len(args) < 1 {
		// TODO: get all hooks for all teams
	}

	teams := getTeamsFromTeamArgs(app, args)
	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		incomingResult := app.Srv.Store.Webhook().GetIncomingByTeam(team.Id, 0, math.MaxInt32)
		outgoingResult := app.Srv.Store.Webhook().GetOutgoingByTeam(team.Id, 0, math.MaxInt32)

		if result := <-incomingResult; result.Err == nil {
			hooks := result.Data.([]*model.IncomingWebhook)
			for _, hook := range hooks {
				CommandPrettyPrintln(hook.DisplayName)
			}
		}
		if result := <-outgoingResult; result.Err != nil {
			hooks := result.Data.([]*model.IncomingWebhook)
			for _, hook := range hooks {
				CommandPrettyPrintln(hook.DisplayName)
			}
		}
	}
	return nil
}

func init() {
	WebhookCmd.AddCommand(
		WebhookListCmd,
	)
}
