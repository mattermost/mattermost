// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
)

func TestParseStaticListArgument(t *testing.T) {
	fixedArgs := model.NewAutocompleteStaticListArg("help text for the argument")
	fixedArgs.AddArgument("on", "help")

	argument := &model.AutocompleteArg{
		Name:     "", //positional
		HelpText: "some_help",
		Type:     model.AutocompleteArgTypeStaticList,
		Data:     fixedArgs,
	}
	found, _, _, suggestions := parseStaticListArgument(argument, "", "") //TODO understand this!
	assert.True(t, found)
	assert.Equal(t, []model.AutocompleteSuggestion{{Suggestion: "on", Hint: "help", Description: "help text for the argument"}}, suggestions)

	found, _, _, suggestions = parseStaticListArgument(argument, "", "o")
	assert.True(t, found)
	assert.Equal(t, []model.AutocompleteSuggestion{{Suggestion: "on", Hint: "help", Description: "help text for the argument"}}, suggestions)

	found, parsed, toBeParsed, _ := parseStaticListArgument(argument, "", "on ")
	assert.False(t, found)
	assert.Equal(t, "on ", parsed)
	assert.Equal(t, "", toBeParsed)

	found, parsed, toBeParsed, _ = parseStaticListArgument(argument, "", "on some")
	assert.False(t, found)
	assert.Equal(t, "on ", parsed)
	assert.Equal(t, "some", toBeParsed)

	fixedArgs.AddArgument("off", "help")

	found, _, _, suggestions = parseStaticListArgument(argument, "", "o")
	assert.True(t, found)
	assert.Equal(t, []model.AutocompleteSuggestion{{Suggestion: "on", Hint: "help", Description: "help text for the argument"}, {Suggestion: "off", Hint: "help", Description: "help text for the argument"}}, suggestions)

	found, _, _, suggestions = parseStaticListArgument(argument, "", "of")
	assert.True(t, found)
	assert.Equal(t, []model.AutocompleteSuggestion{{Suggestion: "off", Hint: "help", Description: "help text for the argument"}}, suggestions)

	found, _, _, suggestions = parseStaticListArgument(argument, "", "o some")
	assert.True(t, found)
	assert.Len(t, suggestions, 0)

	found, parsed, toBeParsed, _ = parseStaticListArgument(argument, "", "off some")
	assert.False(t, found)
	assert.Equal(t, "off ", parsed)
	assert.Equal(t, "some", toBeParsed)

	fixedArgs.AddArgument("onon", "help")

	found, _, _, suggestions = parseStaticListArgument(argument, "", "on")
	assert.True(t, found)
	assert.Equal(t, []model.AutocompleteSuggestion{{Suggestion: "on", Hint: "help", Description: "help text for the argument"}, {Suggestion: "onon", Hint: "help", Description: "help text for the argument"}}, suggestions)

	found, _, _, suggestions = parseStaticListArgument(argument, "", "ono")
	assert.True(t, found)
	assert.Equal(t, []model.AutocompleteSuggestion{{Suggestion: "onon", Hint: "help", Description: "help text for the argument"}}, suggestions)

	found, parsed, toBeParsed, _ = parseStaticListArgument(argument, "", "on some")
	assert.False(t, found)
	assert.Equal(t, "on ", parsed)
	assert.Equal(t, "some", toBeParsed)

	found, parsed, toBeParsed, _ = parseStaticListArgument(argument, "", "onon some")
	assert.False(t, found)
	assert.Equal(t, "onon ", parsed)
	assert.Equal(t, "some", toBeParsed)
}

