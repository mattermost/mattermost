// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// GetSuggestions returns suggestions for user input.
func (a *App) GetSuggestions(commands []*model.AutocompleteData, userInput, roleID string) []model.AutocompleteSuggestion {
	return a.getSuggestions(commands, "", userInput, roleID)
}

func (a *App) getSuggestions(commands []*model.AutocompleteData, inputParsed, inputToBeParsed, roleID string) []model.AutocompleteSuggestion {
	suggestions := []model.AutocompleteSuggestion{}
	index := strings.Index(inputToBeParsed, " ")
	if index == -1 { // no space in input
		for _, command := range commands {
			if strings.HasPrefix(command.Trigger, inputToBeParsed) && (command.RoleID == roleID || roleID == model.SYSTEM_ADMIN_ROLE_ID || roleID == "") { //TODO introduce permitted roles array
				suggestion := inputParsed + command.Trigger                                                                                      // TODO check this maybe it needs a space
				suggestions = append(suggestions, model.AutocompleteSuggestion{Suggestion: suggestion, Hint: "", Description: command.HelpText}) // TODO maybe we want to have a hint here?
			}
		}
		return suggestions
	}
	for _, command := range commands {
		if command.Trigger != inputToBeParsed[:index] {
			continue
		}
		if roleID != "" && roleID != model.SYSTEM_ADMIN_ROLE_ID && roleID != command.RoleID {
			continue
		}
		toBeParsed := inputToBeParsed[index+1:]
		parsed := inputParsed + inputToBeParsed[:index+1]
		if len(command.Arguments) == 0 {
			// Seek recursively in subcommands
			subSuggestions := a.getSuggestions(command.SubCommands, parsed, toBeParsed, roleID)
			suggestions = append(suggestions, subSuggestions...)
			continue
		}
		for _, arg := range command.Arguments {
			if arg.Name == "" { //Positional argument
				if arg.Type == model.AutocompleteArgTypeText {
					found, changedParsed, changedToBeParsed, suggestion := parseInputTextArgument(arg, parsed, toBeParsed)
					if found {
						suggestions = append(suggestions, suggestion)
						break
					}
					parsed = changedParsed
					toBeParsed = changedToBeParsed
				} else if arg.Type == model.AutocompleteArgTypeStaticList {
					found, changedParsed, changedToBeParsed, staticListsuggestions := parseStaticListArgument(arg, parsed, toBeParsed)
					if found {
						suggestions = append(suggestions, staticListsuggestions...)
						break
					}
					parsed = changedParsed
					toBeParsed = changedToBeParsed
				} else if arg.Type == model.AutocompleteArgTypeDynamicList {
					// TODO https://mattermost.atlassian.net/browse/MM-21491
				}
			} else { // Named argument
				//TODO https://mattermost.atlassian.net/browse/MM-23194
			}
		}

	}
	return suggestions
}

func parseInputTextArgument(arg *model.AutocompleteArg, parsed, toBeParsed string) (found bool, alreadyParsed string, yetToBeParsed string, suggestion model.AutocompleteSuggestion) {
	in := strings.TrimPrefix(toBeParsed, " ")
	a := arg.Data.(*model.AutocompleteTextArg)
	if len(in) == 0 { //The user has not started typing the argument.
		return true, parsed + toBeParsed, "", model.AutocompleteSuggestion{Suggestion: parsed + toBeParsed, Hint: a.Hint, Description: arg.HelpText}
	}
	if in[0] == '"' { //input with multiple words
		indexOfSecondQuote := strings.Index(in[1:], `"`)
		if indexOfSecondQuote == -1 { //typing of the multiple word argument is not finished
			return true, parsed + toBeParsed, "", model.AutocompleteSuggestion{Suggestion: parsed + toBeParsed, Hint: a.Hint, Description: arg.HelpText}
		}
		// this argument is typed already
		offset := 2
		if len(in) > indexOfSecondQuote+2 && in[indexOfSecondQuote+2] == ' ' {
			offset++
		}
		return false, parsed + in[:indexOfSecondQuote+offset], in[indexOfSecondQuote+offset:], model.AutocompleteSuggestion{}
	}
	// input with a single word
	index := strings.Index(in, " ")
	if index == -1 { // typing of the single word argument is not finished
		return true, parsed + toBeParsed, "", model.AutocompleteSuggestion{Suggestion: parsed + toBeParsed, Hint: a.Hint, Description: arg.HelpText}
	}
	// single word argument already typed
	return false, parsed + in[:index+1], in[index+1:], model.AutocompleteSuggestion{}
}

func parseStaticListArgument(arg *model.AutocompleteArg, parsed, toBeParsed string) (found bool, alreadyParsed string, yetToBeParsed string, suggestions []model.AutocompleteSuggestion) {
	in := strings.TrimPrefix(toBeParsed, " ")
	a := arg.Data.(*model.AutocompleteStaticListArg)
	maxPrefix := ""
	for _, arg := range a.PossibleArguments {
		if strings.HasPrefix(in, arg.Item+" ") && len(maxPrefix) < len(arg.Item)+1 {
			maxPrefix = arg.Item + " "
		}
	}
	if maxPrefix != "" { //typing StaticArgument finished
		return false, parsed + in[:len(maxPrefix)], in[len(maxPrefix):], []model.AutocompleteSuggestion{}
	}
	// user has not finished typing static argument
	for _, arg := range a.PossibleArguments {
		if strings.HasPrefix(arg.Item, in) {
			suggestions = append(suggestions, model.AutocompleteSuggestion{Suggestion: parsed + arg.Item, Hint: arg.Hint, Description: a.HelpText})
		}
	}
	return true, parsed + toBeParsed, "", suggestions
}
