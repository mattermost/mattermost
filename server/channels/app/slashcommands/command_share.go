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
	AvailableShareActions = "invite, uninvite, unshare, status"
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

	share.AddCommand(inviteRemote)
	share.AddCommand(unInviteRemote)
	share.AddCommand(unshareChannel)
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

func (sp *ShareProvider) GetAutoCompleteListItems(c request.CTX, a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg, parsed, toBeParsed string) ([]model.AutocompleteListItem, error) {
	switch {
	case strings.Contains(parsed, " share "):

		return sp.getAutoCompleteShareChannel(c, a, commandArgs, arg)

	case strings.Contains(parsed, " invite "):

		return sp.getAutoCompleteInviteRemote(a, commandArgs, arg)

	case strings.Contains(parsed, " uninvite "):

		return sp.getAutoCompleteUnInviteRemote(a, commandArgs, arg)
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

func (sp *ShareProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.HasPermissionTo(args.UserId, model.PermissionManageSharedChannels) {
		return responsef(args.T("api.command_share.permission_required", map[string]any{"Permission": "manage_shared_channels"}))
	}

	syncService := a.Srv().GetSharedChannelSyncService()
	if syncService == nil || !syncService.Active() {
		return responsef(args.T("api.command_share.service_disabled"))
	}

	rcService := a.Srv().GetRemoteClusterService()
	if rcService == nil || !rcService.Active() {
		return responsef(args.T("api.command_remote.service_disabled"))
	}

	margs := parseNamedArgs(args.Command)
	action, ok := margs[ActionKey]
	if !ok {
		return responsef(args.T("api.command_share.missing_action", map[string]any{"Actions": AvailableShareActions}))
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
	}
	return responsef(args.T("api.command_share.unknown_action", map[string]any{"Action": action, "Actions": AvailableShareActions}))
}

func (sp *ShareProvider) doShareChannel(a *app.App, c request.CTX, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	// fetch defaults for missing channel props
	channel, errApp := a.GetChannel(c, args.ChannelId)
	if errApp != nil {
		return responsef(args.T("api.command_share.share_channel.error", map[string]any{"Error": errApp.Error()}))
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
		return responsef(args.T("api.command_share.invalid_value.error", map[string]any{"Arg": "readonly", "Error": err.Error()}))
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
		return responsef(args.T("api.command_share.share_channel.error", map[string]any{"Error": err.Error()}))
	}

	return responsef("##### " + args.T("api.command_share.channel_shared"))
}

func (sp *ShareProvider) doUnshareChannel(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	deleted, err := a.UnshareChannel(args.ChannelId)
	if err != nil {
		return responsef(args.T("api.command_share.shared_channel_unshare.error", map[string]any{"Error": err.Error()}))
	}
	if !deleted {
		return responsef(args.T("api.command_share.not_shared_channel_unshare"))
	}

	return responsef("##### " + args.T("api.command_share.shared_channel_unavailable"))
}

func (sp *ShareProvider) doInviteRemote(a *app.App, c request.CTX, args *model.CommandArgs, margs map[string]string) (resp *model.CommandResponse) {
	remoteID, ok := margs["connectionID"]
	if !ok || remoteID == "" {
		return responsef(args.T("api.command_share.must_specify_valid_remote"))
	}

	hasRemote, err := a.HasRemote(args.ChannelId, remoteID)
	if err != nil {
		return responsef(args.T("api.command_share.fetch_remote.error", map[string]any{"Error": err.Error()}))
	}
	if hasRemote {
		return responsef(args.T("api.command_share.remote_already_invited"))
	}

	// Check if channel is shared or not.
	// TODO: have the share channels service generate the "channel has been shared post" and this section can be removed since
	//       since `a.InviteRemoteToChannel` will share the channel automatically.
	hasChan, err := a.HasSharedChannel(args.ChannelId)
	if err != nil {
		return responsef(args.T("api.command_share.check_channel_exist.error", map[string]any{"ChannelID": args.ChannelId, "Error": err.Error()}))
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

	rc, appErr := a.GetRemoteCluster(remoteID)
	if appErr != nil {
		return responsef(args.T("api.command_share.remote_id_invalid.error", map[string]any{"Error": appErr.Error()}))
	}

	if err = a.InviteRemoteToChannel(args.ChannelId, remoteID, args.UserId, true); err != nil {
		return responsef(args.T("api.command_share.invite_remote_to_channel.error", map[string]any{"Error": err.Error()}))
	}

	return responsef("##### " + args.T("api.command_share.invitation_sent", map[string]any{"Name": rc.DisplayName, "SiteURL": rc.SiteURL}))
}

func (sp *ShareProvider) doUninviteRemote(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	remoteID, ok := margs["connectionID"]
	if !ok || remoteID == "" {
		return responsef(args.T("api.command_share.remote_not_valid"))
	}

	err := a.UninviteRemoteFromChannel(args.ChannelId, remoteID)
	if err != nil {
		return responsef(err.Error())
	}

	return responsef("##### " + args.T("api.command_share.remote_uninvited", map[string]any{"RemoteId": remoteID}))
}

func (sp *ShareProvider) doStatus(a *app.App, args *model.CommandArgs, _ map[string]string) *model.CommandResponse {
	statuses, err := a.GetSharedChannelRemotesStatus(args.ChannelId)
	if err != nil {
		return responsef(args.T("api.command_share.fetch_remote_status.error", map[string]any{"Error": err.Error()}))
	}
	if len(statuses) == 0 {
		return responsef(args.T("api.command_share.no_remote_invited"))
	}

	var sb strings.Builder

	fmt.Fprintf(&sb, args.T("api.command_share.channel_status_id", map[string]any{"ChannelId": statuses[0].ChannelId})+"\n\n")

	fmt.Fprintf(&sb, args.T("api.command_share.remote_table_header")+" \n")
	// "| Secure Connection | SiteURL | ReadOnly | InviteAccepted | Online | Last Sync |"
	fmt.Fprintf(&sb, "| ---- | ---- | ---- | ---- | ---- | ---- | \n")

	for _, status := range statuses {
		readonly := formatBool(args.T, status.ReadOnly)
		accepted := formatBool(args.T, status.IsInviteAccepted)
		online := formatBool(args.T, isOnline(status.LastPingAt))

		lastSync := formatTimestamp(status.NextSyncAt)

		fmt.Fprintf(&sb, "| %s | %s | %s | %s | %s | %s |\n",
			status.DisplayName, status.SiteURL, readonly, accepted, online, lastSync)
	}
	return responsef(sb.String())
}
