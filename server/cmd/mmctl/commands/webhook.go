// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

type StoreResult struct {
	Data interface{}
	Err  error
}

var WebhookCmd = &cobra.Command{
	Use:   "webhook",
	Short: "Management of webhooks",
}

var ListWebhookCmd = &cobra.Command{
	Use:     "list",
	Short:   "List webhooks",
	Long:    "list all webhooks",
	Example: "  webhook list myteam",
	RunE:    withClient(listWebhookCmdF),
}

var ShowWebhookCmd = &cobra.Command{
	Use:     "show [webhookId]",
	Short:   "Show a webhook",
	Long:    "Show the webhook specified by [webhookId]",
	Args:    cobra.ExactArgs(1),
	Example: "  webhook show w16zb5tu3n1zkqo18goqry1je",
	RunE:    withClient(showWebhookCmdF),
}

var CreateIncomingWebhookCmd = &cobra.Command{
	Use:     "create-incoming",
	Short:   "Create incoming webhook",
	Long:    "create incoming webhook which allows external posting of messages to specific channel",
	Example: "  webhook create-incoming --channel [channelID] --user [userID] --display-name [displayName] --description [webhookDescription] --lock-to-channel --icon [iconURL]",
	RunE:    withClient(createIncomingWebhookCmdF),
}

var ModifyIncomingWebhookCmd = &cobra.Command{
	Use:     "modify-incoming",
	Short:   "Modify incoming webhook",
	Long:    "Modify existing incoming webhook by changing its title, description, channel or icon url",
	Args:    cobra.ExactArgs(1),
	Example: "  webhook modify-incoming [webhookID] --channel [channelID] --display-name [displayName] --description [webhookDescription] --lock-to-channel --icon [iconURL]",
	RunE:    withClient(modifyIncomingWebhookCmdF),
}

var CreateOutgoingWebhookCmd = &cobra.Command{
	Use:   "create-outgoing",
	Short: "Create outgoing webhook",
	Long:  "create outgoing webhook which allows external posting of messages from a specific channel",
	Example: `  webhook create-outgoing --team myteam --user myusername --display-name mywebhook --trigger-word "build" --trigger-word "test" --url http://localhost:8000/my-webhook-handler
	webhook create-outgoing --team myteam --channel mychannel --user myusername --display-name mywebhook --description "My cool webhook" --trigger-when start --trigger-word build --trigger-word test --icon http://localhost:8000/my-slash-handler-bot-icon.png --url http://localhost:8000/my-webhook-handler --content-type "application/json"`,
	RunE: withClient(createOutgoingWebhookCmdF),
}

var ModifyOutgoingWebhookCmd = &cobra.Command{
	Use:     "modify-outgoing",
	Short:   "Modify outgoing webhook",
	Long:    "Modify existing outgoing webhook by changing its title, description, channel, icon, url, content-type, and triggers",
	Args:    cobra.ExactArgs(1),
	Example: `  webhook modify-outgoing [webhookId] --channel [channelId] --display-name [displayName] --description "New webhook description" --icon http://localhost:8000/my-slash-handler-bot-icon.png --url http://localhost:8000/my-webhook-handler --content-type "application/json" --trigger-word test --trigger-when start`,
	RunE:    withClient(modifyOutgoingWebhookCmdF),
}

var DeleteWebhookCmd = &cobra.Command{
	Use:     "delete",
	Short:   "Delete webhooks",
	Long:    "Delete webhook with given id",
	Args:    cobra.ExactArgs(1),
	Example: "  webhook delete [webhookID]",
	RunE:    withClient(deleteWebhookCmdF),
}

