// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type ShareProvider struct {
}

// ensure ShareProvide implements AutocompleteDynamicArgProvider
var _ app.AutocompleteDynamicArgProvider = (*ShareProvider)(nil)

const (
	CommandTriggerShare   = "share-channel"
	AvailableShareActions = "invite, uninvite, unshare, status, sync"
)

func init() {
	app.RegisterCommandProvider(&ShareProvider{})
}

func (sp *ShareProvider) GetTrigger() string {
	return CommandTriggerShare
}

func (sp *ShareProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	share := model.NewAutocompleteData(CommandTriggerShare, "[action]", T("api.command_share.available_actions", map[string]any{"Actions": AvailableShareActions}))

	inviteRemote := model.NewAutocompleteData("invite", "", T("api.command_share.invite_remote.help"))
	inviteRemote.AddNamedDynamicListArgument("connectionID", T("api.command_share.remote_id.help"), "builtin:"+CommandTriggerShare, true)
	inviteRemote.AddNamedTextArgument("readonly", T("api.command_share.share_read_only.help"), T("api.command_share.share_read_only.hint"), "Y|N|y|n", false)

	unInviteRemote := model.NewAutocompleteData("uninvite", "", T("api.command_share.uninvite_remote.help"))
	unInviteRemote.AddNamedDynamicListArgument("connectionID", T("api.command_share.uninvite_remote_id.help"), "builtin:"+CommandTriggerShare, true)

	unshareChannel := model.NewAutocompleteData("unshare", "", T("api.command_share.unshare_channel.help"))

	status := model.NewAutocompleteData("status", "", T("api.command_share.channel_status.help"))

	syncDirection := model.NewAutocompleteData("sync", "", T("api.command_share.sync_direction.help"))
	syncDirection.AddNamedDynamicListArgument("connectionID", T("api.command_share.remote_id.help"), "builtin:"+CommandTriggerShare, true)
	syncDirection.AddNamedDynamicListArgument("direction", T("api.command_share.sync_direction_value.help"), "builtin:"+CommandTriggerShare, true)

	share.AddCommand(inviteRemote)
	share.AddCommand(unInviteRemote)
	share.AddCommand(unshareChannel)
	share.AddCommand(status)
	share.AddCommand(syncDirection)

	return &model.Command{
		Trigger:          CommandTriggerShare,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_share.desc"),
		AutoCompleteHint: T("api.command_share.hint"),
		DisplayName:      T("api.command_share.name"),
		AutocompleteData: share,
	}
}

func (sp *ShareProvider) GetAutoCompleteListItems(c request.CTX, a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg, parsed, toBeParsed string) ([]model.AutocompleteListItem, error) {
	switch {
	case strings.Contains(parsed, " share "):

		return sp.getAutoCompleteShareChannel(c, a, commandArgs, arg)

	case strings.Contains(parsed, " invite "):

		return sp.getAutoCompleteInviteRemote(a, commandArgs, arg)

	case strings.Contains(parsed, " uninvite "):

		return sp.getAutoCompleteUnInviteRemote(a, commandArgs, arg)

	case strings.Contains(parsed, " sync "):

		return sp.getAutoCompleteSyncDirection(a, commandArgs, arg)
	}
	return nil, errors.New("invalid action")
}

func (sp *ShareProvider) getAutoCompleteShareChannel(c request.CTX, a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg) ([]model.AutocompleteListItem, error) {
	channel, err := a.GetChannel(c, commandArgs.ChannelId)
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
	case "connectionID":
		return getRemoteClusterAutocompleteListItemsNotInChannel(a, commandArgs.ChannelId, true)
	default:
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
}

