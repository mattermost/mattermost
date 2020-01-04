// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/url"
	"reflect"

	"github.com/pkg/errors"
)

const (
	// TextInputArgumentType represents TextInputArgument type
	TextInputArgumentType = "TextInput"
	// FixedListArgumentType represents FixedListArgument type
	FixedListArgumentType = "FixedList"
	// FetchListArgumentType represents FetchListArgument type
	FetchListArgumentType = "FetchList"
)

// AutocompleteData describes slash command autocomplete information.
type AutocompleteData struct {
	// Name of the command
	CommandName string
	// Text displayed to the user to help with the autocomplete
	HelpText string
	// Role of the user who should be able to see the autocomplete info of this command
	RoleID string
	// Arguments of the command. Arguments can be named or positional.
	// If they are positional order in the list matters, if they are named order does not matter.
	// All arguments should be either named or positional, no mixing allowed.
	Arguments []*Argument
	// Subcommands of the command
	SubCommands []*AutocompleteData
}

// Argument describes an argument of the command. Arguments can be named or positional.
// If Name is empty string Argument is positional otherwise it is named argument.
// Named arguments are passed as --Name Argument_Value.
type Argument struct {
	// Name of the argument
	Name string
	// Text displayed to the user to help with the autocomplete
	HelpText string
	// Type of the argument
	Type string
	// Actual data of the argument(depends on the Type)
	Data interface{}
}

// TextInputArgument describes text user can input as an argument.
type TextInputArgument struct {
	// Regex pattern to match
	Pattern string
}

// FixedArgument describes an item in the FixedListArgument.
type FixedArgument struct {
	Item     string
	HelpText string
}

// FixedListArgument is used to input one of the arguments from the list,
// for example [yes, no], [true, false], and so on.
type FixedListArgument struct {
	PossibleArguments []FixedArgument
}

// FetchListArgument is used when user wants to download possible argument list from the URL.
type FetchListArgument struct {
	FetchURL string
}

// NewAutocompleteData returns new Autocomplete data.
func NewAutocompleteData(name string, helpText string) *AutocompleteData {
	return &AutocompleteData{
		CommandName: name,
		HelpText:    helpText,
		RoleID:      SYSTEM_USER_ROLE_ID,
		Arguments:   []*Argument{},
		SubCommands: []*AutocompleteData{},
	}
}

// AddCommand add a subcommand to the autocomplete data.
func (ad *AutocompleteData) AddCommand(command *AutocompleteData) {
	ad.SubCommands = append(ad.SubCommands, command)
}

