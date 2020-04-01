// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAutocompleteData(t *testing.T) {
	ad := NewAutocompleteData("jira", "", "Avaliable commands:")
	assert.Nil(t, ad.IsValid())
	ad.RoleID = "some_id"
	assert.NotNil(t, ad.IsValid())
	ad.RoleID = SYSTEM_ADMIN_ROLE_ID
	assert.Nil(t, ad.IsValid())
	ad.AddDynamicListArgument("", "help", "/some/url")
	assert.Nil(t, ad.IsValid())
	ad.AddTextArgument("name", "help", "[text]", "")
	assert.Nil(t, ad.IsValid())

	ad = getAutocompleteData()
	assert.Nil(t, ad.IsValid())
	command := NewAutocompleteData("", "", "")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "", "disconnect")
	command.AddTextArgument("", "help", "[text]", "")
	command.AddTextArgument("some", "help", "[text]", "")
	ad.AddCommand(command)
	assert.Nil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "", "disconnect")
	command.AddDynamicListArgument("", "help", "valid_url")
	ad.AddCommand(command)
	assert.Nil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "", "disconnect")
	command.AddDynamicListArgument("", "help", "/valid/url")
	staticList := NewAutocompleteStaticListArg()
	staticList.AddArgument("", "help")
	command.AddStaticListArgument("", "help", staticList)
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())
}

func TestAutocompleteDataJSON(t *testing.T) {
	jira := CreateJiraAutocompleteData()
	b, err := jira.ToJSON()
	assert.Nil(t, err)
	jira2, err := AutocompleteDataFromJSON(b)
	assert.Nil(t, err)
	assert.True(t, jira2.Equals(jira))
}

func getAutocompleteData() *AutocompleteData {
	ad := NewAutocompleteData("jira", "", "Avaliable commands:")
	ad.RoleID = SYSTEM_USER_ROLE_ID
	ad.AddDynamicListArgument("", "help", "/some/url")
	ad.AddTextArgument("", "help", "[text]", "")
	StaticList := NewAutocompleteStaticListArg()
	StaticList.AddArgument("arg1", "help1")
	StaticList.AddArgument("arg2", "help2")
	ad.AddStaticListArgument("", "help", StaticList)

	command := NewAutocompleteData("connect", "", "Connect to mattermost")
	command.RoleID = SYSTEM_ADMIN_ROLE_ID
	command.AddTextArgument("some", "help", "[text]", "")
	command.AddDynamicListArgument("other", "help", "/other/url")
	ad.AddCommand(command)
	return ad
}

func TestUpdateRelativeURLsForPluginCommands(t *testing.T) {
	ad := getAutocompleteData()
	baseURL, _ := url.Parse("http://localhost:8065/plugins/com.mattermost.demo-plugin")
	err := ad.UpdateRelativeURLsForPluginCommands(baseURL)
	assert.Nil(t, err)
	arg, ok := ad.SubCommands[0].Arguments[1].Data.(*AutocompleteDynamicListArg)
	assert.True(t, ok)
	assert.Equal(t, "http://localhost:8065/plugins/com.mattermost.demo-plugin/other/url", arg.FetchURL)
}