func listWebhookCmdF(c client.Client, command *cobra.Command, args []string) error {
	var teams []*model.Team

	if len(args) < 1 {
		var err error
		// If no team is specified, list all teams
		teams, _, err = c.GetAllTeams(context.TODO(), "", 0, 100000000)
		if err != nil {
			return err
		}
	} else {
		teams = getTeamsFromTeamArgs(c, args)
	}

	for i, team := range teams {
		if team == nil {
			printer.PrintError("Unable to find team '" + args[i] + "'")
			continue
		}

		// Fetch all hooks with a very large limit so we get them all.
		incomingResult := make(chan StoreResult, 1)
		go func() {
			incomingHooks, _, err := c.GetIncomingWebhooksForTeam(context.TODO(), team.Id, 0, 100000000, "")
			incomingResult <- StoreResult{Data: incomingHooks, Err: err}
			close(incomingResult)
		}()
		outgoingResult := make(chan StoreResult, 1)
		go func() {
			outgoingHooks, _, err := c.GetOutgoingWebhooksForTeam(context.TODO(), team.Id, 0, 100000000, "")
			outgoingResult <- StoreResult{Data: outgoingHooks, Err: err}
			close(outgoingResult)
		}()

		if result := <-incomingResult; result.Err == nil {
			hooks := result.Data.([]*model.IncomingWebhook)
			for _, hook := range hooks {
				printer.PrintT("Incoming:\t{{.DisplayName}} ({{.Id}}", hook)
			}
		} else {
			printer.PrintError("Unable to list incoming webhooks for '" + team.Id + "'")
		}

		if result := <-outgoingResult; result.Err == nil {
			hooks := result.Data.([]*model.OutgoingWebhook)
			for _, hook := range hooks {
				printer.PrintT("Outgoing:\t {{.DisplayName}} ({{.Id}})", hook)
			}
		} else {
			printer.PrintError("Unable to list outgoing webhooks for '" + team.Id + "'")
		}
	}

	return nil
}

func createIncomingWebhookCmdF(c client.Client, command *cobra.Command, args []string) error {
	printer.SetSingle(true)

	channelArg, _ := command.Flags().GetString("channel")
	channel := getChannelFromChannelArg(c, channelArg)
	if channel == nil {
		return errors.New("Unable to find channel '" + channelArg + "'")
	}

	userArg, _ := command.Flags().GetString("user")
	user := getUserFromUserArg(c, userArg)
	if user == nil {
		return errors.New("Unable to find user '" + userArg + "'")
	}

	displayName, _ := command.Flags().GetString("display-name")
	description, _ := command.Flags().GetString("description")
	iconURL, _ := command.Flags().GetString("icon")
	channelLocked, _ := command.Flags().GetBool("lock-to-channel")

	incomingWebhook := &model.IncomingWebhook{
		ChannelId:     channel.Id,
		DisplayName:   displayName,
		Description:   description,
		IconURL:       iconURL,
		ChannelLocked: channelLocked,
		Username:      user.Username,
		UserId:        user.Id,
	}

	createdIncoming, _, err := c.CreateIncomingWebhook(context.TODO(), incomingWebhook)
	if err != nil {
		printer.PrintError("Unable to create webhook")
		return err
	}

	tpl := `Id: {{.Id}}
Display Name: {{.DisplayName}}`
	printer.PrintT(tpl, createdIncoming)

	return nil
}

