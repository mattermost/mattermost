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
	ad.AddDynamicListArgument("help", "/some/url", true)
	assert.Nil(t, ad.IsValid())
	ad.AddNamedTextArgument("name", "help", "[text]", "", true)
	assert.Nil(t, ad.IsValid())
	ad.AddNamedBoolArgument("name", "help", "hint", "t", true)
	assert.Nil(t, ad.IsValid())

	ad = getAutocompleteData()
	assert.Nil(t, ad.IsValid())
	command := NewAutocompleteData("", "", "")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "", "disconnect")
	command.AddTextArgument("help", "[text]", "")
	command.AddNamedTextArgument("some", "help", "[text]", "", true)
	ad.AddCommand(command)
	assert.Nil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "", "disconnect")
	command.AddDynamicListArgument("help", "valid_url", true)
	ad.AddCommand(command)
	assert.Nil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "", "disconnect")
	command.AddDynamicListArgument("help", "/valid/url", true)
	items := []AutocompleteListItem{
		{
			Hint:     "help",
			Item:     "",
			HelpText: "text",
		},
	}
	command.AddStaticListArgument("help", true, items)
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	ad.AddCommand(nil)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("Disconnect", "", "")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "", "disconnect")
	command.AddBoolArgument("help", "hint", "t", true)
	command.AddNamedBoolArgument("name", "help", "hint", "t", true)
	ad.AddCommand(command)
	assert.Nil(t, ad.IsValid())
}

func TestAutocompleteDataJSON(t *testing.T) {
	ad := getAutocompleteData()
	b, err := ad.ToJSON()
	assert.Nil(t, err)
	ad2, err := AutocompleteDataFromJSON(b)
	assert.Nil(t, err)
	assert.True(t, ad2.Equals(ad))
}

func getAutocompleteData() *AutocompleteData {
	ad := NewAutocompleteData("jira", "", "Avaliable commands:")
	ad.RoleID = SYSTEM_USER_ROLE_ID
	command := NewAutocompleteData("connect", "", "Connect to mattermost")
	command.RoleID = SYSTEM_ADMIN_ROLE_ID
	items := []AutocompleteListItem{
		{
			Hint:     "arg1",
			Item:     "help1",
			HelpText: "text1",
		}, {
			Hint:     "arg2",
			Item:     "help2",
			HelpText: "text2",
		},
	}
	command.AddStaticListArgument("help", true, items)
	command.AddNamedTextArgument("some", "help", "[text]", "", true)
	command.AddNamedDynamicListArgument("other", "help", "/other/url", true)
	ad.AddCommand(command)
	return ad
}

func TestUpdateRelativeURLsForPluginCommands(t *testing.T) {
	ad := getAutocompleteData()
	baseURL, _ := url.Parse("http://localhost:8065/plugins/com.mattermost.demo-plugin")
	err := ad.UpdateRelativeURLsForPluginCommands(baseURL)
	assert.Nil(t, err)
	arg, ok := ad.SubCommands[0].Arguments[2].Data.(*AutocompleteDynamicListArg)
	assert.True(t, ok)
	assert.Equal(t, "http://localhost:8065/plugins/com.mattermost.demo-plugin/other/url", arg.FetchURL)
}
