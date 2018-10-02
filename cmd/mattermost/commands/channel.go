// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var ChannelCmd = &cobra.Command{
	Use:   "channel",
	Short: "Management of channels",
}

var ChannelCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a channel",
	Long:  `Create a channel.`,
	Example: `  channel create --team myteam --name mynewchannel --display_name "My New Channel"
  channel create --team myteam --name mynewprivatechannel --display_name "My New Private Channel" --private`,
	RunE: createChannelCmdF,
}

var ChannelRenameCmd = &cobra.Command{
	Use:     "rename",
	Short:   "Rename a channel",
	Long:    `Rename a channel.`,
	Example: `"  channel rename myteam:mychannel newchannelname --display_name "New Display Name"`,
	RunE:    renameChannelCmdF,
}

var RemoveChannelUsersCmd = &cobra.Command{
	Use:   "remove [channel] [users]",
	Short: "Remove users from channel",
	Long:  "Remove some users from channel",
	Example: `  channel remove myteam:mychannel user@example.com username
  channel remove myteam:mychannel --all-users`,
	RunE: removeChannelUsersCmdF,
}

var AddChannelUsersCmd = &cobra.Command{
	Use:     "add [channel] [users]",
	Short:   "Add users to channel",
	Long:    "Add some users to channel",
	Example: "  channel add myteam:mychannel user@example.com username",
	RunE:    addChannelUsersCmdF,
}

var ArchiveChannelsCmd = &cobra.Command{
	Use:   "archive [channels]",
	Short: "Archive channels",
	Long: `Archive some channels.
Archive a channel along with all related information including posts from the database.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel archive myteam:mychannel",
	RunE:    archiveChannelsCmdF,
}

var DeleteChannelsCmd = &cobra.Command{
	Use:   "delete [channels]",
	Short: "Delete channels",
	Long: `Permanently delete some channels.
Permanently deletes a channel along with all related information including posts from the database.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel delete myteam:mychannel",
	RunE:    deleteChannelsCmdF,
}

var ListChannelsCmd = &cobra.Command{
	Use:   "list [teams]",
	Short: "List all channels on specified teams.",
	Long: `List all channels on specified teams.
Archived channels are appended with ' (archived)'.`,
	Example: "  channel list myteam",
	RunE:    listChannelsCmdF,
}

var MoveChannelsCmd = &cobra.Command{
	Use:   "move [team] [channels] --username [user]",
	Short: "Moves channels to the specified team",
	Long: `Moves the provided channels to the specified team.
Validates that all users in the channel belong to the target team. Incoming/Outgoing webhooks are moved along with the channel.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel move newteam oldteam:mychannel --username myusername",
	RunE:    moveChannelsCmdF,
}

var RestoreChannelsCmd = &cobra.Command{
	Use:   "restore [channels]",
	Short: "Restore some channels",
	Long: `Restore a previously deleted channel
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel restore myteam:mychannel",
	RunE:    restoreChannelsCmdF,
}

