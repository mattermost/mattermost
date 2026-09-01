// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-multierror"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var ChannelUsersCmd = &cobra.Command{
	Use:   "users",
	Short: "Management of channel users",
}

var ChannelUsersAddCmd = &cobra.Command{
	Use:     "add [channel] [users]",
	Short:   "Add users to channel",
	Long:    "Add some users to channel",
	Example: "  channel users add myteam:mychannel user@example.com username",
	RunE:    withClient(channelUsersAddCmdF),
}

var ChannelUsersRemoveCmd = &cobra.Command{
	Use:   "remove [channel] [users]",
	Short: "Remove users from channel",
	Long:  "Remove some users from channel",
	Example: `  channel users remove myteam:mychannel user@example.com username
  channel users remove myteam:mychannel --all-users`,
	RunE: withClient(channelUsersRemoveCmdF),
}

var ChannelUsersListCmd = &cobra.Command{
	Use:   "list [channel]",
	Short: "List users of a channel",
	Long:  "List the users belonging to a channel, printing each member's id, username, email and roles",
	Example: `  channel users list myteam:mychannel
  channel users list myteam:mychannel --all`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(channelUsersListCmdF),
}

func init() {
	ChannelUsersRemoveCmd.Flags().Bool("all-users", false, "Remove all users from the indicated channel.")

	ChannelUsersListCmd.Flags().Int("page", 0, "Page number to fetch for the list of channel users")
	ChannelUsersListCmd.Flags().Int("per-page", DefaultPageSize, "Number of channel users to be fetched")
	ChannelUsersListCmd.Flags().Bool("all", false, "Fetch all channel users. --page flag will be ignored if provided")

	ChannelUsersCmd.AddCommand(
		ChannelUsersAddCmd,
		ChannelUsersRemoveCmd,
		ChannelUsersListCmd,
	)

	ChannelCmd.AddCommand(ChannelUsersCmd)
}

func channelUsersAddCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if len(args) < 2 {
		return errors.New("not enough arguments")
	}

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.Errorf("unable to find channel %q", args[0])
	}

	var result *multierror.Error
	users := getUsersFromUserArgs(c, args[1:])
	for i, user := range users {
		err := addUserToChannel(c, channel, user, args[i+1])
		if err != nil {
			printer.PrintError(err.Error())
			result = multierror.Append(result, err)
		}
	}

	return result.ErrorOrNil()
}

func addUserToChannel(c client.Client, channel *model.Channel, user *model.User, userArg string) error {
	if user == nil {
		return fmt.Errorf("unable to find user %q", userArg)
	}
	if _, _, err := c.AddChannelMember(context.TODO(), channel.Id, user.Id); err != nil {
		return fmt.Errorf("unable to add %q to %q. Error: %w", userArg, channel.Name, err)
	}
	return nil
}

func channelUsersRemoveCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	allUsers, _ := cmd.Flags().GetBool("all-users")

	if allUsers && len(args) != 1 {
		return errors.New("individual users must not be specified in conjunction with the --all-users flag")
	}

	if !allUsers && len(args) < 2 {
		return errors.New("you must specify some users to remove from the channel, or use the --all-users flag to remove them all")
	}

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.Errorf("unable to find channel %q", args[0])
	}

	var result *multierror.Error
	if allUsers {
		if err := removeAllUsersFromChannel(c, channel); err != nil {
			return err
		}
	} else {
		for i, user := range getUsersFromUserArgs(c, args[1:]) {
			err := removeUserFromChannel(c, channel, user, args[i+1])
			if err != nil {
				printer.PrintError(err.Error())
				result = multierror.Append(result, err)
			}
		}
	}

	return result.ErrorOrNil()
}

func removeUserFromChannel(c client.Client, channel *model.Channel, user *model.User, userArg string) error {
	if user == nil {
		return fmt.Errorf("unable to find user %q", userArg)
	}
	if _, err := c.RemoveUserFromChannel(context.TODO(), channel.Id, user.Id); err != nil {
		return fmt.Errorf("unable to remove %q from %q. Error: %w", userArg, channel.Name, err)
	}
	return nil
}

func removeAllUsersFromChannel(c client.Client, channel *model.Channel) error {
	var result *multierror.Error
	members, _, err := c.GetChannelMembers(context.TODO(), channel.Id, 0, 10000, "")
	if err != nil {
		printer.PrintError("Unable to remove all users from " + channel.Name + ". Error: " + err.Error())
		return fmt.Errorf("unable to remove all users from %q: %w", channel.Name, err)
	}

	for _, member := range members {
		if _, err := c.RemoveUserFromChannel(context.TODO(), channel.Id, member.UserId); err != nil {
			result = multierror.Append(result, fmt.Errorf("unable to remove %q from %q Error: %w", member.UserId, channel.Name, err))
			printer.PrintError("Unable to remove '" + member.UserId + "' from " + channel.Name + ". Error: " + err.Error())
		}
	}

	return result.ErrorOrNil()
}

// channelUserOut is the output format for a channel member, combining the
// channel membership roles with the user's identifying details.
type channelUserOut struct {
	Id       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Roles    string `json:"roles"`
}

func channelUsersListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.Errorf("unable to find channel %q", args[0])
	}

	all, _ := cmd.Flags().GetBool("all")
	perPage, _ := cmd.Flags().GetInt("per-page")

	var members model.ChannelMembers
	if all {
		var err error
		members, err = getPages(func(page, perPage int, etag string) ([]model.ChannelMember, *model.Response, error) {
			return c.GetChannelMembers(context.TODO(), channel.Id, page, perPage, etag)
		}, perPage)
		if err != nil {
			return errors.Errorf("unable to list users of channel %q: %s", channel.Name, err.Error())
		}
	} else {
		page, _ := cmd.Flags().GetInt("page")
		var err error
		members, _, err = c.GetChannelMembers(context.TODO(), channel.Id, page, perPage, "")
		if err != nil {
			return errors.Errorf("unable to list users of channel %q: %s", channel.Name, err.Error())
		}
	}

	if len(members) == 0 {
		printer.Print("No users found")
		return nil
	}

	userIDs := make([]string, len(members))
	for i := range members {
		userIDs[i] = members[i].UserId
	}

	users, _, err := c.GetUsersByIds(context.TODO(), userIDs)
	if err != nil {
		return errors.Errorf("unable to retrieve user details for channel %q: %s", channel.Name, err.Error())
	}

	usersByID := make(map[string]*model.User, len(users))
	for _, user := range users {
		usersByID[user.Id] = user
	}

	for _, member := range members {
		out := channelUserOut{
			Id:    member.UserId,
			Roles: member.Roles,
		}
		if user, ok := usersByID[member.UserId]; ok {
			out.Username = user.Username
			out.Email = user.Email
		}
		printer.PrintT("{{.Id}}: {{.Username}} ({{.Email}}) {{.Roles}}", out)
	}

	return nil
}
