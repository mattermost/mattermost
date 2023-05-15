// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/web"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var ChannelCmd = &cobra.Command{
	Use:   "channel",
	Short: "Management of channels",
}

var ChannelCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a channel",
	Long:  `Create a channel.`,
	Example: `  channel create --team myteam --name mynewchannel --display-name "My New Channel"
  channel create --team myteam --name mynewprivatechannel --display-name "My New Private Channel" --private`,
	RunE: withClient(createChannelCmdF),
}

// ChannelRenameCmd is used to change name and/or display name of an existing channel.
var ChannelRenameCmd = &cobra.Command{
	Use:   "rename [channel]",
	Short: "Rename channel",
	Long:  `Rename an existing channel.`,
	Example: `  channel rename myteam:oldchannel --name 'new-channel' --display-name 'New Display Name'
  channel rename myteam:oldchannel --name 'new-channel'
  channel rename myteam:oldchannel --display-name 'New Display Name'`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(renameChannelCmdF),
}

var RemoveChannelUsersCmd = &cobra.Command{
	Use:   "remove [channel] [users]",
	Short: "Remove users from channel",
	Long:  "Remove some users from channel",
	Example: `  channel remove myteam:mychannel user@example.com username
  channel remove myteam:mychannel --all-users`,
	Deprecated: "please use \"users remove\" instead",
	RunE:       withClient(channelUsersRemoveCmdF),
}

var AddChannelUsersCmd = &cobra.Command{
	Use:        "add [channel] [users]",
	Short:      "Add users to channel",
	Long:       "Add some users to channel",
	Example:    "  channel add myteam:mychannel user@example.com username",
	Deprecated: "please use \"users add\" instead",
	RunE:       withClient(channelUsersAddCmdF),
}

var ArchiveChannelsCmd = &cobra.Command{
	Use:   "archive [channels]",
	Short: "Archive channels",
	Long: `Archive some channels.
Archive a channel along with all related information including posts from the database.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel archive myteam:mychannel",
	RunE:    withClient(archiveChannelsCmdF),
}

var DeleteChannelsCmd = &cobra.Command{
	Use:   "delete [channels]",
	Short: "Delete channels",
	Long: `Permanently delete some channels.
Permanently deletes one or multiple channels along with all related information including posts from the database.`,
	Example: "  channel delete myteam:mychannel",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(deleteChannelsCmdF),
}

// ListChannelsCmd is a command which lists all the channels of team(s) in a server.
var ListChannelsCmd = &cobra.Command{
	Use:   "list [teams]",
	Short: "List all channels on specified teams.",
	Long: `List all channels on specified teams.
Archived channels are appended with ' (archived)'.
Private channels the user is a member of or has access to are appended with ' (private)'.`,
	Example: "  channel list myteam",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(listChannelsCmdF),
}

var ModifyChannelCmd = &cobra.Command{
	Use:   "modify [channel] [flags]",
	Short: "Modify a channel's public/private type",
	Long: `Change the Public/Private type of a channel.
Channel can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: `  channel modify myteam:mychannel --private
  channel modify channelId --public`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(modifyChannelCmdF),
}

var RestoreChannelsCmd = &cobra.Command{
	Use:        "restore [channels]",
	Deprecated: "please use \"unarchive\" instead",
	Short:      "Restore some channels",
	Long: `Restore a previously deleted channel
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel restore myteam:mychannel",
	RunE:    withClient(unarchiveChannelsCmdF),
}

var UnarchiveChannelCmd = &cobra.Command{
	Use:   "unarchive [channels]",
	Short: "Unarchive some channels",
	Long: `Unarchive a previously archived channel
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel unarchive myteam:mychannel",
	RunE:    withClient(unarchiveChannelsCmdF),
}

var MakeChannelPrivateCmd = &cobra.Command{
	Use:     "make-private [channel]",
	Aliases: []string{"make_private"},
	Short:   "Set a channel's type to private",
	Long: `Set the type of a channel from Public to Private.
Channel can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example:    "  channel make-private myteam:mychannel",
	Deprecated: "please use \"channel modify --private\" instead",
	RunE:       withClient(makeChannelPrivateCmdF),
}

var SearchChannelCmd = &cobra.Command{
	Use:   "search [channel]\n  mmctl search --team [team] [channel]",
	Short: "Search a channel",
	Long: `Search a channel by channel name.
Channel can be specified by team. ie. --team myteam mychannel or by team ID.`,
	Example: `  channel search mychannel
  channel search --team myteam mychannel`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(searchChannelCmdF),
}

var MoveChannelCmd = &cobra.Command{
	Use:   "move [team] [channels]",
	Short: "Moves channels to the specified team",
	Long: `Moves the provided channels to the specified team.
Validates that all users in the channel belong to the target team. Incoming/Outgoing webhooks are moved along with the channel.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel move newteam oldteam:mychannel",
	Args:    cobra.MinimumNArgs(2),
	RunE:    withClient(moveChannelCmdF),
}

