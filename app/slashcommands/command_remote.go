// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	AvailableRemoteActions = "Available actions: invite, accept, remove, status"
)

type RemoteProvider struct {
}

const (
	CommandTriggerRemote = "remote"
)

func init() {
	app.RegisterCommandProvider(&RemoteProvider{})
}

func (rp *RemoteProvider) GetTrigger() string {
	return CommandTriggerRemote
}

func (rp *RemoteProvider) GetCommand(a *app.App, T goi18n.TranslateFunc) *model.Command {

	remote := model.NewAutocompleteData(rp.GetTrigger(), "[action]", "Add/remove remote clusters. "+AvailableRemoteActions)

	invite := model.NewAutocompleteData("invite", "", "Invite a remote cluster")
	invite.AddNamedTextArgument("password", "Invitation password", "Password to be used to encrypt the invitation", "", true)
	invite.AddNamedTextArgument("name", "Remote cluster name", "A display name for the remote cluster", "", true)

	accept := model.NewAutocompleteData("accept", "", "Accept an invitation from a remote cluster")
	accept.AddNamedTextArgument("password", "Invitation password", "Password that was used to encrypt the invitation", "", true)
	accept.AddNamedTextArgument("name", "Remote cluster name", "A display name for the remote cluster", "", true)
	accept.AddNamedTextArgument("invite", "Invitation from remote cluster", "The encrypted inivation from a remote cluster", "", true)

	remove := model.NewAutocompleteData("remove", "", "Removes a remote cluster")
	remove.AddNamedDynamicListArgument("remoteId", "Id of remote cluster remove", "builtin:remote", true)

	status := model.NewAutocompleteData("status", "", "Displays status for all remote clusters")

	remote.AddCommand(invite)
	remote.AddCommand(accept)
	remote.AddCommand(remove)
	remote.AddCommand(status)

	return &model.Command{
		Trigger:          rp.GetTrigger(),
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_remote.desc"),
		AutoCompleteHint: T("api.command_remote.hint"),
		DisplayName:      T("api.command_remote.name"),
		AutocompleteData: remote,
	}
}

func (rp *RemoteProvider) DoCommand(a *app.App, args *model.CommandArgs, message string) *model.CommandResponse {
	if !a.HasPermissionTo(args.UserId, model.PERMISSION_MANAGE_SHARED_CHANNELS) {
		return responsef("You require `manage_shared_channels` permission to manage remote clusters.")
	}

	margs := parseNamedArgs(args.Command)
	action, ok := margs[ActionKey]
	if !ok {
		return responsef("Missing command. " + AvailableRemoteActions)
	}

	switch action {
	case "invite":
		return rp.doInvite(a, args, margs)
	case "accept":
		return rp.doAccept(a, args, margs)
	case "remove":
		return rp.doRemove(a, args, margs)
	case "status":
		return rp.doStatus(a, args, margs)
	}

	return responsef("Unknown action `%s`", action)
}

func (rp *RemoteProvider) GetAutoCompleteListItems(a *app.App, commandArgs *model.CommandArgs, arg *model.AutocompleteArg, parsed, toBeParsed string) ([]model.AutocompleteListItem, error) {
	if !a.HasPermissionTo(commandArgs.UserId, model.PERMISSION_MANAGE_SHARED_CHANNELS) {
		return nil, errors.New("You require `manage_shared_channels` permission to manage remote clusters.")
	}

	if arg.Name == "remoteId" && strings.Contains(parsed, " remove ") {
		return getRemoteClusterAutocompleteListItems(a, true)
	}

	return nil, fmt.Errorf("`%s` is not a dynamic argument", arg.Name)
}

// doInvite creates and displays an encrypted invite that can be used by a remote site to establish a simple trust.
func (rp *RemoteProvider) doInvite(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	password := margs["password"]
	if password == "" {
		return responsef("Missing or empty `password`")
	}

	name := margs["name"]
	if name == "" {
		return responsef("Missing or empty `name`")
	}

	rc := &model.RemoteCluster{
		DisplayName: name,
		Token:       model.NewId(),
	}

	rcSaved, appErr := a.AddRemoteCluster(rc)
	if appErr != nil {
		return responsef("Could not add remote cluster: %v", appErr)
	}

	url := a.GetSiteURL()
	if url == "" {
		return responsef("SiteURL not set. Please set this via the system console.")
	}

	// Display the encrypted invitation
	invite := &model.RemoteClusterInvite{
		RemoteId: rcSaved.RemoteId,
		SiteURL:  url,
		Token:    rcSaved.Token,
	}
	encrypted, err := invite.Encrypt(password)
	if err != nil {
		return responsef("Could not create invitation: %v", err)
	}
	encoded := base64.URLEncoding.EncodeToString(encrypted)

	return responsef("##### Invitation created.\n"+
		"Send the following encrypted (AES256 + Base64) blob to the remote site administrator along with the password. "+
		"They will use the `/remote accept` slash command to accept the invitation.\n\n```\n%s\n```\n\n"+
		"**Ensure the remote site can access your cluster via** %s", encoded, invite.SiteURL)
}

