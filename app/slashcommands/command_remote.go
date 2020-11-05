// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"fmt"
	"strconv"
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	AvailableCommands = "Available commands: add, remove, status"
	ActionKey         = "-action"
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

	remote := model.NewAutocompleteData(rp.GetTrigger(), "[action]", "Add/remove remote clusters. "+AvailableCommands)

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
		return responsef("You require manage_shared_channels permission to manage remote clusters.")
	}

	margs := parseNamedArgs(args.Command)
	action, ok := margs[ActionKey]
	if !ok {
		return responsef("Missing command. " + AvailableCommands)
	}

	switch action {
	case "add":
		return rp.doAdd(a, args, margs)
	case "remove":
	case "status":
		return rp.doStatus(a, args, margs)
	}

	return responsef("Unknown action %s", action)
}

func (rp *RemoteProvider) GetAutoCompleteListItems(commandArgs *model.CommandArgs, arg *model.AutocompleteArg, parsed, toBeParsed string) ([]model.AutocompleteListItem, error) {
	if !a.HasPermissionTo(commandArgs.UserId, model.PERMISSION_MANAGE_SHARED_CHANNELS) {
		return responsef("You require manage_shared_channels permission to manage remote clusters.")
	}

	var list []model.AutocompleteListItem

	if arg.Name == "remoteId" && strings.Contains(parsed, " remove ") {
		list = append(list, model.AutocompleteListItem{Item: "invite1", Hint: "this is hint 1", HelpText: "This is help text 1."})
		list = append(list, model.AutocompleteListItem{Item: "invite2", Hint: "this is hint 2", HelpText: "This is help text 2."})
		list = append(list, model.AutocompleteListItem{Item: "invite3", Hint: "this is hint 3", HelpText: "This is help text 3."})
	} else {
		return nil, fmt.Errorf("%s not a dynamic argument", arg.Name)
	}
	return list, nil
}

func (rp *RemoteProvider) doAdd(a *app.App, args *model.CommandArgs, margs map[string]string) *model.CommandResponse {
	name, ok := margs["name"]
	if !ok {
		return responsef("Missing `name`")
	}

	host, ok := margs["host"]
	if !ok {
		return responsef("Missing `host`")
	}

	port, ok := margs["port"]
	if !ok {
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
	return responsef("### Remote cluster added.\nName: %s\nHost: %s\nPort: %d\nToken: %s", rcSaved.ClusterName, rc.Hostname, rc.Port, rcSaved.Token)
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
	fmt.Fprintf(&sb, "| Name | Host | Token | Id   |\n")
	fmt.Fprintf(&sb, "| ---- | ---- | ----  | ---- |\n")

	for _, rc := range list {
		fmt.Fprintf(&sb, "| %s | %s:%d | %s | %s |\n", rc.ClusterName, rc.Hostname, rc.Port, rc.Token, rc.Id)
	}
	return responsef(sb.String())
}
