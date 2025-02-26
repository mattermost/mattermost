// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/url"
	"path"
	"reflect"
	"slices"
	"strings"

	"github.com/pkg/errors"
)

// AutocompleteArgType describes autocomplete argument type
type AutocompleteArgType string

// Argument types
const (
	AutocompleteArgTypeText        AutocompleteArgType = "TextInput"
	AutocompleteArgTypeStaticList  AutocompleteArgType = "StaticList"
	AutocompleteArgTypeDynamicList AutocompleteArgType = "DynamicList"
)

// AutocompleteData describes slash command autocomplete information.
type AutocompleteData struct {
	// Trigger of the command
	Trigger string
	// Hint of a command
	Hint string
	// Text displayed to the user to help with the autocomplete description
	HelpText string
	// Role of the user who should be able to see the autocomplete info of this command
	RoleID string
	// Arguments of the command. Arguments can be named or positional.
	// If they are positional order in the list matters, if they are named order does not matter.
	// All arguments should be either named or positional, no mixing allowed.
	Arguments []*AutocompleteArg
	// Subcommands of the command
	SubCommands []*AutocompleteData
}

// AutocompleteArg describes an argument of the command. Arguments can be named or positional.
// If Name is empty string Argument is positional otherwise it is named argument.
// Named arguments are passed as --Name Argument_Value.
type AutocompleteArg struct {
	// Name of the argument
	Name string
	// Text displayed to the user to help with the autocomplete
	HelpText string
	// Type of the argument
	Type AutocompleteArgType
	// Required determines if argument is optional or not.
	Required bool
	// Actual data of the argument (depends on the Type)
	Data any
}

// AutocompleteTextArg describes text user can input as an argument.
type AutocompleteTextArg struct {
	// Hint of the input text
	Hint string
	// Regex pattern to match
	Pattern string
}

// AutocompleteListItem describes an item in the AutocompleteStaticListArg.
type AutocompleteListItem struct {
	Item     string
	Hint     string
	HelpText string
}

// AutocompleteStaticListArg is used to input one of the arguments from the list,
// for example [yes, no], [on, off], and so on.
type AutocompleteStaticListArg struct {
	PossibleArguments []AutocompleteListItem
}

// AutocompleteDynamicListArg is used when user wants to download possible argument list from the URL.
type AutocompleteDynamicListArg struct {
	FetchURL string
}

// AutocompleteSuggestion describes a single suggestion item sent to the front-end
// Example: for user input `/jira cre` -
// Complete might be `/jira create`
// Suggestion might be `create`,
// Hint might be `[issue text]`,
// Description might be `Create a new Issue`
type AutocompleteSuggestion struct {
	// Complete describes completed suggestion
	Complete string
	// Suggestion describes what user might want to input next
	Suggestion string
	// Hint describes a hint about the suggested input
	Hint string
	// Description of the command or a suggestion
	Description string
	// IconData is base64 encoded svg image
	IconData string
}

// NewAutocompleteData returns new Autocomplete data.
func NewAutocompleteData(trigger, hint, helpText string) *AutocompleteData {
	return &AutocompleteData{
		Trigger:     trigger,
		Hint:        hint,
		HelpText:    helpText,
		RoleID:      SystemUserRoleId,
		Arguments:   []*AutocompleteArg{},
		SubCommands: []*AutocompleteData{},
	}
}

// AddCommand adds a subcommand to the autocomplete data.
func (ad *AutocompleteData) AddCommand(command *AutocompleteData) {
	ad.SubCommands = append(ad.SubCommands, command)
}

// AddTextArgument adds positional AutocompleteArgTypeText argument to the command.
func (ad *AutocompleteData) AddTextArgument(helpText, hint, pattern string) {
	ad.AddNamedTextArgument("", helpText, hint, pattern, true)
}

// AddNamedTextArgument adds named AutocompleteArgTypeText argument to the command.
func (ad *AutocompleteData) AddNamedTextArgument(name, helpText, hint, pattern string, required bool) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteArgTypeText,
		Required: required,
		Data:     &AutocompleteTextArg{Hint: hint, Pattern: pattern},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddStaticListArgument adds positional AutocompleteArgTypeStaticList argument to the command.
func (ad *AutocompleteData) AddStaticListArgument(helpText string, required bool, items []AutocompleteListItem) {
	ad.AddNamedStaticListArgument("", helpText, required, items)
}