// doAccept accepts an invitation generated by a remote site.
func (rp *RemoteProvider) doAccept(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	password := margs["password"]
	if password == "" {
		return responsef("Missing or empty `password`")
	}

	name := margs["name"]
	if name == "" {
		return responsef("Missing or empty `name`")
	}

	blob := margs["invite"]
	if blob == "" {
		return responsef("Missing or empty `invite`")
	}

	// invite is encoded as base64 and encrypted
	decoded, err := base64.URLEncoding.DecodeString(blob)
	if err != nil {
		return responsef("Could not decode invitation: %v", err)
	}
	invite := &model.RemoteClusterInvite{}
	err = invite.Decrypt(decoded, password)
	if err != nil {
		return responsef("Could not decrypt invitation. Incorrect password or corrupt invitation: %v", err)
	}

	rcs, _ := a.GetRemoteClusterService()
	if rcs == nil {
		return responsef("Remote cluster service not enabled.")
	}

	url := a.GetSiteURL()
	if url == "" {
		return responsef("SiteURL not set. Please set this via the system console.")
	}

	rc, err := rcs.AcceptInvitation(invite, name, url)
	if err != nil {
		return responsef("Could not accept invitation: %v", err)
	}

	return responsef("##### Invitation accepted and confirmed.\nSiteURL: %s", rc.SiteURL)
}

// doRemove removes a remote cluster from the database, effectively revoking the trust relationship.
func (rp *RemoteProvider) doRemove(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	id, ok := margs["remoteId"]
	if !ok {
		return responsef("Missing `remoteId`")
	}

	deleted, err := a.DeleteRemoteCluster(id)
	if err != nil {
		responsef("Could not remove remote cluster: %v", err)
	}

	result := "removed"
	if !deleted {
		result = "**NOT FOUND**"
	}
	return responsef("##### Remote cluster %s %s.", id, result)
}

// doStatus displays connection status for all remote clusters.
func (rp *RemoteProvider) doStatus(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	list, err := a.GetAllRemoteClusters(true)
	if err != nil {
		responsef("Could not fetch remote clusters: %v", err)
	}

	if len(list) == 0 {
		return responsef("** No remote clusters found. **")
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "| Name | SiteURL  | RemoteId   | Invite Accepted | Online |\n")
	fmt.Fprintf(&sb, "| ---- | -------- | ---------- | :-------------: | :----: | \n")

	for _, rc := range list {
		accepted := ":white_check_mark:"
		if rc.SiteURL == "" {
			accepted = ":x:"
		}

		online := ":white_check_mark:"
		if !isOnline(rc.LastPingAt) {
			online = ":skull_and_crossbones:"
		}

		fmt.Fprintf(&sb, "| %s | %s | %s | %s | %s |\n", rc.DisplayName, rc.SiteURL, rc.RemoteId, accepted, online)
	}
	return responsef(sb.String())
}

func isOnline(lastPing int64) bool {
	return lastPing > model.GetMillis()-model.RemoteOfflineAfterMillis
}

func getRemoteClusterAutocompleteListItems(a *app.App, includeOffline bool) ([]model.AutocompleteListItem, error) {
	clusters, err := a.GetAllRemoteClusters(includeOffline)
	if err != nil || len(clusters) == 0 {
		return []model.AutocompleteListItem{}, nil
	}

	list := make([]model.AutocompleteListItem, 0, len(clusters))

	for _, rc := range clusters {
		item := model.AutocompleteListItem{
			Item:     rc.RemoteId,
			HelpText: fmt.Sprintf("%s  (%s)", rc.DisplayName, rc.SiteURL)}
		list = append(list, item)
	}
	return list, nil
}

func getRemoteClusterAutocompleteListItemsNotInChannel(a *app.App, channelId string, includeOffline bool) ([]model.AutocompleteListItem, error) {
	all, err := a.GetAllRemoteClustersNotInChannel(channelId, includeOffline)
	if err != nil || len(all) == 0 {
		return []model.AutocompleteListItem{}, nil
	}

	list := make([]model.AutocompleteListItem, 0, len(all))

	for _, rc := range all {
		item := model.AutocompleteListItem{
			Item:     rc.RemoteId,
			HelpText: fmt.Sprintf("%s  (%s)", rc.DisplayName, rc.SiteURL)}
		list = append(list, item)
	}
	return list, nil
}
