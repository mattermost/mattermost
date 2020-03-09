// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// GetSuggestions returns suggestions for user input.
func (a *App) GetSuggestions(commands []*model.AutocompleteData, userInput, roleID string) []model.Suggestion {
	suggestions := []model.Suggestion{}
	index := strings.Index(userInput, " ")
	if index == -1 { // no space in user input
		for _, command := range commands {
			if strings.HasPrefix(command.Trigger, userInput) && (command.RoleID == roleID || roleID == model.SYSTEM_ADMIN_ROLE_ID || roleID == "") {
				suggestions = append(suggestions, model.Suggestion{Hint: command.Trigger, Description: command.HelpText})
			}
		}
		return suggestions
	}
	for _, command := range commands {
		input := userInput[index+1:]
		if command.Trigger == userInput[:index] && (command.RoleID == roleID || roleID == model.SYSTEM_ADMIN_ROLE_ID || roleID == "") {
			if len(command.Arguments) > 0 { //seek in arguments
				if command.Arguments[0].Name == "" { //Positional argument
					for _, arg := range command.Arguments {
						if arg.Type == model.TextInputArgumentType {
							found, changedInput, suggestion := parseInputTextArgument(arg, input)
							if found {
								suggestions = append(suggestions, suggestion)
								break
							}
							input = changedInput
						} else if arg.Type == model.StaticListArgumentType {
							found, changedInput, StaticListsuggestions := parseStaticListArgument(arg, input)
							if found {
								suggestions = append(suggestions, StaticListsuggestions...)
								break
							}
							input = changedInput
						} else if arg.Type == model.DynamicListArgumentType {
							// TODO
						}
					}
				} else { // Named argument
					//TODO
				}
			} else { //No arguments, we should seek recursively in subcommands
				subSuggestions := a.GetSuggestions(command.SubCommands, userInput[index+1:], roleID)
				suggestions = append(suggestions, subSuggestions...)
			}
		}
	}
	return suggestions
}

func parseInputTextArgument(arg *model.Argument, userInput string) (bool, string, model.Suggestion) {
	userInput = strings.TrimPrefix(userInput, " ")
	textInputArgument := arg.Data.(*model.TextInputArgument)
	if len(userInput) == 0 { //typing of the argument is not started
		return true, "", model.Suggestion{Hint: textInputArgument.Hint, Description: arg.HelpText}
	}
	if userInput[0] == '"' { //input with multiple words
		indexOfSecondQuote := strings.Index(userInput[1:], "\"")
		if indexOfSecondQuote == -1 { //typing of the multiple word argument is not finished
			return true, "", model.Suggestion{Hint: textInputArgument.Hint, Description: arg.HelpText}
		}
		// this argument is typed already
		userInput = userInput[indexOfSecondQuote+2:]
		userInput = strings.TrimPrefix(userInput, " ")
		return false, userInput, model.Suggestion{}
	}
	// input with a single word
	index := strings.Index(userInput, " ")
	if index == -1 { // typing of the single word argument is not finished
		return true, "", model.Suggestion{Hint: textInputArgument.Hint, Description: arg.HelpText}
	}
	// single word argument already typed
	userInput = userInput[index+1:]
	userInput = strings.TrimPrefix(userInput, " ")
	return false, userInput, model.Suggestion{}
}

func parseStaticListArgument(arg *model.Argument, userInput string) (bool, string, []model.Suggestion) {
	userInput = strings.TrimPrefix(userInput, " ")
	StaticListArgument := arg.Data.(*model.StaticListArgument)
	suggestions := []model.Suggestion{}
	maxPrefix := ""
	for _, arg := range StaticListArgument.PossibleArguments {
		if strings.HasPrefix(userInput, arg.Item+" ") && len(maxPrefix) < len(arg.Item)+1 {
			maxPrefix = arg.Item + " "
		}
	}
	if maxPrefix != "" { //typing StaticArgument finished
		return false, userInput[len(maxPrefix):], []model.Suggestion{}
	}
	// typing static argument not finished
	for _, arg := range StaticListArgument.PossibleArguments {
		if strings.HasPrefix(arg.Item, userInput) {
			suggestions = append(suggestions, model.Suggestion{Hint: arg.Item, Description: arg.HelpText})
		}
	}
	return true, "", suggestions
}
