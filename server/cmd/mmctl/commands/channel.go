// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"

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

var UnarchiveChannelCmd = &cobra.Command{
	Use:   "unarchive [channels]",
	Short: "Unarchive some channels",
	Long: `Unarchive a previously archived channel
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel unarchive myteam:mychannel",
	RunE:    withClient(unarchiveChannelsCmdF),
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
Validates that all users in the channel belong to the target team. If some users are not members of the target team, the move fails and the missing users are listed; use --auto-add-users to add them to the target team automatically, or --force to remove them from the channel. Incoming/Outgoing webhooks are moved along with the channel.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel move newteam oldteam:mychannel",
	Args:    cobra.MinimumNArgs(2),
	RunE:    withClient(moveChannelCmdF),
}

func init() {
	ChannelCreateCmd.Flags().String("name", "", "Channel Name")
	ChannelCreateCmd.Flags().String("display-name", "", "Channel Display Name")
	ChannelCreateCmd.Flags().String("team", "", "Team name or ID")
	ChannelCreateCmd.Flags().String("header", "", "Channel header")
	ChannelCreateCmd.Flags().String("purpose", "", "Channel purpose")
	ChannelCreateCmd.Flags().Bool("private", false, "Create a private channel.")

	ModifyChannelCmd.Flags().Bool("private", false, "Convert the channel to a private channel")
	ModifyChannelCmd.Flags().Bool("public", false, "Convert the channel to a public channel")

	ChannelRenameCmd.Flags().String("name", "", "Channel Name")
	ChannelRenameCmd.Flags().String("display-name", "", "Channel Display Name")

	ListChannelsCmd.Flags().BoolP("show-ids", "i", false, "Show channel IDs")

	SearchChannelCmd.Flags().String("team", "", "Team name or ID")

	MoveChannelCmd.Flags().Bool("force", false, "Remove users that are not members of target team before moving the channel.")
	MoveChannelCmd.Flags().Bool("auto-add-users", false, "Add users that are not members of the target team to it before moving the channel.")

	DeleteChannelsCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the channel and a DB backup has been performed.")

	ChannelCmd.AddCommand(
		ChannelCreateCmd,
		ArchiveChannelsCmd,
		ListChannelsCmd,
		UnarchiveChannelCmd,
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
		return errors.New("display-name is required")
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

	newChannel, _, err := c.CreateChannel(context.TODO(), channel)
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
		if _, err := c.DeleteChannel(context.TODO(), channel.Id); err != nil {
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
		channelsPage, _, err := c.GetPublicChannelsForTeam(context.TODO(), teamID, page, DefaultPageSize, "")
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
		channelsPage, _, err := c.GetDeletedChannelsForTeam(context.TODO(), teamID, page, DefaultPageSize, "")
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

	showIds, _ := cmd.Flags().GetBool("show-ids")
	namePrefix := "{{.Name}}"
	if showIds {
		namePrefix = "{{.Id}}: {{.Name}}"
	}

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
			printer.PrintT(namePrefix, channel)
		}

		deletedChannels, err := getAllDeletedChannelsForTeam(c, team.Id)
		if err != nil {
			printer.PrintError(fmt.Sprintf("unable to list archived channels for %q: %s", args[i], err))
			multierr = multierror.Append(multierr, err)
		}
		for _, channel := range deletedChannels {
			printer.PrintT(namePrefix+" (archived)", channel)
		}

		privateChannels, appErr := getPrivateChannels(c, team.Id)
		if appErr != nil {
			printer.PrintError(fmt.Sprintf("unable to list private channels for %q: %s", args[i], appErr.Error()))
			multierr = multierror.Append(multierr, appErr)
		}
		for _, channel := range privateChannels {
			printer.PrintT(namePrefix+" (private)", channel)
		}
	}

	return multierr.ErrorOrNil()
}

func unarchiveChannelsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if len(args) < 1 {
		return errors.New("enter at least one channel")
	}

	var errs *multierror.Error

	channels := getChannelsFromChannelArgs(c, args)
	for i, channel := range channels {
		if channel == nil {
			msg := "Unable to find channel '" + args[i] + "'"
			printer.PrintError(msg)
			errs = multierror.Append(errs, errors.New(msg))
			continue
		}
		if _, _, err := c.RestoreChannel(context.TODO(), channel.Id); err != nil {
			msg := "Unable to unarchive channel '" + args[i] + "'. Error: " + err.Error()
			printer.PrintError(msg)
			errs = multierror.Append(errs, errors.New(msg))
		}
	}

	return errs.ErrorOrNil()
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

	if _, _, err := c.UpdateChannelPrivacy(context.TODO(), channel.Id, privacy); err != nil {
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
	if err != nil {
		return err
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
	updatedChannel, _, err := c.PatchChannel(context.TODO(), channel.Id, channelPatch)
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
		channel, _, err = c.GetChannelByName(context.TODO(), args[0], team.Id, "")
		if err != nil {
			return err
		}
		if channel == nil {
			return errors.Errorf("channel %s was not found in team %s", args[0], teamArg)
		}
	} else {
		teams, err := getPages(func(page, numPerPage int, etag string) ([]*model.Team, *model.Response, error) {
			return c.GetAllTeams(context.TODO(), etag, page, numPerPage)
		}, DefaultPageSize)
		if err != nil {
			return err
		}

		for _, team := range teams {
			channel, _, _ = c.GetChannelByName(context.TODO(), args[0], team.Id, "")
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
	autoAddUsers, _ := cmd.Flags().GetBool("auto-add-users")

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

		// When users are not being forcibly removed, the server rejects the move
		// if any channel member is missing from the destination team. Surface
		// those users to the operator, adding them to the team first if requested.
		if !force {
			missingUsers, err := getChannelMembersNotInTeam(c, channel.Id, team.Id)
			if err != nil {
				result = multierror.Append(result, fmt.Errorf("unable to determine missing team members for channel %q: %w", channel.Name, err))
				continue
			}

			if len(missingUsers) > 0 {
				if !autoAddUsers {
					result = multierror.Append(result, fmt.Errorf("unable to move channel %q: the following users are not members of team %q: %s. Re-run with --auto-add-users to add them automatically, or with --force to remove them from the channel", channel.Name, team.Name, strings.Join(usernamesOf(missingUsers), ", ")))
					continue
				}

				if err := addUsersToTeam(c, team, missingUsers); err != nil {
					result = multierror.Append(result, err)
					continue
				}
			}
		}

		newChannel, _, err := c.MoveChannel(context.TODO(), channel.Id, team.Id, force)
		if err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to move channel %q: %w", channel.Name, err))
			continue
		}
		printer.PrintT(fmt.Sprintf("Moved channel {{.Name}} to %q ({{.TeamId}}) from %s.", team.Name, channel.TeamId), newChannel)
	}
	return result.ErrorOrNil()
}

// getChannelMembersNotInTeam returns the users that are members of the channel
// but are not members of the given team.
func getChannelMembersNotInTeam(c client.Client, channelID, teamID string) ([]*model.User, error) {
	channelMemberUserIDs, err := getAllChannelMemberUserIDs(c, channelID)
	if err != nil {
		return nil, fmt.Errorf("unable to get channel members: %w", err)
	}

	if len(channelMemberUserIDs) == 0 {
		return []*model.User{}, nil
	}

	teamMembers, err := getTeamMembersByUserIDs(c, teamID, channelMemberUserIDs)
	if err != nil {
		return nil, fmt.Errorf("unable to get team members: %w", err)
	}

	teamMemberUserIDs := make(map[string]bool, len(teamMembers))
	for _, member := range teamMembers {
		teamMemberUserIDs[member.UserId] = true
	}

	missingUserIDs := []string{}
	for _, userID := range channelMemberUserIDs {
		if !teamMemberUserIDs[userID] {
			missingUserIDs = append(missingUserIDs, userID)
		}
	}

	if len(missingUserIDs) == 0 {
		return []*model.User{}, nil
	}

	users, _, err := c.GetUsersByIds(context.TODO(), missingUserIDs)
	if err != nil {
		return nil, fmt.Errorf("unable to get users for missing channel members: %w", err)
	}

	usersByID := make(map[string]*model.User, len(users))
	for _, user := range users {
		usersByID[user.Id] = user
	}

	missingUsers := make([]*model.User, 0, len(missingUserIDs))
	for _, userID := range missingUserIDs {
		if user, ok := usersByID[userID]; ok {
			missingUsers = append(missingUsers, user)
			continue
		}
		missingUsers = append(missingUsers, &model.User{Id: userID, Username: userID})
	}

	return missingUsers, nil
}

func getAllChannelMemberUserIDs(c client.Client, channelID string) ([]string, error) {
	userIDs := []string{}
	page := 0

	for {
		membersPage, _, err := c.GetChannelMembers(context.TODO(), channelID, page, DefaultPageSize, "")
		if err != nil {
			return nil, err
		}

		if len(membersPage) == 0 {
			break
		}

		for _, member := range membersPage {
			userIDs = append(userIDs, member.UserId)
		}
		page++
	}

	return userIDs, nil
}

func getTeamMembersByUserIDs(c client.Client, teamID string, userIDs []string) ([]*model.TeamMember, error) {
	teamMembers := []*model.TeamMember{}

	for i := 0; i < len(userIDs); i += DefaultPageSize {
		end := min(i+DefaultPageSize, len(userIDs))

		members, _, err := c.GetTeamMembersByIds(context.TODO(), teamID, userIDs[i:end])
		if err != nil {
			return nil, err
		}

		teamMembers = append(teamMembers, members...)
	}

	return teamMembers, nil
}

func addUsersToTeam(c client.Client, team *model.Team, users []*model.User) error {
	var result *multierror.Error
	for _, user := range users {
		if _, _, err := c.AddTeamMember(context.TODO(), team.Id, user.Id); err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to add user %q to team %q: %w", user.Username, team.Name, err))
			continue
		}
		printer.PrintT(fmt.Sprintf("Added user {{.Username}} to team %q.", team.Name), user)
	}
	return result.ErrorOrNil()
}

func usernamesOf(users []*model.User) []string {
	names := make([]string, len(users))
	for i, user := range users {
		names[i] = user.Username
	}
	return names
}

func getPrivateChannels(c client.Client, teamID string) ([]*model.Channel, error) {
	allPrivateChannels := []*model.Channel{}
	page := 0
	withoutError := true

	for {
		channelsPage, _, err := c.GetPrivateChannelsForTeam(context.TODO(), teamID, page, DefaultPageSize, "")
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
	allChannels, response, err := c.GetChannelsForTeamForUser(context.TODO(), teamID, "me", false, "")
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
		if _, err := c.PermanentDeleteChannel(context.TODO(), channel.Id); err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to delete channel '%q' error: %w", channel.Name, err))
		} else {
			printer.PrintT("Deleted channel '{{.Name}}'", channel)
		}
	}
	return result.ErrorOrNil()
}