func TestParseInputTextArgument(t *testing.T) {
	argument := &model.AutocompleteArg{
		Name:     "", //positional
		HelpText: "some_help",
		Type:     model.AutocompleteArgTypeText,
		Data:     &model.AutocompleteTextArg{Hint: "hint", Pattern: "pat"},
	}

	found, _, _, suggestion := parseInputTextArgument(argument, "", "")
	assert.True(t, found)
	assert.Equal(t, model.AutocompleteSuggestion{Suggestion: "", Hint: "hint", Description: "some_help"}, suggestion)

	found, _, _, suggestion = parseInputTextArgument(argument, "", " ")
	assert.True(t, found)
	assert.Equal(t, model.AutocompleteSuggestion{Suggestion: " ", Hint: "hint", Description: "some_help"}, suggestion)

	found, _, _, suggestion = parseInputTextArgument(argument, "", "abc")
	assert.True(t, found)
	assert.Equal(t, model.AutocompleteSuggestion{Suggestion: "abc", Hint: "hint", Description: "some_help"}, suggestion)

	found, _, _, suggestion = parseInputTextArgument(argument, "", "\"abc dfd df ")
	assert.True(t, found)
	assert.Equal(t, model.AutocompleteSuggestion{Suggestion: "\"abc dfd df ", Hint: "hint", Description: "some_help"}, suggestion)

	found, parsed, toBeParsed, _ := parseInputTextArgument(argument, "", "abc efg ")
	assert.False(t, found)
	assert.Equal(t, "abc ", parsed)
	assert.Equal(t, "efg ", toBeParsed)

	found, parsed, toBeParsed, _ = parseInputTextArgument(argument, "", "abc ")
	assert.False(t, found)
	assert.Equal(t, "abc ", parsed)
	assert.Equal(t, "", toBeParsed)

	found, parsed, toBeParsed, _ = parseInputTextArgument(argument, "", "\"abc def\" abc")
	assert.False(t, found)
	assert.Equal(t, "\"abc def\" ", parsed)
	assert.Equal(t, "abc", toBeParsed)

	found, parsed, toBeParsed, _ = parseInputTextArgument(argument, "", "\"abc def\"")
	assert.False(t, found)
	assert.Equal(t, "\"abc def\"", parsed)
	assert.Equal(t, "", toBeParsed)
}

func TestSuggestions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	jira := model.CreateJiraAutocompleteData()
	suggestions := th.App.GetSuggestions([]*model.AutocompleteData{jira}, "ji", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 1)
	assert.Equal(t, jira.Trigger, suggestions[0].Suggestion)
	assert.Equal(t, "", suggestions[0].Hint)
	assert.Equal(t, jira.HelpText, suggestions[0].Description)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira crea", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 1)
	assert.Equal(t, "jira create", suggestions[0].Suggestion)
	assert.Equal(t, "", suggestions[0].Hint)
	assert.Equal(t, "Create a new Issue", suggestions[0].Description)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira c", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 2)
	assert.Equal(t, "jira create", suggestions[1].Suggestion)
	assert.Equal(t, "", suggestions[1].Hint)
	assert.Equal(t, "Create a new Issue", suggestions[1].Description)
	assert.Equal(t, "jira connect", suggestions[0].Suggestion)
	assert.Equal(t, "", suggestions[0].Hint)
	assert.Equal(t, "Connect your Mattermost account to your Jira account", suggestions[0].Description)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira create ", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 1)
	assert.Equal(t, "jira create ", suggestions[0].Suggestion)
	assert.Equal(t, "[text]", suggestions[0].Hint)
	assert.Equal(t, "This text is optional, will be inserted into the description field", suggestions[0].Description)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira create some", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 1)
	assert.Equal(t, "jira create some", suggestions[0].Suggestion)
	assert.Equal(t, "[text]", suggestions[0].Hint)
	assert.Equal(t, "This text is optional, will be inserted into the description field", suggestions[0].Description)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira create some text ", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 0)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "invalid command", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 0)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira settings notifications o", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 2)
	assert.Equal(t, "jira settings notifications on", suggestions[0].Suggestion)
	assert.Equal(t, "Turn notifications on", suggestions[0].Hint)
	assert.Equal(t, "Notification settings", suggestions[0].Description)
	assert.Equal(t, "jira settings notifications off", suggestions[1].Suggestion)
	assert.Equal(t, "Turn notifications off", suggestions[1].Hint)
	assert.Equal(t, "Notification settings", suggestions[1].Description)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira ", model.SYSTEM_ADMIN_ROLE_ID)
	assert.Len(t, suggestions, 10)

	suggestions = th.App.GetSuggestions([]*model.AutocompleteData{jira}, "jira ", model.SYSTEM_USER_ROLE_ID)
	assert.Len(t, suggestions, 8)
}
