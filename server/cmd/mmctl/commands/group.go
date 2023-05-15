// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var GroupCmd = &cobra.Command{
	Use:   "group",
	Short: "Management of groups",
}

var ListLdapGroupsCmd = &cobra.Command{
	Use:     "list-ldap",
	Short:   "List LDAP groups",
	Example: "  group list-ldap",
	Args:    cobra.NoArgs,
	RunE:    withClient(listLdapGroupsCmdF),
}

var ChannelGroupCmd = &cobra.Command{
	Use:   "channel",
	Short: "Management of channel groups",
}

var ChannelGroupEnableCmd = &cobra.Command{
	Use:     "enable [team]:[channel]",
	Short:   "Enables group constrains in the specified channel",
	Example: "  group channel enable myteam:mychannel",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(channelGroupEnableCmdF),
}

var ChannelGroupDisableCmd = &cobra.Command{
	Use:     "disable [team]:[channel]",
	Short:   "Disables group constrains in the specified channel",
	Example: "  group channel disable myteam:mychannel",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(channelGroupDisableCmdF),
}

// ChannelGroupStatusCmd is a command which outputs group constrain status for a channel
var ChannelGroupStatusCmd = &cobra.Command{
	Use:     "status [team]:[channel]",
	Short:   "Show's the group constrain status for the specified channel",
	Example: "  group channel status myteam:mychannel",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(channelGroupStatusCmdF),
}

var ChannelGroupListCmd = &cobra.Command{
	Use:     "list [team]:[channel]",
	Short:   "List channel groups",
	Long:    "List the groups associated with a channel",
	Example: "  group channel list myteam:mychannel",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(channelGroupListCmdF),
}

var TeamGroupCmd = &cobra.Command{
	Use:   "team",
	Short: "Management of team groups",
}

var TeamGroupEnableCmd = &cobra.Command{
	Use:     "enable [team]",
	Short:   "Enables group constrains in the specified team",
	Example: "  group team enable myteam",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(teamGroupEnableCmdF),
}

var TeamGroupDisableCmd = &cobra.Command{
	Use:     "disable [team]",
	Short:   "Disables group constrains in the specified team",
	Example: "  group team disable myteam",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(teamGroupDisableCmdF),
}

var TeamGroupStatusCmd = &cobra.Command{
	Use:     "status [team]",
	Short:   "Show's the group constrain status for the specified team",
	Example: "  group team status myteam",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(teamGroupStatusCmdF),
}

var TeamGroupListCmd = &cobra.Command{
	Use:     "list [team]",
	Short:   "List team groups",
	Long:    "List the groups associated with a team",
	Example: "  group team list myteam",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(teamGroupListCmdF),
}

var UserGroupCmd = &cobra.Command{
	Use:   "user",
	Short: "Management of custom user groups",
}

var UserGroupRestoreCmd = &cobra.Command{
	Use:     "restore [groupname]",
	Short:   "Restore user group",
	Long:    "Restore deleted custom user group",
	Example: " group user restore examplegroup",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(userGroupRestoreCmdF),
}

func init() {
	ChannelGroupCmd.AddCommand(
		ChannelGroupEnableCmd,
		ChannelGroupDisableCmd,
		ChannelGroupStatusCmd,
		ChannelGroupListCmd,
	)

	TeamGroupCmd.AddCommand(
		TeamGroupEnableCmd,
		TeamGroupDisableCmd,
		TeamGroupStatusCmd,
		TeamGroupListCmd,
	)

	UserGroupCmd.AddCommand(
		UserGroupRestoreCmd,
	)

	GroupCmd.AddCommand(
		ListLdapGroupsCmd,
		ChannelGroupCmd,
		TeamGroupCmd,
		UserGroupCmd,
	)

	RootCmd.AddCommand(GroupCmd)
}

func listLdapGroupsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	groups, _, err := c.GetLdapGroups()
	if err != nil {
		return err
	}

	for _, group := range groups {
		printer.PrintT("{{.DisplayName}}", group)
	}

	return nil
}

func channelGroupEnableCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	groupOpts := &model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 10,
		},
	}

	groups, _, _, err := c.GetGroupsByChannel(channel.Id, *groupOpts)
	if err != nil {
		return err
	}

	if len(groups) == 0 {
		return errors.New("Channel '" + args[0] + "' has no groups associated. It cannot be group-constrained")
	}

	channelPatch := model.ChannelPatch{GroupConstrained: model.NewBool(true)}
	if _, _, err = c.PatchChannel(channel.Id, &channelPatch); err != nil {
		return err
	}

	return nil
}

func channelGroupDisableCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	channelPatch := model.ChannelPatch{GroupConstrained: model.NewBool(false)}
	if _, _, err := c.PatchChannel(channel.Id, &channelPatch); err != nil {
		return err
	}

	return nil
}

func channelGroupStatusCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	if channel.GroupConstrained != nil && *channel.GroupConstrained {
		printer.Print("Enabled")
	} else {
		printer.Print("Disabled")
	}

	return nil
}

func channelGroupListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	groupOpts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 9999,
		},
	}
	groups, _, _, err := c.GetGroupsByChannel(channel.Id, groupOpts)
	if err != nil {
		return err
	}

	for _, group := range groups {
		printer.PrintT("{{.DisplayName}}", group)
	}

	return nil
}

func teamGroupEnableCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	groupOpts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 10,
		},
	}
	groups, _, _, err := c.GetGroupsByTeam(team.Id, groupOpts)
	if err != nil {
		return err
	}

	if len(groups) == 0 {
		return errors.New("Team '" + args[0] + "' has no groups associated. It cannot be group-constrained")
	}

	teamPatch := model.TeamPatch{GroupConstrained: model.NewBool(true)}
	if _, _, err = c.PatchTeam(team.Id, &teamPatch); err != nil {
		return err
	}

	return nil
}

func teamGroupDisableCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	teamPatch := model.TeamPatch{GroupConstrained: model.NewBool(false)}
	if _, _, err := c.PatchTeam(team.Id, &teamPatch); err != nil {
		return err
	}

	return nil
}

func teamGroupStatusCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	if team.GroupConstrained != nil && *team.GroupConstrained {
		printer.Print("Enabled")
	} else {
		printer.Print("Disabled")
	}

	return nil
}

func teamGroupListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	team := getTeamFromTeamArg(c, args[0])
	if team == nil {
		return errors.New("Unable to find team '" + args[0] + "'")
	}

	groupOpts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 9999,
		},
	}
	groups, _, _, err := c.GetGroupsByTeam(team.Id, groupOpts)
	if err != nil {
		return err
	}

	for _, group := range groups {
		printer.PrintT("{{.DisplayName}}", group)
	}

	return nil
}

func userGroupRestoreCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	groupID := args[0]
	_, resp, err := c.RestoreGroup(groupID, "")
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusOK {
		printer.Print("Group successfully restored with ID: " + groupID)
	}

	return nil
}
