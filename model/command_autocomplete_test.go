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
	ad.AddTextInputArgument("name", "help", "[text]", "")
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	assert.Nil(t, ad.IsValid())
	command := NewAutocompleteData("", "")
	ad.AddCommand(command)
	assert.NotNil(t, ad.IsValid())

	ad = getAutocompleteData()
	command = NewAutocompleteData("disconnect", "disconnect")
	command.AddTextInputArgument("", "help", "[text]", "")
	command.AddTextInputArgument("some", "help", "[text]", "")
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
	jira := CreateJiraAutocompleteData()
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
	ad.AddTextInputArgument("", "help", "[text]", "")
	fixedList := NewFixedListArgument()
	fixedList.AddArgument("arg1", "help1")
	fixedList.AddArgument("arg2", "help2")
	ad.AddFixedListArgument("", "help", fixedList)

	command := NewAutocompleteData("connect", "Connect to mattermost")
	command.RoleID = SYSTEM_ADMIN_ROLE_ID
	command.AddTextInputArgument("some", "help", "[text]", "")
	command.AddFetchListArgument("other", "help", "/other/url")
	ad.AddCommand(command)
	return ad
}