func init() {
	ChannelCreateCmd.Flags().String("name", "", "Channel Name")
	ChannelCreateCmd.Flags().String("display-name", "", "Channel Display Name")
	ChannelCreateCmd.Flags().String("display_name", "", "")
	_ = ChannelCreateCmd.Flags().MarkDeprecated("display_name", "please use display-name instead")
	ChannelCreateCmd.Flags().String("team", "", "Team name or ID")
	ChannelCreateCmd.Flags().String("header", "", "Channel header")
	ChannelCreateCmd.Flags().String("purpose", "", "Channel purpose")
	ChannelCreateCmd.Flags().Bool("private", false, "Create a private channel.")

	ModifyChannelCmd.Flags().Bool("private", false, "Convert the channel to a private channel")
	ModifyChannelCmd.Flags().Bool("public", false, "Convert the channel to a public channel")

	ChannelRenameCmd.Flags().String("name", "", "Channel Name")
	ChannelRenameCmd.Flags().String("display-name", "", "Channel Display Name")
	ChannelRenameCmd.Flags().String("display_name", "", "")
	_ = ChannelRenameCmd.Flags().MarkDeprecated("display_name", "please use display-name instead")

	RemoveChannelUsersCmd.Flags().Bool("all-users", false, "Remove all users from the indicated channel.")

	SearchChannelCmd.Flags().String("team", "", "Team name or ID")

	MoveChannelCmd.Flags().Bool("force", false, "Remove users that are not members of target team before moving the channel.")

	DeleteChannelsCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the channel and a DB backup has been performed.")

	ChannelCmd.AddCommand(
		ChannelCreateCmd,
		RemoveChannelUsersCmd,
		AddChannelUsersCmd,
		ArchiveChannelsCmd,
		ListChannelsCmd,
		RestoreChannelsCmd,
		UnarchiveChannelCmd,
		MakeChannelPrivateCmd,
		ModifyChannelCmd,
		ChannelRenameCmd,
		SearchChannelCmd,
		MoveChannelCmd,
		DeleteChannelsCmd,
	)

	RootCmd.AddCommand(ChannelCmd)
}

func createChannelCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	name, errn := cmd.Flags().GetString("name")
	if errn != nil || name == "" {
		return errors.New("name is required")
	}
	displayname, errdn := cmd.Flags().GetString("display-name")
	if errdn != nil || displayname == "" {
		displayname, errdn = cmd.Flags().GetString("display_name")
		if errdn != nil || displayname == "" {
			return errors.New("display Name is required")
		}
	}
	teamArg, errteam := cmd.Flags().GetString("team")
	if errteam != nil || teamArg == "" {
		return errors.New("team is required")
	}
	header, _ := cmd.Flags().GetString("header")
	purpose, _ := cmd.Flags().GetString("purpose")
	useprivate, _ := cmd.Flags().GetBool("private")

	channelType := model.ChannelTypeOpen
	if useprivate {
		channelType = model.ChannelTypePrivate
	}

	team := getTeamFromTeamArg(c, teamArg)
	if team == nil {
		return errors.Errorf("unable to find team: %s", teamArg)
	}

	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        name,
		DisplayName: displayname,
		Header:      header,
		Purpose:     purpose,
		Type:        channelType,
		CreatorId:   "",
	}

	newChannel, _, err := c.CreateChannel(channel)
	if err != nil {
		return err
	}

	printer.PrintT("New channel {{.Name}} successfully created", newChannel)

	return nil
}

func archiveChannelsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if len(args) < 1 {
		return errors.New("enter at least one channel to archive")
	}

	channels := getChannelsFromChannelArgs(c, args)
	var errors *multierror.Error
	for i, channel := range channels {
		if channel == nil {
			printer.PrintError("Unable to find channel '" + args[i] + "'")
			errors = multierror.Append(errors, fmt.Errorf("unable to find channel %q", args[i]))
			continue
		}
		if _, err := c.DeleteChannel(channel.Id); err != nil {
			printer.PrintError("Unable to archive channel '" + channel.Name + "' error: " + err.Error())
			errors = multierror.Append(errors, fmt.Errorf("unable to archive channel %q, error: %w", channel.Name, err))
		}
	}

	return errors.ErrorOrNil()
}

func getAllPublicChannelsForTeam(c client.Client, teamID string) ([]*model.Channel, error) {
	channels := []*model.Channel{}
	page := 0

	for {
		channelsPage, _, err := c.GetPublicChannelsForTeam(teamID, page, web.PerPageMaximum, "")
		if err != nil {
			return nil, err
		}

		if len(channelsPage) == 0 {
			break
		}

		channels = append(channels, channelsPage...)
		page++
	}

	return channels, nil
}