// AddNamedStaticListArgument adds named AutocompleteArgTypeStaticList argument to the command.
func (ad *AutocompleteData) AddNamedStaticListArgument(name, helpText string, required bool, items []AutocompleteListItem) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteArgTypeStaticList,
		Required: required,
		Data:     &AutocompleteStaticListArg{PossibleArguments: items},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddDynamicListArgument adds positional AutocompleteArgTypeDynamicList argument to the command.
func (ad *AutocompleteData) AddDynamicListArgument(helpText, url string, required bool) {
	ad.AddNamedDynamicListArgument("", helpText, url, required)
}

// AddNamedDynamicListArgument adds named AutocompleteArgTypeDynamicList argument to the command.
func (ad *AutocompleteData) AddNamedDynamicListArgument(name, helpText, url string, required bool) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteArgTypeDynamicList,
		Required: required,
		Data:     &AutocompleteDynamicListArg{FetchURL: url},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// Equals method checks if command is the same.
func (ad *AutocompleteData) Equals(command *AutocompleteData) bool {
	if !(ad.Trigger == command.Trigger && ad.HelpText == command.HelpText && ad.RoleID == command.RoleID && ad.Hint == command.Hint) {
		return false
	}
	if len(ad.Arguments) != len(command.Arguments) || len(ad.SubCommands) != len(command.SubCommands) {
		return false
	}
	for i := range ad.Arguments {
		if !ad.Arguments[i].Equals(command.Arguments[i]) {
			return false
		}
	}
	for i := range ad.SubCommands {
		if !ad.SubCommands[i].Equals(command.SubCommands[i]) {
			return false
		}
	}
	return true
}

// UpdateRelativeURLsForPluginCommands method updates relative urls for plugin commands
func (ad *AutocompleteData) UpdateRelativeURLsForPluginCommands(baseURL *url.URL) error {
	for _, arg := range ad.Arguments {
		if arg.Type != AutocompleteArgTypeDynamicList {
			continue
		}
		dynamicList, ok := arg.Data.(*AutocompleteDynamicListArg)
		if !ok {
			return errors.New("Not a proper DynamicList type argument")
		}
		dynamicListURL, err := url.Parse(dynamicList.FetchURL)
		if err != nil {
			return errors.Wrapf(err, "FetchURL is not a proper url")
		}
		if !dynamicListURL.IsAbs() {
			absURL := &url.URL{}
			*absURL = *baseURL
			absURL.Path = path.Join(absURL.Path, dynamicList.FetchURL)
			dynamicList.FetchURL = absURL.String()
		}
	}
	for _, command := range ad.SubCommands {
		err := command.UpdateRelativeURLsForPluginCommands(baseURL)
		if err != nil {
			return err
		}
	}
	return nil
}

// IsValid method checks if autocomplete data is valid.
func (ad *AutocompleteData) IsValid() error {
	if ad == nil {
		return errors.New("No nil commands are allowed in AutocompleteData")
	}
	if ad.Trigger == "" {
		return errors.New("An empty command name in the autocomplete data")
	}
	if strings.ToLower(ad.Trigger) != ad.Trigger {
		return errors.New("Command should be lowercase")
	}
	roles := []string{SystemAdminRoleId, SystemUserRoleId, ""}
	if !slices.Contains(roles, ad.RoleID) {
		return errors.New("Wrong role in the autocomplete data")
	}
	if len(ad.Arguments) > 0 && len(ad.SubCommands) > 0 {
		return errors.New("Command can't have arguments and subcommands")
	}
	if len(ad.Arguments) > 0 {
		namedArgumentIndex := -1
		for i, arg := range ad.Arguments {
			if arg.Name != "" { // it's a named argument
				if namedArgumentIndex == -1 { // first named argument
					namedArgumentIndex = i
				}
			} else { // it's a positional argument
				if namedArgumentIndex != -1 {
					return errors.New("Named argument should not be before positional argument")
				}
			}
			if arg.Type == AutocompleteArgTypeDynamicList {
				dynamicList, ok := arg.Data.(*AutocompleteDynamicListArg)
				if !ok {
					return errors.New("Not a proper DynamicList type argument")
				}
				_, err := url.Parse(dynamicList.FetchURL)
				if err != nil {
					return errors.Wrapf(err, "FetchURL is not a proper url")
				}
			} else if arg.Type == AutocompleteArgTypeStaticList {
				staticList, ok := arg.Data.(*AutocompleteStaticListArg)
				if !ok {
					return errors.New("Not a proper StaticList type argument")
				}
				for _, arg := range staticList.PossibleArguments {
					if arg.Item == "" {
						return errors.New("Possible argument name not set in StaticList argument")
					}
				}
			} else if arg.Type == AutocompleteArgTypeText {
				if _, ok := arg.Data.(*AutocompleteTextArg); !ok {
					return errors.New("Not a proper TextInput type argument")
				}
				if arg.Name == "" && !arg.Required {
					return errors.New("Positional argument can not be optional")
				}
			}
		}
	}
	for _, command := range ad.SubCommands {
		err := command.IsValid()
		if err != nil {
			return err
		}
	}
	return nil
}

