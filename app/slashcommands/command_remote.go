// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	AvailableRemoteActions = "Available actions: add, remove, status"
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

	add := model.NewAutocompleteData("add", "", "Add a remote cluster")
	add.AddNamedTextArgument("name", "Remote cluster name", "Descriptive name of the remote cluster to add", "", true)
	add.AddNamedTextArgument("host", "Host name of the remote cluster", "Can be domain name or IP address", "", true)
	add.AddNamedTextArgument("port", "Port used to connect to remote cluster", "(Optional) defaults to 8065", "^[0-9]+$", false)

	remove := model.NewAutocompleteData("remove", "", "Removes a remote cluster")
	remove.AddNamedDynamicListArgument("remoteId", "Id of remote cluster remove", "builtin:remote", true)

	status := model.NewAutocompleteData("status", "", "Displays status for all remote clusters")

	remote.AddCommand(add)
	remote.AddCommand(remove)
	remote.AddCommand(status)

	return &model.Command{
		Trigger:          rp.GetTrigger(),
		AutoComplete:     true,
		AutoCompleteDesc: T("api.remote.desc"),
		AutoCompleteHint: T("api.remote.hint"),
		DisplayName:      T("api.remote.name"),
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
	case "add":
		return rp.doAdd(a, args, margs)
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

func (rp *RemoteProvider) doAdd(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	name := margs["name"]
	if name == "" {
		return responsef("Missing or empty `name`")
	}

	host := margs["host"]
	if host == "" {
		return responsef("Missing or empty `host`")
	}

	port := margs["port"]
	if port == "" {
		port = "8065"
	}
	iport, err := strconv.ParseInt(port, 10, 32)
	if err != nil {
		return responsef("Invalid `port`: %v", err)
	}

	rc := &model.RemoteCluster{
		ClusterName: name,
		Hostname:    host,
		Port:        int32(iport),
	}

	rcSaved, err := a.AddRemoteCluster(rc)
	if err != nil {
		responsef("Could not add remote cluster: %v", err)
	}
	return responsef("##### Remote cluster added.\nName: %s\nHost: %s\nPort: %d\nToken: %s", rcSaved.ClusterName, rc.Hostname, rc.Port, rcSaved.Token)
}

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

func (rp *RemoteProvider) doStatus(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	list, err := a.GetAllRemoteClusters(true)
	if err != nil {
		responsef("Could not fetch remote clusters: %v", err)
	}

	if len(list) == 0 {
		return responsef("** No remote clusters found. **")
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "| Name | Host | Token | Id   | Online |\n")
	fmt.Fprintf(&sb, "| ---- | ---- | ----  | ---- | ----   |\n")

	for _, rc := range list {
		online := ":white_check_mark:"
		if !isOnline(rc.LastPingAt) {
			online = ":skull_and_crossbones:"
		}

		fmt.Fprintf(&sb, "| %s | %s:%d | %s | %s | %s |\n", rc.ClusterName, rc.Hostname, rc.Port, rc.Token, rc.RemoteId, online)
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
			HelpText: fmt.Sprintf("%s  (%s:%d)", rc.ClusterName, rc.Hostname, rc.Port)}
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
			HelpText: fmt.Sprintf("%s  (%s:%d)", rc.ClusterName, rc.Hostname, rc.Port)}
		list = append(list, item)
	}
	return list, nil
}
