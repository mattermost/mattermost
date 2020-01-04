// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAutocompleteData(t *testing.T) {
	ad := NewAutocompleteData("jira", "Avaliable commands:")
	assert.Nil(t, ad.IsValid())
	ad.RoleID = "some_id"
	assert.NotNil(t, ad.IsValid())
	ad.RoleID = SYSTEM_ADMIN_ROLE_ID
	assert.Nil(t, ad.IsValid())
	ad.AddFetchListArgument("", "help", "/some/url")
	assert.Nil(t, ad.IsValid())
	ad.AddTextInputArgument("name", "help", "")
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	assert.Nil(t, ad.IsValid())
	command := NewAutocompleteData("", "")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "disconnect")
	command.AddTextInputArgument("", "help", "")
	command.AddTextInputArgument("some", "help", "")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "disconnect")
	command.AddFetchListArgument("", "help", "invalid_url")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "disconnect")
	command.AddFetchListArgument("", "help", "invalid_url")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "disconnect")
	command.AddFetchListArgument("", "help", "/valid/url")
	fixedList := NewFixedListArgument()
	fixedList.AddArgument("", "help")
	command.AddFixedListArgument("", "help", fixedList)
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())
}

func TestAutocompleteDataJSON(t *testing.T) {
	jira := createJiraAutocompleteData()
	b, err := jira.ToJSON()
	assert.Nil(t, err)
	jira2, err := AutocompleteDataFromJSON(b)
	assert.Nil(t, err)
	assert.True(t, jira2.Equals(jira))
}

func getAutocompleteData() *AutocompleteData {
	ad := NewAutocompleteData("jira", "Avaliable commands:")
	ad.RoleID = SYSTEM_USER_ROLE_ID
	ad.AddFetchListArgument("", "help", "/some/url")
	ad.AddTextInputArgument("", "help", "")
	fixedList := NewFixedListArgument()
	fixedList.AddArgument("arg1", "help1")
	fixedList.AddArgument("arg2", "help2")
	ad.AddFixedListArgument("", "help", fixedList)

	command := NewAutocompleteData("connect", "Connect to mattermost")
	command.RoleID = SYSTEM_ADMIN_ROLE_ID
	command.AddTextInputArgument("some", "help", "")
	command.AddFetchListArgument("other", "help", "/other/url")
	ad.AddCommand(command)
	return ad
}

func createJiraAutocompleteData() *AutocompleteData {
	jira := NewAutocompleteData("jira", "Available commands: connect, assign, disconnect, create, transition, view, subscribe, settings, install cloud/server, uninstall cloud/server, help")

	connect := NewAutocompleteData("connect", "Connect your Mattermost account to your Jira account")
	jira.AddCommand(connect)

	disconnect := NewAutocompleteData("disconnect", "Disconnect your Mattermost account from your Jira account")
	jira.AddCommand(disconnect)

	assign := NewAutocompleteData("assign", "Change the assignee of a Jira issue")
	assign.AddFetchListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	assign.AddFetchListArgument("", "List of assignees is downloading from your Jira account", "/url/assignee")
	jira.AddCommand(assign)

	create := NewAutocompleteData("create", "Create a new Issue")
	create.AddTextInputArgument("", "This text is optional, will be inserted into the description field", "")
	jira.AddCommand(create)

	transition := NewAutocompleteData("transition", "Change the state of a Jira issue")
	assign.AddFetchListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	assign.AddFetchListArgument("", "List of states is downloading from your Jira account", "/url/states")
	jira.AddCommand(transition)

	subscribe := NewAutocompleteData("subscribe", "Configure the Jira notifications sent to this channel")
	jira.AddCommand(subscribe)

	view := NewAutocompleteData("view", "View the details of a specific Jira issue")
	assign.AddFetchListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	jira.AddCommand(view)

	settings := NewAutocompleteData("settings", "Update your user settings")
	notifications := NewAutocompleteData("notifications", "Turn notifications on or off")
	argument := NewFixedListArgument()
	argument.AddArgument("on", "Turn notifications on")
	argument.AddArgument("off", "Turn notifications off")
	notifications.AddFixedListArgument("", "Turn notifications on or off", argument)
	settings.AddCommand(notifications)
	jira.AddCommand(settings)

	install := NewAutocompleteData("install", "Connect Mattermost to a Jira instance")
	install.RoleID = SYSTEM_ADMIN_ROLE_ID
	cloud := NewAutocompleteData("cloud", "Connect to a Jira Cloud instance")
	urlPattern := "https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)"
	cloud.AddTextInputArgument("", "input URL of the Jira Cloud instance", urlPattern)
	install.AddCommand(cloud)
	server := NewAutocompleteData("server", "Connect to a Jira Server or Data Center instance")
	server.AddTextInputArgument("", "input URL of the Jira Server or Data Center instance", urlPattern)
	install.AddCommand(server)
	jira.AddCommand(install)

	uninstall := NewAutocompleteData("uninstall", "Disconnect Mattermost from a Jira instance")
	uninstall.RoleID = SYSTEM_ADMIN_ROLE_ID
	cloud = NewAutocompleteData("cloud", "Disconnect from a Jira Cloud instance")
	cloud.AddTextInputArgument("", "input URL of the Jira Cloud instance", urlPattern)
	uninstall.AddCommand(cloud)
	server = NewAutocompleteData("server", "Disconnect from a Jira Server or Data Center instance")
	server.AddTextInputArgument("", "input URL of the Jira Server or Data Center instance", urlPattern)
	uninstall.AddCommand(server)
	jira.AddCommand(uninstall)

	return jira
}
