// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// GetSuggestions returns suggestions for user input.
func (a *App) GetSuggestions(commands []*model.AutocompleteData, userInput, roleID string) []model.AutocompleteSuggestion {
	suggestions := []model.AutocompleteSuggestion{}
	index := strings.Index(userInput, " ")
	if index == -1 { // no space in user input
		for _, command := range commands {
			if strings.HasPrefix(command.Trigger, userInput) && (command.RoleID == roleID || roleID == model.SYSTEM_ADMIN_ROLE_ID || roleID == "") {
				suggestions = append(suggestions, model.AutocompleteSuggestion{Hint: command.Trigger, Description: command.HelpText})
			}
		}
		return suggestions
	}
	for _, command := range commands {
		input := userInput[index+1:]
		if command.Trigger != userInput[:index] {
			continue
		}
		if roleID != "" && roleID != model.SYSTEM_ADMIN_ROLE_ID && roleID != command.RoleID {
			continue
		}
		if len(command.Arguments) == 0 {
			// Seek recursively in subcommands
			subSuggestions := a.GetSuggestions(command.SubCommands, userInput[index+1:], roleID)
			suggestions = append(suggestions, subSuggestions...)
			continue
		}
		if command.Arguments[0].Name == "" { //Positional argument
			for _, arg := range command.Arguments {
				if arg.Type == model.AutocompleteTextArgType {
					found, changedInput, suggestion := parseInputTextArgument(arg, input)
					if found {
						suggestions = append(suggestions, suggestion)
						break
					}
					input = changedInput
				} else if arg.Type == model.AutocompleteStaticListArgType {
					found, changedInput, StaticListsuggestions := parseStaticListArgument(arg, input)
					if found {
						suggestions = append(suggestions, StaticListsuggestions...)
						break
					}
					input = changedInput
				} else if arg.Type == model.AutocompleteDynamicListArgType {
					// TODO https://mattermost.atlassian.net/browse/MM-21491
				}
			}
		} else { // Named argument
			//TODO https://mattermost.atlassian.net/browse/MM-23194
		}
	}
	return suggestions
}

func parseInputTextArgument(arg *model.AutocompleteArg, userInput string) (bool, string, model.AutocompleteSuggestion) {
	in := strings.TrimPrefix(userInput, " ")
	a := arg.Data.(*model.AutocompleteTextArg)
	if len(in) == 0 { //typing of the argument is not started
		return true, "", model.AutocompleteSuggestion{Hint: a.Hint, Description: arg.HelpText}
	}
	if in[0] == '"' { //input with multiple words
		indexOfSecondQuote := strings.Index(in[1:], "\"")
		if indexOfSecondQuote == -1 { //typing of the multiple word argument is not finished
			return true, "", model.AutocompleteSuggestion{Hint: a.Hint, Description: arg.HelpText}
		}
		// this argument is typed already
		in = in[indexOfSecondQuote+2:]
		in = strings.TrimPrefix(in, " ")
		return false, in, model.AutocompleteSuggestion{}
	}
	// input with a single word
	index := strings.Index(in, " ")
	if index == -1 { // typing of the single word argument is not finished
		return true, "", model.AutocompleteSuggestion{Hint: a.Hint, Description: arg.HelpText}
	}
	// single word argument already typed
	in = in[index+1:]
	in = strings.TrimPrefix(in, " ")
	return false, in, model.AutocompleteSuggestion{}
}

func parseStaticListArgument(arg *model.AutocompleteArg, userInput string) (bool, string, []model.AutocompleteSuggestion) {
	in := strings.TrimPrefix(userInput, " ")
	a := arg.Data.(*model.AutocompleteStaticListArg)
	suggestions := []model.AutocompleteSuggestion{}
	maxPrefix := ""
	for _, arg := range a.PossibleArguments {
		if strings.HasPrefix(in, arg.Item+" ") && len(maxPrefix) < len(arg.Item)+1 {
			maxPrefix = arg.Item + " "
		}
	}
	if maxPrefix != "" { //typing StaticArgument finished
		return false, in[len(maxPrefix):], []model.AutocompleteSuggestion{}
	}
	// typing static argument not finished
	for _, arg := range a.PossibleArguments {
		if strings.HasPrefix(arg.Item, in) {
			suggestions = append(suggestions, model.AutocompleteSuggestion{Hint: arg.Item, Description: arg.HelpText})
		}
	}
	return true, "", suggestions
}
