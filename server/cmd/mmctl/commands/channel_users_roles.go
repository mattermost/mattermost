// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"reflect"
	"strings"

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
  channel users roles add myteam:mychannel user@example.com,user1@example.com role_name_a,role_name_b`,
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

	rolesStr := args[2]
	rolesToAssign := strings.Split(rolesStr, ",")

	availableSchems := []string{}
	schemeRole := model.SchemeRoles{}
	srt := reflect.TypeOf(schemeRole)
	for i := 0; i < srt.NumField(); i++ {
		field := srt.Field(i)
		availableSchems = append(availableSchems, field.Tag.Get("json"))
	}

	for _, role := range rolesToAssign {

		found := false
		for _, scheme := range availableSchems {
			if scheme == role {
				found = true
			}
		}

		if !found {
			return errors.Errorf("Role doesn't exist: ", role)
		}
	}

	return nil
}
