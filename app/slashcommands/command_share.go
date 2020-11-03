// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"fmt"

	goi18n "github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

type ShareProvider struct {
}

const (
	CommandTriggerShare = "share"
)

func init() {
	app.RegisterCommandProvider(&ShareProvider{})
}

func (me *ShareProvider) GetTrigger() string {
	return CommandTriggerShare
}

func (me *ShareProvider) GetCommand(a *app.App, T goi18n.TranslateFunc) *model.Command {
	share := model.NewAutocompleteData(CommandTriggerShare, "[command]", "Available commands: share_channel, unshare_channel, invite_remote, uninvite_remote, status")

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

	unInviteRemote := model.NewAutocompleteData("uninvite_remote", "", "Uninvites a remote instance from this shared channel")
	unInviteRemote.AddNamedDynamicListArgument("remoteId", "Id of remote instance to uninvite.", "builtin:share", true)

	share.AddCommand(shareChannel)
	share.AddCommand(unshareChannel)
	share.AddCommand(inviteRemote)
	share.AddCommand(unInviteRemote)

	return &model.Command{
		Trigger:          CommandTriggerShare,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_share.desc"),
		AutoCompleteHint: T("api.command_share.hint"),
		DisplayName:      T("api.command_share.name"),
		AutocompleteData: share,
	}
}

func (me *ShareProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	return &model.CommandResponse{
		Text:         "I do nothing!",
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
	}
}

func (me *ShareProvider) GetAutoCompleteListItems(commandArgs *model.CommandArgs, arg *model.AutocompleteArg, parsed, toBeParsed string) ([]model.AutocompleteListItem, error) {

	if arg.Name == "remoteId" {

		return []model.AutocompleteListItem{
			{Item: "item1", Hint: "this is hint 1", HelpText: "This is help text 1."},
			{Item: "item2", Hint: "this is hint 2", HelpText: "This is help text 2."},
			{Item: "item3", Hint: "this is hint 3", HelpText: "This is help text 3."},
		}, nil

	}

	return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
}