// Equals method checks if argument is the same.
func (a *AutocompleteArg) Equals(arg *AutocompleteArg) bool {
	if a.Name != arg.Name ||
		a.HelpText != arg.HelpText ||
		a.Type != arg.Type ||
		a.Required != arg.Required ||
		!reflect.DeepEqual(a.Data, arg.Data) {
		return false
	}
	return true
}

// UnmarshalJSON will unmarshal argument
func (a *AutocompleteArg) UnmarshalJSON(b []byte) error {
	var arg map[string]any
	if err := json.Unmarshal(b, &arg); err != nil {
		return errors.Wrapf(err, "Can't unmarshal argument %s", string(b))
	}
	var ok bool
	a.Name, ok = arg["Name"].(string)
	if !ok {
		return errors.Errorf("No field Name in the argument %s", string(b))
	}

	a.HelpText, ok = arg["HelpText"].(string)
	if !ok {
		return errors.Errorf("No field HelpText in the argument %s", string(b))
	}

	t, ok := arg["Type"].(string)
	if !ok {
		return errors.Errorf("No field Type in the argument %s", string(b))
	}
	a.Type = AutocompleteArgType(t)

	a.Required, ok = arg["Required"].(bool)
	if !ok {
		return errors.Errorf("No field Required in the argument %s", string(b))
	}

	data, ok := arg["Data"]
	if !ok {
		return errors.Errorf("No field Data in the argument %s", string(b))
	}

	if a.Type == AutocompleteArgTypeText {
		m, ok := data.(map[string]any)
		if !ok {
			return errors.Errorf("Wrong Data type in the TextInput argument %s", string(b))
		}
		pattern, ok := m["Pattern"].(string)
		if !ok {
			return errors.Errorf("No field Pattern in the TextInput argument %s", string(b))
		}
		hint, ok := m["Hint"].(string)
		if !ok {
			return errors.Errorf("No field Hint in the TextInput argument %s", string(b))
		}
		a.Data = &AutocompleteTextArg{Hint: hint, Pattern: pattern}
	} else if a.Type == AutocompleteArgTypeStaticList {
		m, ok := data.(map[string]any)
		if !ok {
			return errors.Errorf("Wrong Data type in the StaticList argument %s", string(b))
		}
		list, ok := m["PossibleArguments"].([]any)
		if !ok {
			return errors.Errorf("No field PossibleArguments in the StaticList argument %s", string(b))
		}

		possibleArguments := []AutocompleteListItem{}
		for i := range list {
			args, ok := list[i].(map[string]any)
			if !ok {
				return errors.Errorf("Wrong AutocompleteStaticListItem type in the StaticList argument %s", string(b))
			}
			item, ok := args["Item"].(string)
			if !ok {
				return errors.Errorf("No field Item in the StaticList's possible arguments %s", string(b))
			}

			hint, ok := args["Hint"].(string)
			if !ok {
				return errors.Errorf("No field Hint in the StaticList's possible arguments %s", string(b))
			}
			helpText, ok := args["HelpText"].(string)
			if !ok {
				return errors.Errorf("No field Hint in the StaticList's possible arguments %s", string(b))
			}

			possibleArguments = append(possibleArguments, AutocompleteListItem{
				Item:     item,
				Hint:     hint,
				HelpText: helpText,
			})
		}
		a.Data = &AutocompleteStaticListArg{PossibleArguments: possibleArguments}
	} else if a.Type == AutocompleteArgTypeDynamicList {
		m, ok := data.(map[string]any)
		if !ok {
			return errors.Errorf("Wrong type in the DynamicList argument %s", string(b))
		}
		url, ok := m["FetchURL"].(string)
		if !ok {
			return errors.Errorf("No field FetchURL in the DynamicList's argument %s", string(b))
		}
		a.Data = &AutocompleteDynamicListArg{FetchURL: url}
	}
	return nil
}
