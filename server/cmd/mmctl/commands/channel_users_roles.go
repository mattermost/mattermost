// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
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
	Short: "Give user(s) role(s) in a channel",
	Long:  "Give user(s) role(s) in a channel",
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
		return errors.New("Not enough arguments")
	}

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.Errorf("Unable to find channel %q", args[0])
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
			return errors.Errorf("Role doesn't exist: %s", role)
		}
	}

	emailsStr := args[1]
	emails := strings.Split(emailsStr, ",")

	// Validate if user is a member of channel
	userIds := []string{}
	var multiErrors *multierror.Error

	for _, email := range emails {
		user, _, err := c.GetUserByEmail(context.TODO(), email, "")

		if err != nil {
			multiErrors = multierror.Append(multiErrors, err)
			continue
		}

		userIds = append(userIds, user.Id)

		_, _, err = c.GetChannelMember(context.TODO(), channel.Id, user.Id, "")
		if err != nil {
			multiErrors = multierror.Append(multiErrors, err)
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

	return nil
}
