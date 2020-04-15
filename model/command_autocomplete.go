// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/url"
	"path"
	"reflect"

	"github.com/pkg/errors"
)

// Argument types
const (
	AutocompleteArgTypeText        = "TextInput"
	AutocompleteArgTypeStaticList  = "StaticList"
	AutocompleteArgTypeDynamicList = "DynamicList"
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
	Type string
	// Actual data of the argument (depends on the Type)
	Data interface{}
}

// AutocompleteTextArg describes text user can input as an argument.
type AutocompleteTextArg struct {
	// Hint of the input text
	Hint string
	// Regex pattern to match
	Pattern string
}

// AutocompleteStaticListItem describes an item in the AutocompleteStaticListArg.
type AutocompleteStaticListItem struct {
	Hint string
	Item string
}

// AutocompleteStaticListArg is used to input one of the arguments from the list,
// for example [yes, no], [on, off], and so on.
type AutocompleteStaticListArg struct {
	PossibleArguments []AutocompleteStaticListItem
}

// AutocompleteDynamicListArg is used when user wants to download possible argument list from the URL.
type AutocompleteDynamicListArg struct {
	FetchURL string
}

// AutocompleteSuggestion describes a single suggestion item sent to the frontend
type AutocompleteSuggestion struct {
	// Suggestion describes what user might want to input
	Suggestion string
	// Hint describes a hint about the suggested input
	Hint string
	// Description of the command
	Description string
}

// NewAutocompleteData returns new Autocomplete data.
func NewAutocompleteData(trigger, hint, helpText string) *AutocompleteData {
	return &AutocompleteData{
		Trigger:     trigger,
		Hint:        hint,
		HelpText:    helpText,
		RoleID:      SYSTEM_USER_ROLE_ID,
		Arguments:   []*AutocompleteArg{},
		SubCommands: []*AutocompleteData{},
	}
}

// AddCommand adds a subcommand to the autocomplete data.
func (ad *AutocompleteData) AddCommand(command *AutocompleteData) {
	ad.SubCommands = append(ad.SubCommands, command)
}

// AddTextArgument adds AutocompleteArgTypeText argument to the command.
func (ad *AutocompleteData) AddTextArgument(name, helpText, hint, pattern string) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteArgTypeText,
		Data:     &AutocompleteTextArg{Hint: hint, Pattern: pattern},
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddStaticListArgument adds AutocompleteArgTypeStaticList argument to the command.
func (ad *AutocompleteData) AddStaticListArgument(name, helpText string, listArgument *AutocompleteStaticListArg) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteArgTypeStaticList,
		Data:     listArgument,
	}
	ad.Arguments = append(ad.Arguments, &argument)
}

