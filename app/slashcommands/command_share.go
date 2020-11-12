// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"fmt"
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

type ShareProvider struct {
}

const (
	CommandTriggerShare   = "share"
	AvailableShareActions = "Available actions: share_channel, unshare_channel, invite_remove, uninvite_remote, status"
)

func init() {
	app.RegisterCommandProvider(&ShareProvider{})
}

func (sp *ShareProvider) GetTrigger() string {
	return CommandTriggerShare
}

func (sp *ShareProvider) GetCommand(a *app.App, T goi18n.TranslateFunc) *model.Command {
	share := model.NewAutocompleteData(CommandTriggerShare, "[action]", "Available commands: share_channel, unshare_channel, invite_remote, uninvite_remote, status")

	shareChannel := model.NewAutocompleteData("share_channel", "", "Share the current channel")
	shareChannel.AddNamedTextArgument("readonly", "Channel will be shared in read-only mode", "[readonly] - 'Y' or 'N'.  Defaults to 'N'", "Y|N|y|n", false)
	shareChannel.AddNamedTextArgument("name", "Channel name provided to remote instances", "[name] - defaults to channel name", "", false)
	shareChannel.AddNamedTextArgument("displayname", "Channel display name provided to remote instances", "[displayname] - defaults to channel displayname", "", false)
	shareChannel.AddNamedTextArgument("purpose", "Channel purpose provided to remote instances", "[purpose] - defaults to channel purpose", "", false)
	shareChannel.AddNamedTextArgument("header", "Channel header provided to remote instances", "[header] - defaults to channels header", "", false)

	unshareChannel := model.NewAutocompleteData("unshare_channel", "", "Unshares the current channel")
	unshareChannel.AddNamedTextArgument("are_you_sure", "Are you sure? This channel will be unshared and all remote instances will be uninvited", "'Y' or 'N'", "Y|N|y|n", true)

	inviteRemote := model.NewAutocompleteData("invite_remote", "", "Invites a remote instance to the current shared channel")
	inviteRemote.AddNamedDynamicListArgument("remoteId", "Id of an existing remote instance. See `remote` command to add a remote instance.", "builtin:share", true)
	inviteRemote.AddNamedTextArgument("description", "Description for invite", "[description] - optional", "", false)

	unInviteRemote := model.NewAutocompleteData("uninvite_remote", "", "Uninvites a remote instance from this shared channel")
	unInviteRemote.AddNamedDynamicListArgument("remoteId", "Id of remote instance to uninvite.", "builtin:share", true)

	status := model.NewAutocompleteData("status", "", "Displays status for this shared channel")

	share.AddCommand(shareChannel)
	share.AddCommand(unshareChannel)
	share.AddCommand(inviteRemote)
	share.AddCommand(unInviteRemote)
	share.AddCommand(status)

	return &model.Command{
		Trigger:          CommandTriggerShare,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_share.desc"),
		AutoCompleteHint: T("api.command_share.hint"),
		DisplayName:      T("api.command_share.name"),
		AutocompleteData: share,
	}
}

func (sp *ShareProvider) GetAutoCompleteListItems(a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg, parsed, toBeParsed string) ([]model.AutocompleteListItem, error) {
	switch {
	case strings.Contains(parsed, " share_channel "):

		return sp.getAutoCompleteShareChannel(a, commandArgs, arg)

	case strings.Contains(parsed, " invite_remote "):

		return sp.getAutoCompleteInviteRemote(a, commandArgs, arg)

	case strings.Contains(parsed, " uninvite_remote "):

		return sp.getAutoCompleteUnInviteRemote(a, commandArgs, arg)

	}
	return nil, errors.New("invalid action")
}

