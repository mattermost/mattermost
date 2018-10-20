// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
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

var WebhookCreateIncomingCmd = &cobra.Command{
	Use:     "create-incoming",
	Short:   "Create incoming webhook",
	Long:    "create incoming webhook which allows external posting of messages to specific channel",
	Example: "  webhook create-incoming --channel [channelID] --user [userID] --display-name [displayName] --description [webhookDescription] --lock-to-channel --icon [iconURL]",
	RunE:    createIncomingWebhookCmdF,
}

var WebhookModifyIncomingCmd = &cobra.Command{
	Use:     "modify-incoming",
	Short:   "Modify incoming webhook",
	Long:    "Modify existing incoming webhook by changing its title, description, channel or icon url",
	Example: "  webhook modify-incoming [webhookID] --channel [channelID] --display-name [displayName] --description [webhookDescription] --lock-to-channel --icon [iconURL]",
	RunE:    modifyIncomingWebhookCmdF,
}

var WebhookModifyOutgoingCmd = &cobra.Command{
	Use:     "modify-outgoing",
	Short:   "Modify outgoing webhook",
	Long:    "Modify an exiting outgoing webhook by changing its title, description, channel, triggers, icon, url or content-type. --trigger-words expects a `\\n` delimited list of words.",
	Example: "  webhook modify-outgoing [webhookID] --channel [channelID] --display-name [displayName] --description [webhookDescription] --icon [iconURL] --trigger-words [word1\nword2] --content-type [contentType]",
	RunE:    modifyOutgoingWebhookCmdF,
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

func createIncomingWebhookCmdF(command *cobra.Command, args []string) error {
	app, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer app.Shutdown()

	channelArg, _ := command.Flags().GetString("channel")
	channel := getChannelFromChannelArg(app, channelArg)
	if channel == nil {
		return errors.New("Unable to find channel '" + channelArg + "'")
	}

	userArg, _ := command.Flags().GetString("user")
	user := getUserFromUserArg(app, userArg)
	displayName, _ := command.Flags().GetString("display-name")
	description, _ := command.Flags().GetString("description")
	iconUrl, _ := command.Flags().GetString("icon")
	channelLocked, _ := command.Flags().GetBool("lock-to-channel")

	incomingWebhook := &model.IncomingWebhook{
		ChannelId:     channel.Id,
		DisplayName:   displayName,
		Description:   description,
		IconURL:       iconUrl,
		ChannelLocked: channelLocked,
	}

	if _, err := app.CreateIncomingWebhookForChannel(user.Id, channel, incomingWebhook); err != nil {
		return err
	}

	return nil
}

func modifyIncomingWebhookCmdF(command *cobra.Command, args []string) error {
	app, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer app.Shutdown()

	if len(args) < 1 {
		return errors.New("WebhookID is not specified")
	}

	webhookArg := args[0]
	oldHook, getErr := app.GetIncomingWebhook(webhookArg)
	if getErr != nil {
		return errors.New("Unable to find webhook '" + webhookArg + "'")
	}

	updatedHook := oldHook

	channelArg, _ := command.Flags().GetString("channel")
	if channelArg != "" {
		channel := getChannelFromChannelArg(app, channelArg)
		if channel == nil {
			return errors.New("Unable to find channel '" + channelArg + "'")
		}
		updatedHook.ChannelId = channel.Id
	}

	displayName, _ := command.Flags().GetString("display-name")
	if displayName != "" {
		updatedHook.DisplayName = displayName
	}
	description, _ := command.Flags().GetString("description")
	if description != "" {
		updatedHook.Description = description
	}
	iconUrl, _ := command.Flags().GetString("icon")
	if iconUrl != "" {
		updatedHook.IconURL = iconUrl
	}
	channelLocked, _ := command.Flags().GetBool("lock-to-channel")
	updatedHook.ChannelLocked = channelLocked

	if _, err := app.UpdateIncomingWebhook(oldHook, updatedHook); err != nil {
		return err
	}

	return nil
}

// title
// trigger-in
// url
func modifyOutgoingWebhookCmdF(command *cobra.Command, args []string) error {
	app, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer app.Shutdown()

	if len(args) < 1 {
		return errors.New("WebhookID is not specified")
	}

	webhookId := args[0]
	oldHook, err := app.GetOutgoingWebhook(webhookId)
	if err != nil {
		return fmt.Errorf("Unable to find webhook '%s'", webhookId)
	}

	updatedHook := oldHook

	if channelArg, _ := command.Flags().GetString("channel"); channelArg != "" {
		channel := getChannelFromChannelArg(app, channelArg)
		if channel == nil {
			return fmt.Errorf("Unable to find channel '%s'", channelArg)
		}
		updatedHook.ChannelId = channel.Id
	}

	if displayName, _ := command.Flags().GetString("display-name"); displayName != "" {
		updatedHook.DisplayName = displayName
	}

	if description, _ := command.Flags().GetString("description"); description != "" {
		updatedHook.Description = description
	}

	if iconUrl, _ := command.Flags().GetString("icon"); iconUrl != "" {
		updatedHook.IconURL = iconUrl
	}

	if contentType, _ := command.Flags().GetString("content-type"); contentType != "" {
		updatedHook.ContentType = contentType
	}

	triggerWordsArg, _ := command.Flags().GetString("trigger-words")
	if triggerWordsArg != "" {
		triggerWords := strings.Split(triggerWordsArg, "\n")
		updatedHook.TriggerWords = triggerWords
	}

	if _, err := app.UpdateOutgoingWebhook(oldHook, updatedHook); err != nil {
		return err
	}

	return nil
}

func init() {
	WebhookCreateIncomingCmd.Flags().String("channel", "", "Channel ID")
	WebhookCreateIncomingCmd.Flags().String("user", "", "User ID")
	WebhookCreateIncomingCmd.Flags().String("display-name", "", "Incoming webhook display name")
	WebhookCreateIncomingCmd.Flags().String("description", "", "Incoming webhook description")
	WebhookCreateIncomingCmd.Flags().String("icon", "", "Icon URL")
	WebhookCreateIncomingCmd.Flags().Bool("lock-to-channel", false, "Lock to channel")

	WebhookModifyIncomingCmd.Flags().String("channel", "", "Channel ID")
	WebhookModifyIncomingCmd.Flags().String("display-name", "", "Incoming webhook display name")
	WebhookModifyIncomingCmd.Flags().String("description", "", "Incoming webhook description")
	WebhookModifyIncomingCmd.Flags().String("icon", "", "Icon URL")
	WebhookModifyIncomingCmd.Flags().String("content-type", "", "Content type")
	WebhookModifyIncomingCmd.Flags().String("trigger-words", "", "Trigger words (`\\n` separated)")

	WebhookModifyOutgoingCmd.Flags().String("channel", "", "Channel ID")
	WebhookModifyOutgoingCmd.Flags().String("display-name", "", "Incoming webhook display name")
	WebhookModifyOutgoingCmd.Flags().String("description", "", "Incoming webhook description")
	WebhookModifyOutgoingCmd.Flags().String("icon", "", "Icon URL")
	WebhookModifyOutgoingCmd.Flags().Bool("lock-to-channel", false, "Lock to channel")

	WebhookCmd.AddCommand(
		WebhookListCmd,
		WebhookCreateIncomingCmd,
		WebhookModifyIncomingCmd,
	)

	RootCmd.AddCommand(WebhookCmd)
}
