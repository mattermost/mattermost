// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"errors"
	"fmt"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/spf13/cobra"
)

var channelCmd = &cobra.Command{
	Use:   "channel",
	Short: "Management of channels",
}

var channelCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a channel",
	Long:  `Create a channel.`,
	Example: `  channel create --team myteam --name mynewchannel --display_name "My New Channel"
  channel create --team myteam --name mynewprivatechannel --display_name "My New Private Channel" --private`,
	RunE: createChannelCmdF,
}

var removeChannelUsersCmd = &cobra.Command{
	Use:     "remove [channel] [users]",
	Short:   "Remove users from channel",
	Long:    "Remove some users from channel",
	Example: "  channel remove mychannel user@example.com username",
	RunE:    removeChannelUsersCmdF,
}

var addChannelUsersCmd = &cobra.Command{
	Use:     "add [channel] [users]",
	Short:   "Add users to channel",
	Long:    "Add some users to channel",
	Example: "  channel add mychannel user@example.com username",
	RunE:    addChannelUsersCmdF,
}

var archiveChannelsCmd = &cobra.Command{
	Use:   "archive [channels]",
	Short: "Archive channels",
	Long: `Archive some channels.
Archive a channel along with all related information including posts from the database.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel archive myteam:mychannel",
	RunE:    archiveChannelsCmdF,
}

var deleteChannelsCmd = &cobra.Command{
	Use:   "delete [channels]",
	Short: "Delete channels",
	Long: `Permanently delete some channels.
Permanently deletes a channel along with all related information including posts from the database.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel delete myteam:mychannel",
	RunE:    deleteChannelsCmdF,
}

var listChannelsCmd = &cobra.Command{
	Use:   "list [teams]",
	Short: "List all channels on specified teams.",
	Long: `List all channels on specified teams.
Archived channels are appended with ' (archived)'.`,
	Example: "  channel list myteam",
	RunE:    listChannelsCmdF,
}