func (sp *ShareProvider) getAutoCompleteShareChannel(a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg) ([]model.AutocompleteListItem, error) {
	channel, err := a.GetChannel(commandArgs.ChannelId)
	if err != nil {
		return nil, err
	}

	var item model.AutocompleteListItem

	switch arg.Name {
	case "name":
		item = model.AutocompleteListItem{
			Item:     channel.Name,
			HelpText: channel.DisplayName,
		}
	case "displayname":
		item = model.AutocompleteListItem{
			Item:     channel.DisplayName,
			HelpText: channel.Name,
		}
	default:
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
	return []model.AutocompleteListItem{item}, nil
}

func (sp *ShareProvider) getAutoCompleteInviteRemote(a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg) ([]model.AutocompleteListItem, error) {
	switch arg.Name {
	case "remoteId":
		return getRemoteClusterAutocompleteListItemsNotInChannel(a, commandArgs.ChannelId, true)
	default:
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
}

func (sp *ShareProvider) getAutoCompleteUnInviteRemote(a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg) ([]model.AutocompleteListItem, error) {
	switch arg.Name {
	case "remoteId":
		return getRemoteClusterAutocompleteListItems(a, true)
	default:
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
}

func (sp *ShareProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.HasPermissionTo(args.UserId, model.PERMISSION_MANAGE_SHARED_CHANNELS) {
		return responsef("You require `manage_shared_channels` permission to manage shared channels.")
	}

	margs := parseNamedArgs(args.Command)
	action, ok := margs[ActionKey]
	if !ok {
		return responsef("Missing command. " + AvailableShareActions)
	}

	switch action {
	case "share_channel":
		return sp.doShareChannel(a, args, margs)
	case "unshare_channel":
		return sp.doUnshareChannel(a, args, margs)
	case "invite_remote":
		return sp.doInviteRemote(a, args, margs)
	case "uninvite_remote":
		return sp.doUninviteRemote(a, args, margs)
	case "status":
		return sp.doStatus(a, args, margs)
	}
	return responsef("Unknown action `%s`. %s", action, AvailableRemoteActions)
}

func (sp *ShareProvider) doShareChannel(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	// check that channel exists.
	channel, errApp := a.GetChannel(args.ChannelId)
	if errApp != nil {
		return responsef("Cannot share this channel: %v", errApp)
	}

	if name := margs["name"]; name == "" {
		margs["name"] = channel.Name
	}
	if name := margs["displayname"]; name == "" {
		margs["displayname"] = channel.DisplayName
	}
	if name := margs["purpose"]; name == "" {
		margs["purpose"] = channel.Purpose
	}
	if name := margs["header"]; name == "" {
		margs["header"] = channel.Header
	}
	if _, ok := margs["readonly"]; !ok {
		margs["readonly"] = "N"
	}

	readonly, err := parseBool(margs["readonly"])
	if err != nil {
		return responsef("Invalid value for 'readonly': %v", err)
	}

	sc := &model.SharedChannel{
		ChannelId:        args.ChannelId,
		TeamId:           args.TeamId,
		Home:             true,
		ReadOnly:         readonly,
		ShareName:        margs["name"],
		ShareDisplayName: margs["displayname"],
		SharePurpose:     margs["purpose"],
		ShareHeader:      margs["header"],
		CreatorId:        args.UserId,
	}

	if _, err := a.SaveSharedChannel(sc); err != nil {
		return responsef("Could not share this channel: %v", err)
	}
	return responsef("##### This channel is now shared.")
}

func (sp *ShareProvider) doUnshareChannel(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	if _, ok := margs["are_you_sure"]; !ok {
		margs["are_you_sure"] = "N"
	}

	sure, err := parseBool(margs["are_you_sure"])
	if err != nil || !sure {
		return responsef("Shared channel was not deleted: `are_you_sure` must be `Y`.")
	}

	deleted, err := a.DeleteSharedChannel(args.ChannelId)
	if err != nil {
		return responsef("Could not unshare this channel: %v", err)
	}
	if !deleted {
		return responsef("Cannot unshare a channel that is not shared.")
	}
	return responsef("##### This channel is no longer shared.")
}

func (sp *ShareProvider) doInviteRemote(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	remoteId, ok := margs["remoteId"]
	if !ok || remoteId == "" {
		return responsef("Must specify a valid remote cluster id to invite.")
	}

	remote, err := a.GetRemoteCluster(remoteId)
	if err != nil {
		return responsef("Remote cluster id is invalid: %v", err)
	}

	scr := &model.SharedChannelRemote{
		ChannelId:       args.ChannelId,
		Token:           model.NewId(),
		Description:     margs["description"],
		CreatorId:       args.UserId,
		RemoteClusterId: remoteId,
	}

	if _, err := a.SaveSharedChannelRemote(scr); err != nil {
		return responsef("Could not invite `%s` to this channel: %v", remote.ClusterName, err)
	}

	return responsef("##### `%s (%s:%d)` has been invited to this shared channel.", remote.ClusterName, remote.Hostname, remote.Port)
}

func (sp *ShareProvider) doUninviteRemote(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	remoteId, ok := margs["remoteId"]
	if !ok || remoteId == "" {
		return responsef("Must specify a valid remote cluster to uninvite.")
	}

	scr, err := a.GetSharedChannelRemote(remoteId)
	if err != nil || scr.ChannelId != args.ChannelId {
		return responsef("Shared channel remote id `%s` does not exist for this channel.", remoteId)
	}

	deleted, err := a.DeleteSharedChannelRemote(remoteId)
	if err != nil || !deleted {
		return responsef("Could not uninvite `%s`: %v", remoteId, err)
	}
	return responsef("##### Remote `%s` uninvited.", remoteId)
}

func (sp *ShareProvider) doStatus(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	statuses, err := a.GetSharedChannelRemotesStatus(args.ChannelId)
	if err != nil {
		return responsef("Could not fetch status for remotes: %v.", err)
	}
	if len(statuses) == 0 {
		return responsef("No remotes have been invited to this shared channel.")
	}

	var sb strings.Builder

	fmt.Fprintf(&sb, "Status for channel Id `%s`\n\n", statuses[0].ChannelId)

	fmt.Fprintf(&sb, "| Remote | Host | Description | ReadOnly | InviteAccepted | Online | Token |\n")
	fmt.Fprintf(&sb, "| ------ | ---- | ----------- | -------- | -------------- | ------ | ----- |\n")

	for _, status := range statuses {
		online := ":white_check_mark:"
		if !isOnline(status.LastPingAt) {
			online = ":skull_and_crossbones:"
		}
		fmt.Fprintf(&sb, "| %s | %s:%d | %s | %t | %t | %s | %s |\n",
			status.ClusterName, status.Hostname, status.Port, status.Description,
			status.ReadOnly, status.IsInviteAccepted, online, status.Token)
	}
	return responsef(sb.String())
}
