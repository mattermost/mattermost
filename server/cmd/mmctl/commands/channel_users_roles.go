// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var ChannelUsersRolesCmd = &cobra.Command{
	Use:   "roles",
	Short: "Management of channel users",
}

var ChannelUsersRolesAddCmd = &cobra.Command{
	Use:   "add [team]:[channel]",
	Short: "Assigns the specified role(s) to the listed user(s) in a channel, removing any unlisted roles.",
	Long:  "This command assigns the specified role(s) to the listed user(s) in a given channel. Any roles that are not explicitly listed in the command will be removed from the affected users, ensuring that they only retain the specified roles.",
	Example: `  channel users roles add myteam:mychannel userA,userB roleA,roleB
  Ex: channel users roles add myteam:mychannel user@example.com,user1@example.com scheme_admin,scheme_user
  Roles available: scheme_admin,scheme_user,scheme_guest`,
	RunE: withClient(channelUsersRolesAddCmdF),
}

func init() {
	ChannelUsersRolesCmd.AddCommand(
		ChannelUsersRolesAddCmd,
	)

	ChannelUsersCmd.AddCommand(ChannelUsersRolesCmd)
}

func channelUsersRolesAddCmdF(c client.Client, cmd *cobra.Command, args []string) error {

	if len(args) < 3 {
		return errors.New("not enough arguments")
	}

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.Errorf("unable to find channel %s", args[0])
	}

	// Store roles
	isAdmin := false
	isUser := false
	isGuest := false

	// Validate roles
	rolesStr := args[2]
	rolesToAssign := strings.Split(rolesStr, ",")

	for _, role := range rolesToAssign {
		switch role {
		case "scheme_admin":
			isAdmin = true
		case "scheme_user":
			isUser = true
		case "scheme_guest":
			isGuest = true
		default:
			return errors.Errorf("role doesn't exist: %s", role)
		}
	}

	emailsStr := args[1]
	emails := strings.Split(emailsStr, ",")

	// Validate if user is a member of channel
	userIds := []string{}
	var multiErrors *multierror.Error

	for _, email := range emails {
		user, _, _ := c.GetUserByEmail(context.TODO(), email, "")

		if user == nil {
			multiErrors = multierror.Append(multiErrors, errors.Errorf("user doesn't exist: %s", email))
			continue
		}

		userIds = append(userIds, user.Id)

		chanMem, _, _ := c.GetChannelMember(context.TODO(), channel.Id, user.Id, "")

		if chanMem == nil {
			multiErrors = multierror.Append(multiErrors, errors.Errorf("user is not member of channel: %s", email))
			continue
		}
	}

	if len(multiErrors.WrappedErrors()) > 0 {
		return multiErrors.ErrorOrNil()
	}

	// Update roles for each user
	schemeRole := model.SchemeRoles{
		SchemeAdmin: isAdmin,
		SchemeUser:  isUser,
		SchemeGuest: isGuest,
	}

	for _, userId := range userIds {
		_, err := c.UpdateChannelMemberSchemeRoles(context.TODO(), channel.Id, userId, &schemeRole)

		if err != nil {
			return err
		}
	}

	printer.Print("Successfully updated member roles")
	return nil
}