func modifyIncomingWebhookCmdF(c client.Client, command *cobra.Command, args []string) error {
	printer.SetSingle(true)

	webhookArg := args[0]
	oldHook, _, err := c.GetIncomingWebhook(context.TODO(), webhookArg, "")
	if err != nil {
		return errors.New("Unable to find webhook '" + webhookArg + "'")
	}

	updatedHook := oldHook

	channelArg, _ := command.Flags().GetString("channel")
	if channelArg != "" {
		channel := getChannelFromChannelArg(c, channelArg)
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
	iconURL, _ := command.Flags().GetString("icon")
	if iconURL != "" {
		updatedHook.IconURL = iconURL
	}
	channelLocked, _ := command.Flags().GetBool("lock-to-channel")
	updatedHook.ChannelLocked = channelLocked

	var newHook *model.IncomingWebhook
	if newHook, _, err = c.UpdateIncomingWebhook(context.TODO(), updatedHook); err != nil {
		printer.PrintError("Unable to modify incoming webhook")
		return err
	}

	printer.PrintT("Webhook {{.Id}} successfully updated", newHook)
	return nil
}

func createOutgoingWebhookCmdF(c client.Client, command *cobra.Command, args []string) error {
	printer.SetSingle(true)

	teamArg, _ := command.Flags().GetString("team")
	team := getTeamFromTeamArg(c, teamArg)
	if team == nil {
		return errors.New("Unable to find team: " + teamArg)
	}

	userArg, _ := command.Flags().GetString("user")
	user := getUserFromUserArg(c, userArg)
	if user == nil {
		return errors.New("Unable to find user: " + userArg)
	}

	displayName, _ := command.Flags().GetString("display-name")
	triggerWords, _ := command.Flags().GetStringArray("trigger-word")
	callbackURLs, _ := command.Flags().GetStringArray("url")

	triggerWhenString, _ := command.Flags().GetString("trigger-when")
	var triggerWhen int
	switch triggerWhenString {
	case "exact":
		triggerWhen = 0
	case "start":
		triggerWhen = 1
	default:
		return errors.New("invalid trigger when parameter")
	}

	description, _ := command.Flags().GetString("description")
	contentType, _ := command.Flags().GetString("content-type")
	iconURL, _ := command.Flags().GetString("icon")

	outgoingWebhook := &model.OutgoingWebhook{
		CreatorId:    user.Id,
		Username:     user.Username,
		TeamId:       team.Id,
		TriggerWords: triggerWords,
		TriggerWhen:  triggerWhen,
		CallbackURLs: callbackURLs,
		DisplayName:  displayName,
		Description:  description,
		ContentType:  contentType,
		IconURL:      iconURL,
	}

	channelArg, _ := command.Flags().GetString("channel")
	if channelArg != "" {
		channel := getChannelFromChannelArg(c, channelArg)
		if channel != nil {
			outgoingWebhook.ChannelId = channel.Id
		}
	}

	createdOutgoing, _, err := c.CreateOutgoingWebhook(context.TODO(), outgoingWebhook)
	if err != nil {
		printer.PrintError("Unable to create outgoing webhook")
		return err
	}

	tpl := `Id: {{.Id}}
Display Name: {{.DisplayName}}`
	printer.PrintT(tpl, createdOutgoing)

	return nil
}

func modifyOutgoingWebhookCmdF(c client.Client, command *cobra.Command, args []string) error {
	printer.SetSingle(true)

	webhookArg := args[0]
	oldHook, _, err := c.GetOutgoingWebhook(context.TODO(), webhookArg)
	if err != nil {
		return errors.New("unable to find webhook '" + webhookArg + "'")
	}

	updatedHook := oldHook

	channelArg, _ := command.Flags().GetString("channel")
	if channelArg != "" {
		channel := getChannelFromChannelArg(c, channelArg)
		if channel == nil {
			return errors.New("unable to find channel '" + channelArg + "'")
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

	triggerWords, err := command.Flags().GetStringArray("trigger-word")
	if err != nil {
		return errors.Wrap(err, "invalid trigger-word parameter")
	}
	if len(triggerWords) > 0 {
		updatedHook.TriggerWords = triggerWords
	}

	triggerWhenString, _ := command.Flags().GetString("trigger-when")
	if triggerWhenString != "" {
		var triggerWhen int
		switch triggerWhenString {
		case "exact":
			triggerWhen = 0
		case "start":
			triggerWhen = 1
		default:
			return errors.New("invalid trigger-when parameter")
		}
		updatedHook.TriggerWhen = triggerWhen
	}

	iconURL, _ := command.Flags().GetString("icon")
	if iconURL != "" {
		updatedHook.IconURL = iconURL
	}

	contentType, _ := command.Flags().GetString("content-type")
	if contentType != "" {
		updatedHook.ContentType = contentType
	}

	callbackURLs, err := command.Flags().GetStringArray("url")
	if err != nil {
		return errors.Wrap(err, "invalid URL parameter")
	}
	if len(callbackURLs) > 0 {
		updatedHook.CallbackURLs = callbackURLs
	}

	var newHook *model.OutgoingWebhook
	if newHook, _, err = c.UpdateOutgoingWebhook(context.TODO(), updatedHook); err != nil {
		printer.PrintError("Unable to modify outgoing webhook")
		return err
	}

	printer.PrintT("Webhook {{.Id}} successfully updated", newHook)
	return nil
}

func deleteWebhookCmdF(c client.Client, command *cobra.Command, args []string) error {
	printer.SetSingle(true)

	webhookID := args[0]
	if incomingWebhook, _, err := c.GetIncomingWebhook(context.TODO(), webhookID, ""); err == nil {
		_, err := c.DeleteIncomingWebhook(context.TODO(), webhookID)
		if err != nil {
			printer.PrintError("Unable to delete webhook '" + webhookID + "'")
			return err
		}
		printer.PrintT("Webhook {{.Id}} successfully deleted", incomingWebhook)
		return nil
	}

	if outgoingWebhook, _, err := c.GetOutgoingWebhook(context.TODO(), webhookID); err == nil {
		_, err := c.DeleteOutgoingWebhook(context.TODO(), webhookID)
		if err != nil {
			printer.PrintError("Unable to delete webhook '" + webhookID + "'")
			return err
		}

		printer.PrintT("Webhook {{.Id}} successfully deleted", outgoingWebhook)
		return nil
	}

	return errors.New("Webhook with id '" + webhookID + "' not found")
}

func showWebhookCmdF(c client.Client, command *cobra.Command, args []string) error {
	printer.SetSingle(true)

	webhookID := args[0]
	if incomingWebhook, _, err := c.GetIncomingWebhook(context.TODO(), webhookID, ""); err == nil {
		printer.Print(*incomingWebhook)
		return nil
	}

	if outgoingWebhook, _, err := c.GetOutgoingWebhook(context.TODO(), webhookID); err == nil {
		printer.Print(*outgoingWebhook)
		return nil
	}

	return errors.New("Webhook with id '" + webhookID + "' not found")
}

func init() {
	CreateIncomingWebhookCmd.Flags().String("channel", "", "Channel ID (required)")
	_ = CreateIncomingWebhookCmd.MarkFlagRequired("channel")
	CreateIncomingWebhookCmd.Flags().String("user", "", "User ID (required)")
	_ = CreateIncomingWebhookCmd.MarkFlagRequired("user")
	CreateIncomingWebhookCmd.Flags().String("display-name", "", "Incoming webhook display name")
	CreateIncomingWebhookCmd.Flags().String("description", "", "Incoming webhook description")
	CreateIncomingWebhookCmd.Flags().String("icon", "", "Icon URL")
	CreateIncomingWebhookCmd.Flags().Bool("lock-to-channel", false, "Lock to channel")

	ModifyIncomingWebhookCmd.Flags().String("channel", "", "Channel ID")
	ModifyIncomingWebhookCmd.Flags().String("display-name", "", "Incoming webhook display name")
	ModifyIncomingWebhookCmd.Flags().String("description", "", "Incoming webhook description")
	ModifyIncomingWebhookCmd.Flags().String("icon", "", "Icon URL")
	ModifyIncomingWebhookCmd.Flags().Bool("lock-to-channel", false, "Lock to channel")

	CreateOutgoingWebhookCmd.Flags().String("team", "", "Team name or ID (required)")
	_ = CreateOutgoingWebhookCmd.MarkFlagRequired("team")
	CreateOutgoingWebhookCmd.Flags().String("channel", "", "Channel name or ID")
	CreateOutgoingWebhookCmd.Flags().String("user", "", "User username, email, or ID (required)")
	_ = CreateOutgoingWebhookCmd.MarkFlagRequired("user")
	CreateOutgoingWebhookCmd.Flags().String("display-name", "", "Outgoing webhook display name (required)")
	_ = CreateOutgoingWebhookCmd.MarkFlagRequired("display-name")
	CreateOutgoingWebhookCmd.Flags().String("description", "", "Outgoing webhook description")
	CreateOutgoingWebhookCmd.Flags().StringArray("trigger-word", []string{}, "Word to trigger webhook (required)")
	_ = CreateOutgoingWebhookCmd.MarkFlagRequired("trigger-word")
	CreateOutgoingWebhookCmd.Flags().String("trigger-when", "exact", "When to trigger webhook (exact: for first word matches a trigger word exactly, start: for first word starts with a trigger word)")
	CreateOutgoingWebhookCmd.Flags().String("icon", "", "Icon URL")
	CreateOutgoingWebhookCmd.Flags().StringArray("url", []string{}, "Callback URL (required)")
	_ = CreateOutgoingWebhookCmd.MarkFlagRequired("url")
	CreateOutgoingWebhookCmd.Flags().String("content-type", "", "Content-type")

	ModifyOutgoingWebhookCmd.Flags().String("channel", "", "Channel name or ID")
	ModifyOutgoingWebhookCmd.Flags().String("display-name", "", "Outgoing webhook display name")
	ModifyOutgoingWebhookCmd.Flags().String("description", "", "Outgoing webhook description")
	ModifyOutgoingWebhookCmd.Flags().StringArray("trigger-word", []string{}, "Word to trigger webhook")
	ModifyOutgoingWebhookCmd.Flags().String("trigger-when", "", "When to trigger webhook (exact: for first word matches a trigger word exactly, start: for first word starts with a trigger word)")
	ModifyOutgoingWebhookCmd.Flags().String("icon", "", "Icon URL")
	ModifyOutgoingWebhookCmd.Flags().StringArray("url", []string{}, "Callback URL")
	ModifyOutgoingWebhookCmd.Flags().String("content-type", "", "Content-type")

	WebhookCmd.AddCommand(
		ListWebhookCmd,
		CreateIncomingWebhookCmd,
		ModifyIncomingWebhookCmd,
		CreateOutgoingWebhookCmd,
		ModifyOutgoingWebhookCmd,
		DeleteWebhookCmd,
		ShowWebhookCmd,
	)

	RootCmd.AddCommand(WebhookCmd)
}