var restoreChannelsCmd = &cobra.Command{
	Use:   "restore [channels]",
	Short: "Restore some channels",
	Long: `Restore a previously deleted channel
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: "  channel restore myteam:mychannel",
	RunE:    restoreChannelsCmdF,
}

func init() {
	channelCreateCmd.Flags().String("name", "", "Channel Name")
	channelCreateCmd.Flags().String("display_name", "", "Channel Display Name")
	channelCreateCmd.Flags().String("team", "", "Team name or ID")
	channelCreateCmd.Flags().String("header", "", "Channel header")
	channelCreateCmd.Flags().String("purpose", "", "Channel purpose")
	channelCreateCmd.Flags().Bool("private", false, "Create a private channel.")

	deleteChannelsCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the channels.")

	channelCmd.AddCommand(
		channelCreateCmd,
		removeChannelUsersCmd,
		addChannelUsersCmd,
		archiveChannelsCmd,
		deleteChannelsCmd,
		listChannelsCmd,
		restoreChannelsCmd,
	)
}

func createChannelCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	if !utils.IsLicensed {
		return errors.New(utils.T("cli.license.critical"))
	}

	name, errn := cmd.Flags().GetString("name")
	if errn != nil || name == "" {
		return errors.New("Name is required")
	}
	displayname, errdn := cmd.Flags().GetString("display_name")
	if errdn != nil || displayname == "" {
		return errors.New("Display Name is required")
	}
	teamArg, errteam := cmd.Flags().GetString("team")
	if errteam != nil || teamArg == "" {
		return errors.New("Team is required")
	}
	header, _ := cmd.Flags().GetString("header")
	purpose, _ := cmd.Flags().GetString("purpose")
	useprivate, _ := cmd.Flags().GetBool("private")

	channelType := model.CHANNEL_OPEN
	if useprivate {
		channelType = model.CHANNEL_PRIVATE
	}

	team := getTeamFromTeamArg(teamArg)
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

	if _, err := app.CreateChannel(channel, false); err != nil {
		return err
	}

	return nil
}

func removeChannelUsersCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	if !utils.IsLicensed {
		return errors.New(utils.T("cli.license.critical"))
	}

	if len(args) < 2 {
		return errors.New("Not enough arguments.")
	}

	channel := getChannelFromChannelArg(args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	users := getUsersFromUserArgs(args[1:])
	for i, user := range users {
		removeUserFromChannel(channel, user, args[i+1])
	}

	return nil
}

func removeUserFromChannel(channel *model.Channel, user *model.User, userArg string) {
	if user == nil {
		CommandPrintErrorln("Can't find user '" + userArg + "'")
		return
	}
	if err := app.RemoveUserFromChannel(user.Id, "", channel); err != nil {
		CommandPrintErrorln("Unable to remove '" + userArg + "' from " + channel.Name + ". Error: " + err.Error())
	}
}

func addChannelUsersCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	if !utils.IsLicensed {
		return errors.New(utils.T("cli.license.critical"))
	}

	if len(args) < 2 {
		return errors.New("Not enough arguments.")
	}

	channel := getChannelFromChannelArg(args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	users := getUsersFromUserArgs(args[1:])
	for i, user := range users {
		addUserToChannel(channel, user, args[i+1])
	}

	return nil
}

func addUserToChannel(channel *model.Channel, user *model.User, userArg string) {
	if user == nil {
		CommandPrintErrorln("Can't find user '" + userArg + "'")
		return
	}
	if _, err := app.AddUserToChannel(user, channel); err != nil {
		CommandPrintErrorln("Unable to add '" + userArg + "' from " + channel.Name + ". Error: " + err.Error())
	}
}

func archiveChannelsCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Enter at least one channel to archive.")
	}

	channels := getChannelsFromChannelArgs(args)
	for i, channel := range channels {
		if channel == nil {
			CommandPrintErrorln("Unable to find channel '" + args[i] + "'")
			continue
		}
		if result := <-app.Srv.Store.Channel().Delete(channel.Id, model.GetMillis()); result.Err != nil {
			CommandPrintErrorln("Unable to archive channel '" + channel.Name + "' error: " + result.Err.Error())
		}
	}

	return nil
}

func deleteChannelsCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	if len(args) < 1 {
		return errors.New("Enter at least one channel to delete.")
	}

	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		var confirm string
		CommandPrettyPrintln("Are you sure you want to delete the channels specified?  All data will be permanently deleted? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	channels := getChannelsFromChannelArgs(args)
	for i, channel := range channels {
		if channel == nil {
			CommandPrintErrorln("Unable to find channel '" + args[i] + "'")
			continue
		}
		if err := deleteChannel(channel); err != nil {
			CommandPrintErrorln("Unable to delete channel '" + channel.Name + "' error: " + err.Error())
		} else {
			CommandPrettyPrintln("Deleted channel '" + channel.Name + "'")
		}
	}

	return nil
}

func deleteChannel(channel *model.Channel) *model.AppError {
	return app.PermanentDeleteChannel(channel)
}

func listChannelsCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	if !utils.IsLicensed {
		return errors.New(utils.T("cli.license.critical"))
	}

	if len(args) < 1 {
		return errors.New("Enter at least one team.")
	}

	teams := getTeamsFromTeamArgs(args)
	for i, team := range teams {
		if team == nil {
			CommandPrintErrorln("Unable to find team '" + args[i] + "'")
			continue
		}
		if result := <-app.Srv.Store.Channel().GetAll(team.Id); result.Err != nil {
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

func restoreChannelsCmdF(cmd *cobra.Command, args []string) error {
	if err := initDBCommandContextCobra(cmd); err != nil {
		return err
	}

	if !utils.IsLicensed {
		return errors.New(utils.T("cli.license.critical"))
	}

	if len(args) < 1 {
		return errors.New("Enter at least one channel.")
	}

	channels := getChannelsFromChannelArgs(args)
	for i, channel := range channels {
		if channel == nil {
			CommandPrintErrorln("Unable to find channel '" + args[i] + "'")
			continue
		}
		if result := <-app.Srv.Store.Channel().SetDeleteAt(channel.Id, 0, model.GetMillis()); result.Err != nil {
			CommandPrintErrorln("Unable to restore channel '" + args[i] + "'")
		}
	}

	return nil
}
