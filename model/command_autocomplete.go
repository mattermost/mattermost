// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/url"
	"reflect"

	"github.com/pkg/errors"
)

// Argument types
const (
	AutocompleteTextArgType        = "TextInput"
	AutocompleteStaticListArgType  = "StaticList"
	AutocompleteDynamicListArgType = "DynamicList"
)

// AutocompleteData describes slash command autocomplete information.
type AutocompleteData struct {
	// Trigger of the command
	Trigger string
	// Text displayed to the user to help with the autocomplete
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
	Type string
	// Actual data of the argument(depends on the Type)
	Data interface{}
}

// AutocompleteTextArg describes text user can input as an argument.
type AutocompleteTextArg struct {
	// Hint of the input text
	Hint string
	// Regex pattern to match
	Pattern string
}

// AutocompleteStaticListIem describes an item in the AutocompleteStaticListArg.
type AutocompleteStaticListIem struct {
	Item     string
	HelpText string
}

// AutocompleteStaticListArg is used to input one of the arguments from the list,
// for example [yes, no], [on, off], and so on.
type AutocompleteStaticListArg struct {
	PossibleArguments []AutocompleteStaticListIem
}

// AutocompleteDynamicListArg is used when user wants to download possible argument list from the URL.
type AutocompleteDynamicListArg struct {
	FetchURL string
}

// AutocompleteSuggestion describes single suggestion item sent to front
type AutocompleteSuggestion struct {
	// Hint describes what user might want to input
	Hint string
	// Description of the command
	Description string
}

// NewAutocompleteData returns new Autocomplete data.
func NewAutocompleteData(trigger string, helpText string) *AutocompleteData {
	return &AutocompleteData{
		Trigger:     trigger,
		HelpText:    helpText,
		RoleID:      SYSTEM_USER_ROLE_ID,
		Arguments:   []*AutocompleteArg{},
		SubCommands: []*AutocompleteData{},
	}
}

// AddCommand add a subcommand to the autocomplete data.
func (ad *AutocompleteData) AddCommand(command *AutocompleteData) {
	ad.SubCommands = append(ad.SubCommands, command)
}

// AddTextArgument adds AutocompleteTextArgType argument to the command.
func (ad *AutocompleteData) AddTextArgument(name, helpText, hint, pattern string) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteTextArgType,
		Data:     &AutocompleteTextArg{Hint: hint, Pattern: pattern},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddStaticListArgument adds AutocompleteStaticListArgType argument to the command.
func (ad *AutocompleteData) AddStaticListArgument(name, helpText string, listArgument *AutocompleteStaticListArg) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteStaticListArgType,
		Data:     listArgument,
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddDynamicListArgument adds AutocompleteDynamicListArgType argument to the command.
func (ad *AutocompleteData) AddDynamicListArgument(name, helpText, url string) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteDynamicListArgType,
		Data:     &AutocompleteDynamicListArg{FetchURL: url},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// Equals method checks if command is the same.
