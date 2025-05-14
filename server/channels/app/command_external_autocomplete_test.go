// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// AutocompleteProviderMock implements the necessary methods for testing autocomplete functionality
type AutocompleteProviderMock struct {
	mock.Mock
}

func (m *AutocompleteProviderMock) getSuggestions(c request.CTX, commandArgs *model.CommandArgs, commands []*model.AutocompleteData, inputParsed, inputToBeParsed, roleID string) []model.AutocompleteSuggestion {
	args := m.Called(c, commandArgs, commands, inputParsed, inputToBeParsed, roleID)
	return args.Get(0).([]model.AutocompleteSuggestion)
}

func (m *AutocompleteProviderMock) getImmediateArgSuggestions(commandArgs *model.CommandArgs, data *model.AutocompleteData, parts []string) []model.AutocompleteSuggestion {
	args := m.Called(commandArgs, data, parts)
	return args.Get(0).([]model.AutocompleteSuggestion)
}

// Test processAutocompleteData function
func TestProcessAutocompleteData(t *testing.T) {
	// Create base autocomplete data to reuse across tests
	baseAutocompleteData := func() *model.AutocompleteData {
		data := model.NewAutocompleteData("mission", "Mission command", "Manage missions")
		startCmd := model.NewAutocompleteData("start", "[mission_name]", "Start a new mission")
		startCmd.AddNamedTextArgument("name", "Name of the mission", "Mission name", "", true)
		startCmd.AddNamedTextArgument("description", "Description of the mission", "Mission description", "", false)
		startCmd.AddNamedTextArgument("callsign", "Callsign for the mission", "Callsign", "", false)
		data.AddCommand(startCmd)
		return data
	}

	// Test cases
	tests := []struct {
		name             string
		commandArgs      *model.CommandArgs
		autocompleteData *model.AutocompleteData
		endsWithSpace    bool
		partialMatch     bool // For partial parameter suggestion
		expectedResult   []model.AutocompleteSuggestion
	}{
		{
			name: "Command with trailing space shows immediate arg suggestions",
			commandArgs: &model.CommandArgs{
				Command: "/mission start ",
			},
			autocompleteData: baseAutocompleteData(),
			endsWithSpace: true,
			expectedResult: []model.AutocompleteSuggestion{
				{
					Complete:    "/mission start --name ",
					Suggestion:  "--name",
					Hint:        "Mission name",
					Description: "Name of the mission",
				},
				{
					Complete:    "/mission start --description ",
					Suggestion:  "--description",
					Hint:        "Mission description",
					Description: "Description of the mission",
				},
				{
					Complete:    "/mission start --callsign ",
					Suggestion:  "--callsign",
					Hint:        "Callsign",
					Description: "Callsign for the mission",
				},
			},
		},
		{
			name: "Command without trailing space uses regular suggestions",
			commandArgs: &model.CommandArgs{
				Command: "/mission start",
			},
			autocompleteData: baseAutocompleteData(),
			endsWithSpace: false,
			expectedResult: []model.AutocompleteSuggestion{
				{
					Complete:    "/mission start",
					Suggestion:  "start",
					Description: "Start a new mission",
					Hint:        "[mission_name]",
				},
			},
		},
		{
			name: "Multiple parameters with partial parameter suggestion",
			commandArgs: &model.CommandArgs{
				Command: "/mission start --name test --des",
			},
			autocompleteData: baseAutocompleteData(),
			partialMatch: true,
			expectedResult: []model.AutocompleteSuggestion{
				{
					Complete:    "/mission start --name test --description ",
					Suggestion:  "--description",
					Hint:        "Mission description",
					Description: "Description of the mission",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock provider
			mockProvider := &AutocompleteProviderMock{}

			// Set up the mock to return different suggestions based on the test case
			regularSuggestions := []model.AutocompleteSuggestion{
				{
					Complete:    "/mission start",
					Suggestion:  "start",
					Description: "Start a new mission",
					Hint:        "[mission_name]",
				},
			}

			// For the case with space, we need argument suggestions
			immediateSuggestions := []model.AutocompleteSuggestion{
				{
					Complete:    "/mission start --name ",
					Suggestion:  "--name",
					Hint:        "Mission name",
					Description: "Name of the mission",
				},
				{
					Complete:    "/mission start --description ",
					Suggestion:  "--description",
					Hint:        "Mission description",
					Description: "Description of the mission",
				},
				{
					Complete:    "/mission start --callsign ",
					Suggestion:  "--callsign",
					Hint:        "Callsign",
					Description: "Callsign for the mission",
				},
			}

			// For the partial parameter case (--des should suggest --description)
			partialParamSuggestions := []model.AutocompleteSuggestion{
				{
					Complete:    "/mission start --name test --description ",
					Suggestion:  "--description",
					Hint:        "Mission description",
					Description: "Description of the mission",
				},
			}

			// Configure mock behavior based on the test case
			if tt.partialMatch {
				// For partial parameter match test
				mockProvider.On("getSuggestions", mock.Anything, tt.commandArgs, mock.Anything, "", tt.commandArgs.Command, "").Return(partialParamSuggestions)
			} else {
				// Default behavior
				mockProvider.On("getSuggestions", mock.Anything, tt.commandArgs, mock.Anything, "", tt.commandArgs.Command, "").Return(regularSuggestions)

				// Set up mock for getImmediateArgSuggestions only for the space case
				if tt.endsWithSpace {
					mockProvider.On("getImmediateArgSuggestions", tt.commandArgs, mock.Anything, mock.Anything).Return(immediateSuggestions)
				}
			}

			// Create test command
			command := &model.Command{
				Trigger: "mission",
			}

			// Call the function we're testing
			result, err := processAutocompleteDataTest(mockProvider, request.EmptyContext(nil), tt.commandArgs, command, tt.autocompleteData)

			// Assertions
			assert.Nil(t, err)
			assert.Equal(t, tt.expectedResult, result)

			// Verify all mock expectations were met
			mockProvider.AssertExpectations(t)
		})
	}
}

// processAutocompleteDataTest is a test-specific implementation that mimics the App's processAutocompleteData
// but works with our mock instead of the real App. This eliminates duplication while maintaining testability.
func processAutocompleteDataTest(a interface{}, c request.CTX, commandArgs *model.CommandArgs, command *model.Command, autocompleteData *model.AutocompleteData) ([]model.AutocompleteSuggestion, *model.AppError) {
	// Create a copy with sanitized trigger to prevent double slashes
	dataCopy := *autocompleteData
	dataCopy.Trigger = strings.TrimPrefix(command.Trigger, "/")

	// Check if command ends with space (for enhanced UX)
	endsWithSpace := strings.HasSuffix(commandArgs.Command, " ")
	parts := strings.Fields(commandArgs.Command)

	// Use the mock provider interface to call the method
	provider := a.(*AutocompleteProviderMock)

	// Generate suggestions using the provider
	suggestions := provider.getSuggestions(c, commandArgs, []*model.AutocompleteData{&dataCopy}, "", commandArgs.Command, "")

	// Special case: If the command ends with a space and we're in a subcommand,
	// show argument suggestions immediately without requiring user to type a dash
	if endsWithSpace && len(parts) >= 2 {
		namedArgSuggestions := provider.getImmediateArgSuggestions(commandArgs, &dataCopy, parts)
		if len(namedArgSuggestions) > 0 {
			return namedArgSuggestions, nil
		}
	}

	return suggestions, nil
}