// AddDynamicListArgument adds AutocompleteArgTypeDynamicList argument to the command.
func (ad *AutocompleteData) AddDynamicListArgument(name, helpText, url string) {
	argument := AutocompleteArg{
		Name:     name,
		HelpText: helpText,
		Type:     AutocompleteArgTypeDynamicList,
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

// AutocompleteDataFromJSON decodes AutocompleteData struct from the json
func AutocompleteDataFromJSON(data []byte) (*AutocompleteData, error) {
	var ad AutocompleteData
	if err := json.Unmarshal(data, &ad); err != nil {
		return nil, errors.Wrap(err, "can't unmarshal AutocompleteData")
	}
	return &ad, nil
}

// Equals method checks if argument is the same.
func (a *AutocompleteArg) Equals(arg *AutocompleteArg) bool {
	if a.Name != arg.Name ||
		a.HelpText != arg.HelpText ||
		a.Type != arg.Type ||
		!reflect.DeepEqual(a.Data, arg.Data) {
		return false
	}
	return true
}

// UnmarshalJSON will unmarshal argument
func (a *AutocompleteArg) UnmarshalJSON(b []byte) error {
	var arg map[string]interface{}
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

	a.Type, ok = arg["Type"].(string)
	if !ok {
		return errors.Errorf("No field Type in the argument %s", string(b))
	}

	data, ok := arg["Data"]
	if !ok {
		return errors.Errorf("No field Data in the argument %s", string(b))
	}

	if a.Type == AutocompleteArgTypeText {
		m, ok := data.(map[string]interface{})
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
		m, ok := data.(map[string]interface{})
		if !ok {
			return errors.Errorf("Wrong Data type in the StaticList argument %s", string(b))
		}
		list, ok := m["PossibleArguments"].([]interface{})
		if !ok {
			return errors.Errorf("No field PossibleArguments in the StaticList argument %s", string(b))
		}

		possibleArguments := []AutocompleteStaticListItem{}
		for i := range list {
			args, ok := list[i].(map[string]interface{})
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

			possibleArguments = append(possibleArguments, AutocompleteStaticListItem{
				Item: item,
				Hint: hint,
			})
		}
		a.Data = &AutocompleteStaticListArg{PossibleArguments: possibleArguments}
	} else if a.Type == AutocompleteArgTypeDynamicList {
		m, ok := data.(map[string]interface{})
		if !ok {
			return errors.Errorf("Wrong type type in the DynamicList argument %s", string(b))
		}
		url, ok := m["FetchURL"].(string)
		if !ok {
			return errors.Errorf("No field FetchURL in the DynamicList's argument %s", string(b))
		}
		a.Data = &AutocompleteDynamicListArg{FetchURL: url}
	}
	return nil
}

// NewAutocompleteStaticListArg returns an empty AutocompleteArgTypeStaticList argument.
func NewAutocompleteStaticListArg() *AutocompleteStaticListArg {
	return &AutocompleteStaticListArg{
		PossibleArguments: []AutocompleteStaticListItem{},
	}
}

// AddArgument adds a static argument to the StaticList argument.
func (a *AutocompleteStaticListArg) AddArgument(text, hint string) {
	argument := AutocompleteStaticListItem{
		Item: text,
		Hint: hint,
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

// AutocompleteStaticListItemsToJSON returns json for a list of AutocompleteStaticListItem objects
func AutocompleteStaticListItemsToJSON(items []AutocompleteStaticListItem) []byte {
	b, _ := json.Marshal(items)
	return b
}

// AutocompleteStaticListItemsFromJSON returns list of AutocompleteStaticListItem from json.
func AutocompleteStaticListItemsFromJSON(data io.Reader) []AutocompleteStaticListItem {
	var o []AutocompleteStaticListItem
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
	jira := NewAutocompleteData("jira", "[command]", "Available commands: connect, assign, disconnect, create, transition, view, subscribe, settings, install cloud/server, uninstall cloud/server, help")

	connect := NewAutocompleteData("connect", "[url]", "Connect your Mattermost account to your Jira account")
	jira.AddCommand(connect)

	disconnect := NewAutocompleteData("disconnect", "", "Disconnect your Mattermost account from your Jira account")
	jira.AddCommand(disconnect)

	assign := NewAutocompleteData("assign", "[issue]", "Change the assignee of a Jira issue")
	assign.AddDynamicListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	assign.AddDynamicListArgument("", "List of assignees is downloading from your Jira account", "/url/assignee")
	jira.AddCommand(assign)

	create := NewAutocompleteData("create", "[issue text]", "Create a new Issue")
	create.AddTextArgument("", "This text is optional, will be inserted into the description field", "[text]", "")
	jira.AddCommand(create)

	transition := NewAutocompleteData("transition", "[issue]", "Change the state of a Jira issue")
	assign.AddDynamicListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	assign.AddDynamicListArgument("", "List of states is downloading from your Jira account", "/url/states")
	jira.AddCommand(transition)

	subscribe := NewAutocompleteData("subscribe", "", "Configure the Jira notifications sent to this channel")
	jira.AddCommand(subscribe)

	view := NewAutocompleteData("view", "[issue]", "View the details of a specific Jira issue")
	assign.AddDynamicListArgument("", "List of issues is downloading from your Jira account", "/url/issue-key")
	jira.AddCommand(view)

	settings := NewAutocompleteData("settings", "", "Update your user settings")
	notifications := NewAutocompleteData("notifications", "[on/off]", "Turn notifications on or off")
	argument := NewAutocompleteStaticListArg()
	argument.AddArgument("on", "Turn notifications on")
	argument.AddArgument("off", "Turn notifications off")
	notifications.AddStaticListArgument("", "Turn notifications on or off", argument)
	settings.AddCommand(notifications)
	jira.AddCommand(settings)

	timezone := NewAutocompleteData("timezone", "", "Update your timezone")
	timezone.AddTextArgument("zone", "Set timezone", "[UTC+07:00]", "")
	jira.AddCommand(timezone)

	install := NewAutocompleteData("install", "", "Connect Mattermost to a Jira instance")
	install.RoleID = SYSTEM_ADMIN_ROLE_ID
	cloud := NewAutocompleteData("cloud", "", "Connect to a Jira Cloud instance")
	urlPattern := "https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)"
	cloud.AddTextArgument("", "input URL of the Jira Cloud instance", "[URL]", urlPattern)
	install.AddCommand(cloud)
	server := NewAutocompleteData("server", "", "Connect to a Jira Server or Data Center instance")
	server.AddTextArgument("", "input URL of the Jira Server or Data Center instance", "[URL]", urlPattern)
	install.AddCommand(server)
	jira.AddCommand(install)

	uninstall := NewAutocompleteData("uninstall", "", "Disconnect Mattermost from a Jira instance")
	uninstall.RoleID = SYSTEM_ADMIN_ROLE_ID
	cloud = NewAutocompleteData("cloud", "", "Disconnect from a Jira Cloud instance")
	cloud.AddTextArgument("", "input URL of the Jira Cloud instance", "[URL]", urlPattern)
	uninstall.AddCommand(cloud)
	server = NewAutocompleteData("server", "", "Disconnect from a Jira Server or Data Center instance")
	server.AddTextArgument("", "input URL of the Jira Server or Data Center instance", "[URL]", urlPattern)
	uninstall.AddCommand(server)
	jira.AddCommand(uninstall)

	return jira
}