func (ad *AutocompleteData) Equals(command *AutocompleteData) bool {
	if !(ad.Trigger == command.Trigger && ad.HelpText == command.HelpText && ad.RoleID == command.RoleID) {
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
	if ad.Trigger == "" {
		return errors.New("An empty command name in the autocomplete data")
	}
	roles := []string{SYSTEM_ADMIN_ROLE_ID, SYSTEM_USER_ROLE_ID, ""}
	if stringNotInSlice(ad.RoleID, roles) {
		return errors.New("Wrong role in the autocomplete data")
	}
	if len(ad.Arguments) > 0 {
		namedArgumentIndex := -1
		for i, arg := range ad.Arguments {
			if !(arg.Name == "") { // it's a named argument
				if namedArgumentIndex == -1 { // first named argument
					namedArgumentIndex = i
				}
			} else { // it's a positional argument
				if namedArgumentIndex != -1 {
					return errors.New("Named argument should not be before positional argument")
				}
			}
			if arg.Type == AutocompleteDynamicListArgType {
				DynamicList, ok := arg.Data.(*AutocompleteDynamicListArg)
				if !ok {
					return errors.New("Not a proper DynamicList type argument")
				}
				_, err := url.ParseRequestURI(DynamicList.FetchURL)
				if err != nil {
					return errors.Wrapf(err, "FetchURL is not a proper url")
				}
			} else if arg.Type == AutocompleteStaticListArgType {
				StaticList, ok := arg.Data.(*AutocompleteStaticListArg)
				if !ok {
					return errors.New("Not a proper StaticList type argument")
				}
				for _, arg := range StaticList.PossibleArguments {
					if arg.Item == "" {
						return errors.New("Possible argument name not set in StaticList argument")
					}
				}
			} else if arg.Type == AutocompleteTextArgType {
				if _, ok := arg.Data.(*AutocompleteTextArg); !ok {
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

// ToJSON encodes AutocompleteData struct to the json
func (ad *AutocompleteData) ToJSON() ([]byte, error) {
	b, err := json.Marshal(ad)
	if err != nil {
		return nil, errors.Wrapf(err, "can't marshal slash command %s", ad.Trigger)
	}
	return b, nil
}

// AutocompleteDataFromJSON decodes AutocompleteData struct form the json
func AutocompleteDataFromJSON(data []byte) (*AutocompleteData, error) {
	var ad AutocompleteData
	if err := json.Unmarshal(data, &ad); err != nil {
		return nil, errors.Wrap(err, "can't unmarshal slash command data")
	}
	return &ad, nil
}

// UnmarshalJSON will unmarshal argument
func (a *AutocompleteArg) UnmarshalJSON(b []byte) error {
	var arg map[string]interface{}
	if err := json.Unmarshal(b, &arg); err != nil {
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

	if a.Type == AutocompleteTextArgType {
		m := data.(map[string]interface{})
		pattern, ok := m["Pattern"]
		if !ok {
			return errors.Errorf("No field Pattern in the TextInput argument %s", string(b))
		}
		hint, ok := m["Hint"]
		if !ok {
			return errors.Errorf("No field Hint in the TextInput argument %s", string(b))
		}
		a.Data = &AutocompleteTextArg{Hint: hint.(string), Pattern: pattern.(string)}
	} else if a.Type == AutocompleteStaticListArgType {
		m := data.(map[string]interface{})
		listInterface, ok := m["PossibleArguments"]
		if !ok {
			return errors.Errorf("No field PossibleArguments in the StaticList argument %s", string(b))
		}

		list := listInterface.([]interface{})
		possibleArguments := []AutocompleteStaticListIem{}
		for i := range list {
			args := list[i].(map[string]interface{})
			itemInt, ok := args["Item"]
			if !ok {
				return errors.Errorf("No field Item in the StaticList's possible arguments %s", string(b))
			}
			item := itemInt.(string)

			helpTextInt, ok := args["HelpText"]
			if !ok {
				return errors.Errorf("No field HelpText in the StaticList's possible arguments %s", string(b))
			}
			helpText := helpTextInt.(string)

			possibleArguments = append(possibleArguments, AutocompleteStaticListIem{
				Item:     item,
				HelpText: helpText,
			})
		}
		a.Data = &AutocompleteStaticListArg{PossibleArguments: possibleArguments}
	} else if a.Type == AutocompleteDynamicListArgType {
		m := data.(map[string]interface{})
		url, ok := m["FetchURL"]
		if !ok {
			return errors.Errorf("No field FetchURL in the DynamicList's argument %s", string(b))
		}
		a.Data = &AutocompleteDynamicListArg{FetchURL: url.(string)}
	}
	return nil
}

// NewAutocompleteStaticListArg returned empty AutocompleteStaticListArgType argument.
func NewAutocompleteStaticListArg() *AutocompleteStaticListArg {
	return &AutocompleteStaticListArg{
		PossibleArguments: []AutocompleteStaticListIem{},
	}
}

// AddArgument adds a static argument to the StaticList argument.
func (a *AutocompleteStaticListArg) AddArgument(text, helpText string) {
	argument := AutocompleteStaticListIem{
		Item:     text,
		HelpText: helpText,
	}
	a.PossibleArguments = append(a.PossibleArguments, argument)
}

// AutocompleteSuggestionsToJSON returns json for a list of AutocompleteSuggestion objects
func AutocompleteSuggestionsToJSON(suggestions []AutocompleteSuggestion) []byte {
	b, _ := json.Marshal(suggestions)
	return b
}

// AutocompleteSuggestionsFromJSON returns list of AutocompleteSuggestions from json.
func AutocompleteSuggestionsFromJSON(data io.Reader) []AutocompleteSuggestion {
	var o []AutocompleteSuggestion
	json.NewDecoder(data).Decode(&o)
	return o
}

func stringNotInSlice(a string, slice []string) bool {
	for _, b := range slice {
		if b == a {
			return false
		}
	}
	return true
}

// CreateJiraAutocompleteData will create autocomplete data for jira plugin. For testing purposes only.
func CreateJiraAutocompleteData() *AutocompleteData {
	jira := NewAutocompleteData("jira", "Available commands: connect, assign, disconnect, create, transition, view, subscribe, settings, install cloud/server, uninstall cloud/server, help")

	connect := NewAutocompleteData("connect", "Connect your Mattermost account to your Jira account")
	jira.AddCommand(connect)

	disconnect := NewAutocompleteData("disconnect", "Disconnect your Mattermost account from your Jira account")
	jira.AddCommand(disconnect)

	assign := NewAutocompleteData("assign", "Change the assignee of a Jira issue")
	assign.AddDynamicListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	assign.AddDynamicListArgument("", "List of assignees is downloading from your Jira account", "/url/assignee")
	jira.AddCommand(assign)

	create := NewAutocompleteData("create", "Create a new Issue")
	create.AddTextArgument("", "This text is optional, will be inserted into the description field", "[text]", "")
	jira.AddCommand(create)

	transition := NewAutocompleteData("transition", "Change the state of a Jira issue")
	assign.AddDynamicListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	assign.AddDynamicListArgument("", "List of states is downloading from your Jira account", "/url/states")
	jira.AddCommand(transition)

	subscribe := NewAutocompleteData("subscribe", "Configure the Jira notifications sent to this channel")
	jira.AddCommand(subscribe)

	view := NewAutocompleteData("view", "View the details of a specific Jira issue")
	assign.AddDynamicListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	jira.AddCommand(view)

	settings := NewAutocompleteData("settings", "Update your user settings")
	notifications := NewAutocompleteData("notifications", "Turn notifications on or off")
	argument := NewAutocompleteStaticListArg()
	argument.AddArgument("on", "Turn notifications on")
	argument.AddArgument("off", "Turn notifications off")
	notifications.AddStaticListArgument("", "Turn notifications on or off", argument)
	settings.AddCommand(notifications)
	jira.AddCommand(settings)

	install := NewAutocompleteData("install", "Connect Mattermost to a Jira instance")
	install.RoleID = SYSTEM_ADMIN_ROLE_ID
	cloud := NewAutocompleteData("cloud", "Connect to a Jira Cloud instance")
	urlPattern := "https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)"
	cloud.AddTextArgument("", "input URL of the Jira Cloud instance", "[URL]", urlPattern)
	install.AddCommand(cloud)
	server := NewAutocompleteData("server", "Connect to a Jira Server or Data Center instance")
	server.AddTextArgument("", "input URL of the Jira Server or Data Center instance", "[URL]", urlPattern)
	install.AddCommand(server)
	jira.AddCommand(install)

	uninstall := NewAutocompleteData("uninstall", "Disconnect Mattermost from a Jira instance")
	uninstall.RoleID = SYSTEM_ADMIN_ROLE_ID
	cloud = NewAutocompleteData("cloud", "Disconnect from a Jira Cloud instance")
	cloud.AddTextArgument("", "input URL of the Jira Cloud instance", "[URL]", urlPattern)
	uninstall.AddCommand(cloud)
	server = NewAutocompleteData("server", "Disconnect from a Jira Server or Data Center instance")
	server.AddTextArgument("", "input URL of the Jira Server or Data Center instance", "[URL]", urlPattern)
	uninstall.AddCommand(server)
	jira.AddCommand(uninstall)

	return jira
}
