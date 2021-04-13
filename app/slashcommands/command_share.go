// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

type ShareProvider struct {
}

const (
	CommandTriggerShare   = "share"
	AvailableShareActions = "share_channel, unshare_channel, invite_remove, uninvite_remote, status"
)

func init() {
	app.RegisterCommandProvider(&ShareProvider{})
}

func (sp *ShareProvider) GetTrigger() string {
	return CommandTriggerShare
}

func (sp *ShareProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	share := model.NewAutocompleteData(CommandTriggerShare, "[action]", T("api.command_share.available_actions", map[string]interface{}{"Actions": AvailableShareActions}))

	shareChannel := model.NewAutocompleteData("share_channel", "", T("api.command_share.share_current"))
	shareChannel.AddNamedTextArgument("readonly", T("api.command_share.share_read_only.help"), T("api.command_share.share_read_only.hint"), "Y|N|y|n", false)
	shareChannel.AddNamedTextArgument("name", T("api.command_share.channel_name.help"), T("api.command_share.channel_name.hint"), "", false)
	shareChannel.AddNamedTextArgument("displayname", T("api.command_share.channel_display_name.help"), T("api.command_share.channel_display_name.hint"), "", false)
	shareChannel.AddNamedTextArgument("purpose", T("api.command_share.channel_purpose.help"), T("api.command_share.channel_purpose.hint"), "", false)
	shareChannel.AddNamedTextArgument("header", T("api.command_share.channel_header.help"), T("api.command_share.channel_header.hint"), "", false)

	unshareChannel := model.NewAutocompleteData("unshare_channel", "", T("api.command_share.unshare_channel.help"))
	unshareChannel.AddNamedTextArgument("are_you_sure", T("api.command_share.unshare_confirmation.help"), T("api.command_share.unshare_confirmation.hint"), "Y|N|y|n", true)

	inviteRemote := model.NewAutocompleteData("invite_remote", "", T("api.command_share.invite_remote.help"))
	inviteRemote.AddNamedDynamicListArgument("remoteId", T("api.command_share.remote_id.help"), "builtin:share", true)
	inviteRemote.AddNamedTextArgument("description", T("api.command_share.description_invite.help"), T("api.command_share.description_invite.hint"), "", false)

	unInviteRemote := model.NewAutocompleteData("uninvite_remote", "", T("api.command_share.uninvite_remote.help"))
	unInviteRemote.AddNamedDynamicListArgument("remoteId", T("api.command_share.uninvite_remote_id.help"), "builtin:share", true)

	status := model.NewAutocompleteData("status", "", T("api.command_share.channel_status.help"))

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

func (sp *ShareProvider) getAutoCompleteUnInviteRemote(a *app.App, _ *model.CommandArgs, arg *model.AutocompleteArg) ([]model.AutocompleteListItem, error) {
	switch arg.Name {
	case "remoteId":
		return getRemoteClusterAutocompleteListItems(a, true)
	default:
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
}

func (sp *ShareProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.HasPermissionTo(args.UserId, model.PERMISSION_MANAGE_SHARED_CHANNELS) {
		return responsef(args.T("api.command_share.permission_required", map[string]interface{}{"Permission": "manage_shared_channels"}))
	}

	if a.Srv().GetSharedChannelSyncService() == nil {
		return responsef(args.T("api.command_share.service_disabled"))
	}

	if a.Srv().GetRemoteClusterService() == nil {
		return responsef(args.T("api.command_remote.service_disabled"))
	}

	margs := parseNamedArgs(args.Command)
	action, ok := margs[ActionKey]
	if !ok {
		return responsef(args.T("api.command_share.missing_action", map[string]interface{}{"Actions": AvailableShareActions}))
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
	return responsef(args.T("api.command_share.unknown_action", map[string]interface{}{"Action": action, "Actions": AvailableShareActions}))
}

func (sp *ShareProvider) doShareChannel(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	// check that channel exists.
	channel, errApp := a.GetChannel(args.ChannelId)
	if errApp != nil {
		return responsef(args.T("api.command_share.share_channel.error", map[string]interface{}{"Error": errApp.Error()}))
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
		return responsef(args.T("api.command_share.invalid_value.error", map[string]interface{}{"Arg": "readonly", "Error": err.Error()}))
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
		return responsef(args.T("api.command_share.share_channel.error", map[string]interface{}{"Error": err.Error()}))
	}

	notifyClientsForChannelUpdate(a, sc)

	return responsef("##### " + args.T("api.command_share.channel_shared"))
}

func (sp *ShareProvider) doUnshareChannel(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	if _, ok := margs["are_you_sure"]; !ok {
		margs["are_you_sure"] = "N"
	}

	sure, err := parseBool(margs["are_you_sure"])
	if err != nil || !sure {
		return responsef(args.T("api.command_share.shared_channel_not_deleted", map[string]interface{}{"Arg": "are_you_sure", "Expected": "Y"}))
	}

	sc, appErr := a.GetSharedChannel(args.ChannelId)
	if appErr != nil {
		return responsef(args.T("api.command_share.shared_channel_unshare.error", map[string]interface{}{"Error": appErr.Error()}))
	}

	deleted, err := a.DeleteSharedChannel(args.ChannelId)
	if err != nil {
		return responsef(args.T("api.command_share.shared_channel_unshare.error", map[string]interface{}{"Error": err.Error()}))
	}
	if !deleted {
		return responsef(args.T("api.command_share.not_shared_channel_unshare"))
	}

	notifyClientsForChannelUpdate(a, sc)

	return responsef("##### " + args.T("api.command_share.shared_channel_unavailable"))
}

func (sp *ShareProvider) doInviteRemote(a *app.App, args *model.CommandArgs, margs map[string]string) (resp *model.CommandResponse) {
	remoteId, ok := margs["remoteId"]
	if !ok || remoteId == "" {
		return responsef(args.T("api.command_share.must_specify_valid_remote"))
	}

	hasRemote, err := a.HasRemote(args.ChannelId, remoteId)
	if err != nil {
		return responsef(args.T("api.command_share.fetch_remote.error", map[string]interface{}{"Error": err.Error()}))
	}
	if hasRemote {
		return responsef(args.T("api.command_share.remote_already_invited"))
	}

	// Check if channel is shared or not.
	hasChan, err := a.HasSharedChannel(args.ChannelId)
	if err != nil {
		return responsef(args.T("api.command_share.check_channel_exist.error", map[string]interface{}{"Error": err.Error()}))
	}
	if !hasChan {
		// If it doesn't exist, then create it.
		resp2 := sp.doShareChannel(a, args, margs)
		// We modify the outgoing response by prepending the text
		// from the shareChannel response.
		defer func() {
			resp.Text = resp2.Text + "\n" + resp.Text
		}()
	}

	// don't allow invitation to shared channel originating from remote.
	// (also blocks cyclic invitations)
	if err := a.CheckCanInviteToSharedChannel(args.ChannelId); err != nil {
		return responsef(args.T("api.command_share.channel_invite_not_home.error"))
	}

	rc, appErr := a.GetRemoteCluster(remoteId)
	if appErr != nil {
		return responsef(args.T("api.command_share.remote_id_invalid.error", map[string]interface{}{"Error": appErr.Error()}))
	}

	channel, errApp := a.GetChannel(args.ChannelId)
	if errApp != nil {
		return responsef(args.T("api.command_share.channel_invite.error", map[string]interface{}{"Name": rc.DisplayName, "Error": errApp.Error()}))
	}
	// send channel invite to remote cluster
	if err := a.Srv().GetSharedChannelSyncService().SendChannelInvite(channel, args.UserId, margs["description"], rc); err != nil {
		return responsef(args.T("api.command_share.channel_invite.error", map[string]interface{}{"Name": rc.DisplayName, "Error": err.Error()}))
	}

	return responsef("##### " + args.T("api.command_share.invitation_sent", map[string]interface{}{"Name": rc.DisplayName, "SiteURL": rc.SiteURL}))
}

func (sp *ShareProvider) doUninviteRemote(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	remoteId, ok := margs["remoteId"]
	if !ok || remoteId == "" {
		return responsef(args.T("api.command_share.remote_not_valid"))
	}

	scr, err := a.GetSharedChannelRemoteByIds(args.ChannelId, remoteId)
	if err != nil || scr.ChannelId != args.ChannelId {
		return responsef(args.T("api.command_share.channel_remote_id_not_exists", map[string]interface{}{"RemoteId": remoteId}))
	}

	deleted, err := a.DeleteSharedChannelRemote(scr.Id)
	if err != nil || !deleted {
		return responsef(args.T("api.command_share.could_not_uninvite.error", map[string]interface{}{"RemoteId": remoteId, "Error": err.Error()}))
	}
	return responsef("##### " + args.T("api.command_share.remote_uninvited", map[string]interface{}{"RemoteId": remoteId}))
}

func (sp *ShareProvider) doStatus(a *app.App, args *model.CommandArgs, _ map[string]string) *model.CommandResponse {
	statuses, err := a.GetSharedChannelRemotesStatus(args.ChannelId)
	if err != nil {
		return responsef(args.T("api.command_share.fetch_remote_status.error", map[string]interface{}{"Error": err.Error()}))
	}
	if len(statuses) == 0 {
		return responsef(args.T("api.command_share.no_remote_invited"))
	}

	var sb strings.Builder

	fmt.Fprintf(&sb, args.T("api.command_share.channel_status_id", map[string]interface{}{"ChannelId": statuses[0].ChannelId})+"\n\n")

	fmt.Fprintf(&sb, args.T("api.command_share.remote_table_header")+" \n")
	fmt.Fprintf(&sb, "| ------ | ------- | ----------- | -------- | -------------- | ------ | --------- | \n")

	for _, status := range statuses {
		online := ":white_check_mark:"
		if !isOnline(status.LastPingAt) {
			online = ":skull_and_crossbones:"
		}

		lastSync := formatTimestamp(model.GetTimeForMillis(status.NextSyncAt))

		fmt.Fprintf(&sb, "| %s | %s | %s | %t | %t | %s | %s |\n",
			status.DisplayName, status.SiteURL, status.Description,
			status.ReadOnly, status.IsInviteAccepted, online, lastSync)
	}
	return responsef(sb.String())
}

func notifyClientsForChannelUpdate(a *app.App, sharedChannel *model.SharedChannel) {
	messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_CONVERTED, sharedChannel.TeamId, "", "", nil)
	messageWs.Add("channel_id", sharedChannel.ChannelId)
	a.Publish(messageWs)
}