func (sp *ShareProvider) getAutoCompleteUnInviteRemote(a *app.App, _ *model.CommandArgs, arg *model.AutocompleteArg) ([]model.AutocompleteListItem, error) {
	switch arg.Name {
	case "connectionID":
		return getRemoteClusterAutocompleteListItems(a, true)
	default:
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
}

func (sp *ShareProvider) getAutoCompleteSyncDirection(a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg) ([]model.AutocompleteListItem, error) {
	switch arg.Name {
	case "connectionID":
		return getRemoteClusterAutocompleteListItemsInChannel(a, commandArgs.ChannelId, true)
	case "direction":
		return []model.AutocompleteListItem{
			{
				Item:     "bidirectional",
				HelpText: "Send and receive messages (default)",
			},
			{
				Item:     "inbound",
				HelpText: "Only receive messages from remote",
			},
		}, nil
	default:
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
}

func (sp *ShareProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.HasPermissionTo(args.UserId, model.PermissionManageSharedChannels) {
		return response(args.T("api.command_share.permission_required", map[string]any{"Permission": "manage_shared_channels"}))
	}

	syncService := a.Srv().GetSharedChannelSyncService()
	if syncService == nil || !syncService.Active() {
		return response(args.T("api.command_share.service_disabled"))
	}

	rcService := a.Srv().GetRemoteClusterService()
	if rcService == nil || !rcService.Active() {
		return response(args.T("api.command_remote.service_disabled"))
	}

	margs := parseNamedArgs(args.Command)
	action, ok := margs[ActionKey]
	if !ok {
		return response(args.T("api.command_share.missing_action", map[string]any{"Actions": AvailableShareActions}))
	}

	switch action {
	case "share":
		return sp.doShareChannel(a, c, args, margs)
	case "unshare":
		return sp.doUnshareChannel(a, args, margs)
	case "invite":
		return sp.doInviteRemote(a, c, args, margs)
	case "uninvite":
		return sp.doUninviteRemote(a, args, margs)
	case "status":
		return sp.doStatus(a, args, margs)
	case "sync":
		return sp.doSyncDirection(a, args, margs)
	}
	return response(args.T("api.command_share.unknown_action", map[string]any{"Action": action, "Actions": AvailableShareActions}))
}

func (sp *ShareProvider) doShareChannel(a *app.App, c request.CTX, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	// fetch defaults for missing channel props
	channel, errApp := a.GetChannel(c, args.ChannelId)
	if errApp != nil {
		return response(args.T("api.command_share.share_channel.error", map[string]any{"Error": errApp.Error()}))
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
		return response(args.T("api.command_share.invalid_value.error", map[string]any{"Arg": "readonly", "Error": err.Error()}))
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

	if _, err := a.ShareChannel(c, sc); err != nil {
		return response(args.T("api.command_share.share_channel.error", map[string]any{"Error": err.Error()}))
	}

	return response("##### " + args.T("api.command_share.channel_shared"))
}

func (sp *ShareProvider) doUnshareChannel(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	deleted, err := a.UnshareChannel(args.ChannelId)
	if err != nil {
		return response(args.T("api.command_share.shared_channel_unshare.error", map[string]any{"Error": err.Error()}))
	}
	if !deleted {
		return response(args.T("api.command_share.not_shared_channel_unshare"))
	}

	return response("##### " + args.T("api.command_share.shared_channel_unavailable"))
}

func (sp *ShareProvider) doInviteRemote(a *app.App, c request.CTX, args *model.CommandArgs, margs map[string]string) (resp *model.CommandResponse) {
	remoteID, ok := margs["connectionID"]
	if !ok || remoteID == "" {
		return response(args.T("api.command_share.must_specify_valid_remote"))
	}

	hasRemote, err := a.HasRemote(args.ChannelId, remoteID)
	if err != nil {
		return response(args.T("api.command_share.fetch_remote.error", map[string]any{"Error": err.Error()}))
	}
	if hasRemote {
		return response(args.T("api.command_share.remote_already_invited"))
	}

	// Check if channel is shared or not.
	// TODO: have the share channels service generate the "channel has been shared post" and this section can be removed since
	//       since `a.InviteRemoteToChannel` will share the channel automatically.
	hasChan, err := a.HasSharedChannel(args.ChannelId)
	if err != nil {
		return response(args.T("api.command_share.check_channel_exist.error", map[string]any{"ChannelID": args.ChannelId, "Error": err.Error()}))
	}
	if !hasChan {
		// If it doesn't exist, then create it.
		resp2 := sp.doShareChannel(a, c, args, margs)
		// We modify the outgoing response by prepending the text
		// from the shareChannel response.
		defer func() {
			resp.Text = resp2.Text + "\n" + resp.Text
		}()
	}

	rc, appErr := a.GetRemoteCluster(remoteID, false)
	if appErr != nil {
		return response(args.T("api.command_share.remote_id_invalid.error", map[string]any{"Error": appErr.Error()}))
	}

	if err = a.InviteRemoteToChannel(args.ChannelId, remoteID, args.UserId, true); err != nil {
		return response(args.T("api.command_share.invite_remote_to_channel.error", map[string]any{"Error": err.Error()}))
	}

	return response("##### " + args.T("api.command_share.invitation_sent", map[string]any{"Name": rc.DisplayName, "SiteURL": rc.SiteURL}))
}

func (sp *ShareProvider) doUninviteRemote(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	remoteID, ok := margs["connectionID"]
	if !ok || remoteID == "" {
		return response(args.T("api.command_share.remote_not_valid"))
	}

	err := a.UninviteRemoteFromChannel(args.ChannelId, remoteID)
	if err != nil {
		return response(err.Error())
	}

	return response("##### " + args.T("api.command_share.remote_uninvited", map[string]any{"RemoteId": remoteID}))
}

func (sp *ShareProvider) doStatus(a *app.App, args *model.CommandArgs, _ map[string]string) *model.CommandResponse {
	statuses, err := a.GetSharedChannelRemotesStatus(args.ChannelId)
	if err != nil {
		return response(args.T("api.command_share.fetch_remote_status.error", map[string]any{"Error": err.Error()}))
	}
	if len(statuses) == 0 {
		return response(args.T("api.command_share.no_remote_invited"))
	}

	var sb strings.Builder

	fmt.Fprintf(&sb, "%s\n\n", args.T("api.command_share.channel_status_id", map[string]any{"ChannelId": statuses[0].ChannelId}))

	fmt.Fprintf(&sb, "%s \n", args.T("api.command_share.remote_table_header_with_sync"))
	// "| Secure Connection | SiteURL | ReadOnly | InviteAccepted | Online | Sync Direction | Last Sync |"
	fmt.Fprintf(&sb, "| ---- | ---- | ---- | ---- | ---- | ---- | ---- | \n")

	for _, status := range statuses {
		readonly := formatBool(args.T, status.ReadOnly)
		accepted := formatBool(args.T, status.IsInviteAccepted)
		online := formatBool(args.T, isOnline(status.LastPingAt))

		var syncDirection string
		if status.SyncOutbound {
			syncDirection = args.T("api.command_share.sync_direction_bidirectional")
		} else {
			syncDirection = args.T("api.command_share.sync_direction_inbound_only")
		}

		lastSync := formatTimestamp(status.NextSyncAt)

		fmt.Fprintf(&sb, "| %s | %s | %s | %s | %s | %s | %s |\n",
			status.DisplayName, status.SiteURL, readonly, accepted, online, syncDirection, lastSync)
	}
	return response(sb.String())
}

func (sp *ShareProvider) doSyncDirection(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	remoteID, ok := margs["connectionID"]
	if !ok || remoteID == "" {
		return response(args.T("api.command_share.must_specify_valid_remote"))
	}

	direction, ok := margs["direction"]
	if !ok || direction == "" {
		return response(args.T("api.command_share.must_specify_sync_direction"))
	}

	// Validate direction value
	var syncOutbound bool
	switch direction {
	case "bidirectional":
		syncOutbound = true
	case "inbound":
		syncOutbound = false
	default:
		return response(args.T("api.command_share.invalid_sync_direction", map[string]any{"Direction": direction}))
	}

	// Check if the remote exists and is connected to this channel
	scr, err := a.Srv().GetStore().SharedChannel().GetRemoteByIds(args.ChannelId, remoteID)
	if err != nil {
		return response(args.T("api.command_share.remote_not_found_in_channel", map[string]any{"RemoteId": remoteID}))
	}

	// Update the SyncOutbound flag
	scr.SyncOutbound = syncOutbound
	if _, err = a.Srv().GetStore().SharedChannel().UpdateRemote(scr); err != nil {
		return response(args.T("api.command_share.update_sync_direction.error", map[string]any{"Error": err.Error()}))
	}

	// Get remote cluster info for display
	rc, appErr := a.GetRemoteCluster(remoteID, false)
	if appErr != nil {
		return response(args.T("api.command_share.remote_id_invalid.error", map[string]any{"Error": appErr.Error()}))
	}

	var directionText string
	if syncOutbound {
		directionText = args.T("api.command_share.sync_direction_bidirectional")
	} else {
		directionText = args.T("api.command_share.sync_direction_inbound_only")
	}

	return response("##### " + args.T("api.command_share.sync_direction_updated", map[string]any{
		"RemoteName": rc.DisplayName,
		"Direction":  directionText,
	}))
}
