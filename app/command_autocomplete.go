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
				if arg.Type == model.AutocompleteArgTypeText {
					found, changedInput, suggestion := parseInputTextArgument(arg, input)
					if found {
						suggestions = append(suggestions, suggestion)
						break
					}
					input = changedInput
				} else if arg.Type == model.AutocompleteArgTypeStaticList {
					found, changedInput, StaticListsuggestions := parseStaticListArgument(arg, input)
					if found {
						suggestions = append(suggestions, StaticListsuggestions...)
						break
					}
					input = changedInput
				} else if arg.Type == model.AutocompleteArgTypeDynamicList {
					// TODO https://mattermost.atlassian.net/browse/MM-21491
				}
			}
		} else { // Named argument
			//TODO https://mattermost.atlassian.net/browse/MM-23194
		}
	}
	return suggestions
}

func parseInputTextArgument(arg *model.AutocompleteArg, userInput string) (found bool, chanedInput string, suggestion model.AutocompleteSuggestion) {
	in := strings.TrimPrefix(userInput, " ")
	a := arg.Data.(*model.AutocompleteTextArg)
	if len(in) == 0 { //The user has not started typing the argument.
		return true, "", model.AutocompleteSuggestion{Hint: a.Hint, Description: arg.HelpText}
	}
	if in[0] == '"' { //input with multiple words
		in = in[1:]
		indexOfSecondQuote := strings.Index(in, `"`)
		if indexOfSecondQuote == -1 { //typing of the multiple word argument is not finished
			return true, "", model.AutocompleteSuggestion{Hint: a.Hint, Description: arg.HelpText}
		}
		// this argument is typed already
		in = in[indexOfSecondQuote+1:]
		in = strings.TrimPrefix(in, " ")
		return false, in, model.AutocompleteSuggestion{}
	}
	// input with a single word
	index := strings.Index(in, " ")
	if index == -1 { // user has not finished typing the single word argument
		return true, "", model.AutocompleteSuggestion{Hint: a.Hint, Description: arg.HelpText}
	}
	// single word argument already typed
	in = in[index+1:]
	in = strings.TrimPrefix(in, " ")
	return false, in, model.AutocompleteSuggestion{}
}

func parseStaticListArgument(arg *model.AutocompleteArg, userInput string) (found bool, changedInput string, suggestions []model.AutocompleteSuggestion) {
	in := strings.TrimPrefix(userInput, " ")
	a := arg.Data.(*model.AutocompleteStaticListArg)
	maxPrefix := ""
	for _, arg := range a.PossibleArguments {
		if strings.HasPrefix(in, arg.Item+" ") && len(maxPrefix) < len(arg.Item)+1 {
			maxPrefix = arg.Item + " "
		}
	}
	if maxPrefix != "" { //typing StaticArgument finished
		return false, in[len(maxPrefix):], []model.AutocompleteSuggestion{}
	}
	// user has not finished typing static argument
	for _, arg := range a.PossibleArguments {
		if strings.HasPrefix(arg.Item, in) {
			suggestions = append(suggestions, model.AutocompleteSuggestion{Hint: arg.Item, Description: arg.HelpText})
		}
	}
	return true, "", suggestions
}