var ModifyChannelCmd = &cobra.Command{
	Use:   "modify [channel] [flags] --username [user]",
	Short: "Modify a channel's public/private type",
	Long: `Change the public/private type of a channel.
Channel can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel modify myteam:mychannel --private --username myusername",
	RunE:    modifyChannelCmdF,
}

func init() {
	ChannelCreateCmd.Flags().String("name", "", "Channel Name")
	ChannelCreateCmd.Flags().String("display_name", "", "Channel Display Name")
	ChannelCreateCmd.Flags().String("team", "", "Team name or ID")
	ChannelCreateCmd.Flags().String("header", "", "Channel header")
	ChannelCreateCmd.Flags().String("purpose", "", "Channel purpose")
	ChannelCreateCmd.Flags().Bool("private", false, "Create a private channel.")

	MoveChannelsCmd.Flags().String("username", "", "Required. Username who is moving the channel.")

	DeleteChannelsCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the channels.")

	ModifyChannelCmd.Flags().Bool("private", false, "Convert the channel to a private channel")
	ModifyChannelCmd.Flags().Bool("public", false, "Convert the channel to a public channel")
	ModifyChannelCmd.Flags().String("username", "", "Required. Username who changes the channel privacy.")

	ChannelRenameCmd.Flags().String("display_name", "", "Channel Display Name")

	RemoveChannelUsersCmd.Flags().Bool("all-users", false, "Remove all users from the indicated channel.")

	ChannelCmd.AddCommand(
		ChannelCreateCmd,
		RemoveChannelUsersCmd,
		AddChannelUsersCmd,
		ArchiveChannelsCmd,
		DeleteChannelsCmd,
		ListChannelsCmd,
		MoveChannelsCmd,
		RestoreChannelsCmd,
		ModifyChannelCmd,
		ChannelRenameCmd,
	)

	RootCmd.AddCommand(ChannelCmd)
}

func createChannelCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	name, errn := command.Flags().GetString("name")
	if errn != nil || name == "" {
		return errors.New("Name is required")
	}
	displayname, errdn := command.Flags().GetString("display_name")
	if errdn != nil || displayname == "" {
		return errors.New("Display Name is required")
	}
	teamArg, errteam := command.Flags().GetString("team")
	if errteam != nil || teamArg == "" {
		return errors.New("Team is required")
	}
	header, _ := command.Flags().GetString("header")
	purpose, _ := command.Flags().GetString("purpose")
	useprivate, _ := command.Flags().GetBool("private")

	channelType := model.CHANNEL_OPEN
	if useprivate {
		channelType = model.CHANNEL_PRIVATE
	}

	team := getTeamFromTeamArg(a, teamArg)
	if team == nil {
		return errors.New("Unable to find team: " + teamArg)
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

	if _, err := a.CreateChannel(channel, false); err != nil {
		return err
	}

	return nil
}

func removeChannelUsersCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	allUsers, _ := command.Flags().GetBool("all-users")

	if allUsers && len(args) != 1 {
		return errors.New("individual users must not be specified in conjunction with the --all-users flag")
	}

	if !allUsers && len(args) < 2 {
		return errors.New("you must specify some users to remove from the channel, or use the --all-users flag to remove them all")
	}

	channel := getChannelFromChannelArg(a, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	if allUsers {
		removeAllUsersFromChannel(a, channel)
	} else {
		users := getUsersFromUserArgs(a, args[1:])
		for i, user := range users {
			removeUserFromChannel(a, channel, user, args[i+1])
		}
	}

	return nil
}

func removeUserFromChannel(a *app.App, channel *model.Channel, user *model.User, userArg string) {
	if user == nil {
		CommandPrintErrorln("Can't find user '" + userArg + "'")
		return
	}
	if err := a.RemoveUserFromChannel(user.Id, "", channel); err != nil {
		CommandPrintErrorln("Unable to remove '" + userArg + "' from " + channel.Name + ". Error: " + err.Error())
	}
}

func removeAllUsersFromChannel(a *app.App, channel *model.Channel) {
	if result := <-a.Srv.Store.Channel().PermanentDeleteMembersByChannel(channel.Id); result.Err != nil {
		CommandPrintErrorln("Unable to remove all users from " + channel.Name + ". Error: " + result.Err.Error())
	}
}

func addChannelUsersCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 2 {
		return errors.New("Not enough arguments.")
	}

	channel := getChannelFromChannelArg(a, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	users := getUsersFromUserArgs(a, args[1:])
	for i, user := range users {
		addUserToChannel(a, channel, user, args[i+1])
	}

	return nil
}

func addUserToChannel(a *app.App, channel *model.Channel, user *model.User, userArg string) {
	if user == nil {
		CommandPrintErrorln("Can't find user '" + userArg + "'")
		return
	}
	if _, err := a.AddUserToChannel(user, channel); err != nil {
		CommandPrintErrorln("Unable to add '" + userArg + "' from " + channel.Name + ". Error: " + err.Error())
	}
}

func archiveChannelsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Enter at least one channel to archive.")
	}

	channels := getChannelsFromChannelArgs(a, args)
	for i, channel := range channels {
		if channel == nil {
			CommandPrintErrorln("Unable to find channel '" + args[i] + "'")
			continue
		}
		if result := <-a.Srv.Store.Channel().Delete(channel.Id, model.GetMillis()); result.Err != nil {
			CommandPrintErrorln("Unable to archive channel '" + channel.Name + "' error: " + result.Err.Error())
		}
	}

	return nil
}

func deleteChannelsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Enter at least one channel to delete.")
	}

	confirmFlag, _ := command.Flags().GetBool("confirm")
	if !confirmFlag {
		var confirm string
		CommandPrettyPrintln("Are you sure you want to delete the channels specified?  All data will be permanently deleted? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	channels := getChannelsFromChannelArgs(a, args)
	for i, channel := range channels {
		if channel == nil {
			CommandPrintErrorln("Unable to find channel '" + args[i] + "'")
			continue
		}
		if err := deleteChannel(a, channel); err != nil {
			CommandPrintErrorln("Unable to delete channel '" + channel.Name + "' error: " + err.Error())
		} else {
			CommandPrettyPrintln("Deleted channel '" + channel.Name + "'")
		}
	}

	return nil
}

func deleteChannel(a *app.App, channel *model.Channel) *model.AppError {
	return a.PermanentDeleteChannel(channel)
}

func moveChannelsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 2 {
		return errors.New("Enter the destination team and at least one channel to move.")
	}

	team := getTeamFromTeamArg(a, args[0])
	if team == nil {
		return errors.New("Unable to find destination team '" + args[0] + "'")
	}

	username, erru := command.Flags().GetString("username")
	if erru != nil || username == "" {
		return errors.New("Username is required.")
	}
	user := getUserFromUserArg(a, username)

	channels := getChannelsFromChannelArgs(a, args[1:])
	for i, channel := range channels {
		if channel == nil {
			CommandPrintErrorln("Unable to find channel '" + args[i+1] + "'")
			continue
		}
		originTeamID := channel.TeamId
		if err := moveChannel(a, team, channel, user); err != nil {
			CommandPrintErrorln("Unable to move channel '" + channel.Name + "' error: " + err.Error())
		} else {
			CommandPrettyPrintln("Moved channel '" + channel.Name + "' to " + team.Name + "(" + team.Id + ") from " + originTeamID + ".")
		}
	}

	return nil
}

func moveChannel(a *app.App, team *model.Team, channel *model.Channel, user *model.User) *model.AppError {
	oldTeamId := channel.TeamId

	if err := a.MoveChannel(team, channel, user); err != nil {
		return err
	}

	if incomingWebhooks, err := a.GetIncomingWebhooksForTeamPage(oldTeamId, 0, 10000000); err != nil {
		return err
	} else {
		for _, webhook := range incomingWebhooks {
			if webhook.ChannelId == channel.Id {
				webhook.TeamId = team.Id
				if result := <-a.Srv.Store.Webhook().UpdateIncoming(webhook); result.Err != nil {
					CommandPrintErrorln("Failed to move incoming webhook '" + webhook.Id + "' to new team.")
				}
			}
		}
	}

	if outgoingWebhooks, err := a.GetOutgoingWebhooksForTeamPage(oldTeamId, 0, 10000000); err != nil {
		return err
	} else {
		for _, webhook := range outgoingWebhooks {
			if webhook.ChannelId == channel.Id {
				webhook.TeamId = team.Id
				if result := <-a.Srv.Store.Webhook().UpdateOutgoing(webhook); result.Err != nil {
					CommandPrintErrorln("Failed to move outgoing webhook '" + webhook.Id + "' to new team.")
				}
			}
		}
	}

	return nil
}

func listChannelsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Enter at least one team.")
	}

	teams := getTeamsFromTeamArgs(a, args)
	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		if result := <-a.Srv.Store.Channel().GetAll(team.Id); result.Err != nil {
			CommandPrintErrorln("Unable to list channels for '" + args[i] + "'")
		} else {
			channels := result.Data.([]*model.Channel)

			for _, channel := range channels {
				if channel.DeleteAt > 0 {
					CommandPrettyPrintln(channel.Name + " (archived)")
				} else {
					CommandPrettyPrintln(channel.Name)
				}
			}
		}
	}

	return nil
}

func restoreChannelsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Enter at least one channel.")
	}

	channels := getChannelsFromChannelArgs(a, args)
	for i, channel := range channels {
		if channel == nil {
			CommandPrintErrorln("Unable to find channel '" + args[i] + "'")
			continue
		}
		if result := <-a.Srv.Store.Channel().SetDeleteAt(channel.Id, 0, model.GetMillis()); result.Err != nil {
			CommandPrintErrorln("Unable to restore channel '" + args[i] + "'")
		}
	}

	return nil
}

func modifyChannelCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) != 1 {
		return errors.New("Enter at one channel to modify.")
	}

	username, erru := command.Flags().GetString("username")
	if erru != nil || username == "" {
		return errors.New("Username is required.")
	}

	public, _ := command.Flags().GetBool("public")
	private, _ := command.Flags().GetBool("private")

	if public == private {
		return errors.New("You must specify only one of --public or --private")
	}

	channel := getChannelFromChannelArg(a, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	if !(channel.Type == model.CHANNEL_OPEN || channel.Type == model.CHANNEL_PRIVATE) {
		return errors.New("You can only change the type of public/private channels.")
	}

	channel.Type = model.CHANNEL_OPEN
	if private {
		channel.Type = model.CHANNEL_PRIVATE
	}

	user := getUserFromUserArg(a, username)
	if _, err := a.UpdateChannelPrivacy(channel, user); err != nil {
		return errors.Wrapf(err, "Failed to update channel ('%s') privacy", args[0])
	}

	return nil
}

func renameChannelCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	var newDisplayName, newChannelName string
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 2 {
		return errors.New("Not enough arguments.")
	}

	channel := getChannelFromChannelArg(a, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	newChannelName = args[1]
	newDisplayName, errdn := command.Flags().GetString("display_name")
	if errdn != nil {
		return errdn
	}

	_, errch := a.RenameChannel(channel, newChannelName, newDisplayName)
	if errch != nil {
		return errors.Wrapf(errch, "Error in updating channel from %s to %s", channel.Name, newChannelName)
	}

	return nil
}