func getAllDeletedChannelsForTeam(c client.Client, teamID string) ([]*model.Channel, error) {
	channels := []*model.Channel{}
	page := 0

	for {
		channelsPage, _, err := c.GetDeletedChannelsForTeam(teamID, page, web.PerPageMaximum, "")
		if err != nil {
			return nil, err
		}

		if len(channelsPage) == 0 {
			break
		}

		channels = append(channels, channelsPage...)
		page++
	}

	return channels, nil
}

func listChannelsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	teams := getTeamsFromTeamArgs(c, args)

	var multierr *multierror.Error
	for i, team := range teams {
		if team == nil {
			err := fmt.Errorf("unable to find team %q", args[i])
			printer.PrintError(err.Error())
			multierr = multierror.Append(multierr, err)
			continue
		}

		publicChannels, err := getAllPublicChannelsForTeam(c, team.Id)
		if err != nil {
			printer.PrintError(fmt.Sprintf("unable to list public channels for %q: %s", args[i], err))
			multierr = multierror.Append(multierr, err)
		}
		for _, channel := range publicChannels {
			printer.PrintT("{{.Name}}", channel)
		}

		deletedChannels, err := getAllDeletedChannelsForTeam(c, team.Id)
		if err != nil {
			printer.PrintError(fmt.Sprintf("unable to list archived channels for %q: %s", args[i], err))
			multierr = multierror.Append(multierr, err)
		}
		for _, channel := range deletedChannels {
			printer.PrintT("{{.Name}} (archived)", channel)
		}

		privateChannels, appErr := getPrivateChannels(c, team.Id)
		if appErr != nil {
			printer.PrintError(fmt.Sprintf("unable to list private channels for %q: %s", args[i], appErr.Error()))
			multierr = multierror.Append(multierr, appErr)
		}
		for _, channel := range privateChannels {
			printer.PrintT("{{.Name}} (private)", channel)
		}
	}

	return multierr.ErrorOrNil()
}

func unarchiveChannelsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if len(args) < 1 {
		return errors.New("enter at least one channel")
	}

	channels := getChannelsFromChannelArgs(c, args)
	for i, channel := range channels {
		if channel == nil {
			printer.PrintError("Unable to find channel '" + args[i] + "'")
			continue
		}
		if _, _, err := c.RestoreChannel(channel.Id); err != nil {
			printer.PrintError("Unable to unarchive channel '" + args[i] + "'. Error: " + err.Error())
		}
	}

	return nil
}

func makeChannelPrivateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if len(args) != 1 {
		return errors.New("enter one channel to modify")
	}

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.Errorf("unable to find channel %q", args[0])
	}

	if !(channel.Type == model.ChannelTypeOpen) {
		return errors.New("you can only change the type of public channels")
	}

	if _, _, err := c.UpdateChannelPrivacy(channel.Id, model.ChannelTypePrivate); err != nil {
		return err
	}

	return nil
}

func modifyChannelCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	public, _ := cmd.Flags().GetBool("public")
	private, _ := cmd.Flags().GetBool("private")

	if public == private {
		return errors.New("you must specify only one of --public or --private")
	}

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.Errorf("unable to find channel %q", args[0])
	}

	if !(channel.Type == model.ChannelTypeOpen || channel.Type == model.ChannelTypePrivate) {
		return errors.New("you can only change the type of public/private channels")
	}

	privacy := model.ChannelTypeOpen
	if private {
		privacy = model.ChannelTypePrivate
	}

	if _, _, err := c.UpdateChannelPrivacy(channel.Id, privacy); err != nil {
		return errors.Errorf("failed to update channel (%q) privacy: %s", args[0], err.Error())
	}

	return nil
}

func renameChannelCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	existingTeamChannel := args[0]

	newChannelName, err := cmd.Flags().GetString("name")
	if err != nil {
		return err
	}

	newDisplayName, err := cmd.Flags().GetString("display-name")
	if err != nil || newDisplayName == "" {
		newDisplayName, err = cmd.Flags().GetString("display_name")
		if err != nil {
			return err
		}
	}

	// At least one of display name or name flag must be present
	if newDisplayName == "" && newChannelName == "" {
		return errors.New("require at least one flag to rename channel, either 'name' or 'display-name'")
	}

	channel := getChannelFromChannelArg(c, existingTeamChannel)
	if channel == nil {
		return errors.Errorf("unable to find channel from %q", existingTeamChannel)
	}

	channelPatch := &model.ChannelPatch{}
	if newChannelName != "" {
		channelPatch.Name = &newChannelName
	}
	if newDisplayName != "" {
		channelPatch.DisplayName = &newDisplayName
	}

	// Using PatchChannel API to rename channel
	updatedChannel, _, err := c.PatchChannel(channel.Id, channelPatch)
	if err != nil {
		return errors.Errorf("cannot rename channel %q, error: %s", channel.Name, err.Error())
	}

	printer.PrintT("'{{.Name}}' channel renamed", updatedChannel)
	return nil
}

func searchChannelCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	var channel *model.Channel

	if teamArg, _ := cmd.Flags().GetString("team"); teamArg != "" {
		team := getTeamFromTeamArg(c, teamArg)
		if team == nil {
			return errors.Errorf("team %s was not found", teamArg)
		}

		var err error
		channel, _, err = c.GetChannelByName(args[0], team.Id, "")
		if err != nil {
			return err
		}
		if channel == nil {
			return errors.Errorf("channel %s was not found in team %s", args[0], teamArg)
		}
	} else {
		teams, _, err := c.GetAllTeams("", 0, 9999)
		if err != nil {
			return err
		}

		for _, team := range teams {
			channel, _, _ = c.GetChannelByName(args[0], team.Id, "")
			if channel != nil && channel.Name == args[0] {
				break
			}
		}

		if channel == nil {
			return errors.Errorf("channel %q was not found in any team", args[0])
		}
	}

	if channel.DeleteAt > 0 {
		printer.PrintT("Channel Name :{{.Name}}, Display Name :{{.DisplayName}}, Channel ID :{{.Id}} (archived)", channel)
	} else {
		printer.PrintT("Channel Name :{{.Name}}, Display Name :{{.DisplayName}}, Channel ID :{{.Id}}", channel)
	}
	return nil
}

func moveChannelCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	force, _ := cmd.Flags().GetBool("force")

	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return fmt.Errorf("unable to find destination team %q", args[0])
	}

	var result *multierror.Error

	channels := getChannelsFromChannelArgs(c, args[1:])
	for i, channel := range channels {
		if channel == nil {
			result = multierror.Append(result, fmt.Errorf("unable to find channel %q", args[i+1]))
			continue
		}

		if channel.TeamId == team.Id {
			continue
		}

		newChannel, _, err := c.MoveChannel(channel.Id, team.Id, force)
		if err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to move channel %q: %w", channel.Name, err))
			continue
		}
		printer.PrintT(fmt.Sprintf("Moved channel {{.Name}} to %q ({{.TeamId}}) from %s.", team.Name, channel.TeamId), newChannel)
	}
	return result.ErrorOrNil()
}

func getPrivateChannels(c client.Client, teamID string) ([]*model.Channel, error) {
	allPrivateChannels := []*model.Channel{}
	page := 0
	withoutError := true

	for {
		channelsPage, _, err := c.GetPrivateChannelsForTeam(teamID, page, web.PerPageMaximum, "")
		if err != nil && viper.GetBool("local") {
			return nil, err
		} else if err != nil {
			// This means that the user is not in local mode neither
			// an admin, so we need to continue fetching the private
			// channels specific to their credentials
			withoutError = false
			break
		}

		if len(channelsPage) == 0 {
			break
		}

		allPrivateChannels = append(allPrivateChannels, channelsPage...)
		page++
	}

	// if the break happened without an error, this means we're either
	// in local mode or an admin, and we'll have all private channels
	// by now, so we can safely return
	if withoutError {
		return allPrivateChannels, nil
	}

	// We are definitely not in local mode here so we can safely use
	// "GetChannelsForTeamForUser" and "me" for userId
	allChannels, response, err := c.GetChannelsForTeamForUser(teamID, "me", false, "")
	if err != nil {
		if response.StatusCode == http.StatusNotFound { // user doesn't belong to any channels
			return nil, nil
		}
		return nil, err
	}
	privateChannels := make([]*model.Channel, 0, len(allChannels))
	for _, channel := range allChannels {
		if channel.Type != model.ChannelTypePrivate {
			continue
		}
		privateChannels = append(privateChannels, channel)
	}
	return privateChannels, nil
}

func deleteChannelsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		if err := getConfirmation("Are you sure you want to delete the channels specified? All data will be permanently deleted?", true); err != nil {
			return err
		}
	}

	var result *multierror.Error

	channels := getChannelsFromChannelArgs(c, args)
	for i, channel := range channels {
		if channel == nil {
			result = multierror.Append(result, fmt.Errorf("unable to find channel '%s'", args[i]))
			continue
		}
		if _, err := c.PermanentDeleteChannel(channel.Id); err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to delete channel '%q' error: %w", channel.Name, err))
		} else {
			printer.PrintT("Deleted channel '{{.Name}}'", channel)
		}
	}
	return result.ErrorOrNil()
}