// AddTextInputArgument adds TextInput argument to the command.
func (ad *AutocompleteData) AddTextInputArgument(name, helpText, pattern string) {
	argument := Argument{
		Name:     name,
		HelpText: helpText,
		Type:     TextInputArgumentType,
		Data:     &TextInputArgument{Pattern: pattern},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddFixedListArgument adds FixedList argument to the command.
func (ad *AutocompleteData) AddFixedListArgument(name, helpText string, listArgument *FixedListArgument) {
	argument := Argument{
		Name:     name,
		HelpText: helpText,
		Type:     FixedListArgumentType,
		Data:     listArgument,
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddFetchListArgument adds FetchList argument to the command.
func (ad *AutocompleteData) AddFetchListArgument(name, helpText, url string) {
	argument := Argument{
		Name:     name,
		HelpText: helpText,
		Type:     FetchListArgumentType,
		Data:     &FetchListArgument{FetchURL: url},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// Equals method checks if command is the same.
func (ad *AutocompleteData) Equals(command *AutocompleteData) bool {
	if !(ad.CommandName == command.CommandName && ad.HelpText == command.HelpText && ad.RoleID == command.RoleID) {
		return false
	}
	if len(ad.Arguments) != len(command.Arguments) || len(ad.SubCommands) != len(command.SubCommands) {
		return false
	}
	for i := range ad.Arguments {
		if ad.Arguments[i].Name != command.Arguments[i].Name ||
			ad.Arguments[i].HelpText != command.Arguments[i].HelpText ||
			ad.Arguments[i].Type != command.Arguments[i].Type ||
			!reflect.DeepEqual(ad.Arguments[i].Data, command.Arguments[i].Data) {
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

// IsValid method checks if autocomplete data is valid.
func (ad *AutocompleteData) IsValid() error {
	if ad.CommandName == "" {
		return errors.New("An empty command name in the autocomplete data")
	}
	roles := []string{SYSTEM_ADMIN_ROLE_ID, SYSTEM_USER_ROLE_ID}
	if stringNotInSlice(ad.RoleID, roles) {
		return errors.New("Wrong role in the autocomplete data")
	}
	if len(ad.Arguments) > 0 {
		isPositional := ad.Arguments[0].Name == ""
		for _, arg := range ad.Arguments {
			if isPositional != (arg.Name == "") {
				return errors.New("All arguments should be either positional or named")
			}
			if arg.Type == FetchListArgumentType {
				fetchList, ok := arg.Data.(*FetchListArgument)
				if !ok {
					return errors.New("Not a proper FetchList type argument")
				}
				_, err := url.ParseRequestURI(fetchList.FetchURL)
				if err != nil {
					return errors.Wrapf(err, "FetchURL is not a proper url")
				}
			} else if arg.Type == FixedListArgumentType {
				fixedList, ok := arg.Data.(*FixedListArgument)
				if !ok {
					return errors.New("Not a proper FixedList type argument")
				}
				for _, arg := range fixedList.PossibleArguments {
					if arg.Item == "" {
						return errors.New("Possible argument name not set in FixedList argument")
					}
				}
			} else if arg.Type == TextInputArgumentType {
				_, ok := arg.Data.(*TextInputArgument)
				if !ok {
					return errors.New("Not a proper TextInput type argument")
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

func (ad *AutocompleteData) ToJSON() ([]byte, error) {
	b, err := json.Marshal(ad)
	if err != nil {
		return nil, errors.Wrapf(err, "can't marshal slash command %s", ad.CommandName)
	}
	return b, nil
}

func AutocompleteDataFromJSON(data []byte) (*AutocompleteData, error) {
	var ad AutocompleteData
	err := json.Unmarshal(data, &ad)
	if err != nil {
		return nil, errors.Wrap(err, "can't unmarshal slash command data")
	}
	return &ad, nil
}

// UnmarshalJSON will unmarshal argument
func (a *Argument) UnmarshalJSON(b []byte) error {
	var arg map[string]interface{}
	err := json.Unmarshal(b, &arg)
	if err != nil {
		return errors.Wrapf(err, "Can't unmarshal argument %s", string(b))
	}
	name, ok := arg["Name"]
	if !ok {
		return errors.Errorf("No field Name in the argument %s", string(b))
	}
	a.Name = name.(string)

	helpText, ok := arg["HelpText"]
	if !ok {
		return errors.Errorf("No field HelpText in the argument %s", string(b))
	}
	a.HelpText = helpText.(string)

	argType, ok := arg["Type"]
	if !ok {
		return errors.Errorf("No field Type in the argument %s", string(b))
	}
	a.Type = argType.(string)

	data, ok := arg["Data"]
	if !ok {
		return errors.Errorf("No field Data in the argument %s", string(b))
	}

	if a.Type == TextInputArgumentType {
		m := data.(map[string]interface{})
		pattern, ok := m["Pattern"]
		if !ok {
			return errors.Errorf("No field Pattern in the TextInput argument %s", string(b))
		}
		a.Data = &TextInputArgument{Pattern: pattern.(string)}
	} else if a.Type == FixedListArgumentType {
		m := data.(map[string]interface{})
		listInterface, ok := m["PossibleArguments"]
		if !ok {
			return errors.Errorf("No field PossibleArguments in the FixedList argument %s", string(b))
		}

		list := listInterface.([]interface{})
		possibleArguments := []FixedArgument{}
		for i := range list {
			args := list[i].(map[string]interface{})
			itemInt, ok := args["Item"]
			if !ok {
				return errors.Errorf("No field Item in the FixedList's possible arguments %s", string(b))
			}
			item := itemInt.(string)

			helpTextInt, ok := args["HelpText"]
			if !ok {
				return errors.Errorf("No field HelpText in the FixedList's possible arguments %s", string(b))
			}
			helpText := helpTextInt.(string)

			possibleArguments = append(possibleArguments, FixedArgument{
				Item:     item,
				HelpText: helpText,
			})
		}
		a.Data = &FixedListArgument{PossibleArguments: possibleArguments}
	} else if a.Type == FetchListArgumentType {
		m := data.(map[string]interface{})
		url, ok := m["FetchURL"]
		if !ok {
			return errors.Errorf("No field FetchURL in the FetchList's argument %s", string(b))
		}
		a.Data = &FetchListArgument{FetchURL: url.(string)}
	}
	return nil
}

// NewFixedListArgument returned empty FixedList argument.
func NewFixedListArgument() *FixedListArgument {
	return &FixedListArgument{
		PossibleArguments: []FixedArgument{},
	}
}

// AddArgument adds a fixed argument to the FixedList argument.
func (a *FixedListArgument) AddArgument(text, helpText string) {
	argument := FixedArgument{
		Item:     text,
		HelpText: helpText,
	}
	a.PossibleArguments = append(a.PossibleArguments, argument)
}

func stringNotInSlice(a string, slice []string) bool {
	for _, b := range slice {
		if b == a {
			return false
		}
	}
	return true
}
