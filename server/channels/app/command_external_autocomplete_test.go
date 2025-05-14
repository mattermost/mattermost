// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetCommandExternalSuggestions(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("empty autocomplete URL", func(t *testing.T) {
		commandArgs := &model.CommandArgs{
			Command:   "/test arg1",
			UserId:    "user-id",
			TeamId:    "team-id",
			ChannelId: "channel-id",
		}

		command := &model.Command{
			Trigger:                "test",
			AutocompleteRequestURL: "",
		}

		suggestions, err := th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.Nil(t, err)
		assert.Empty(t, suggestions)
	})

	t.Run("invalid autocomplete URL", func(t *testing.T) {
		commandArgs := &model.CommandArgs{
			Command:   "/test arg1",
			UserId:    "user-id",
			TeamId:    "team-id",
			ChannelId: "channel-id",
		}

		command := &model.Command{
			Trigger:                "test",
			AutocompleteRequestURL: "http://invalid:url:with:colon",
		}

		suggestions, err := th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.NotNil(t, err)
		assert.Equal(t, "app.command.external_autocomplete.request_create.app_error", err.Id)
		assert.Empty(t, suggestions)
	})

	t.Run("server returns error status code", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer ts.Close()

		commandArgs := &model.CommandArgs{
			Command:   "/test arg1",
			UserId:    "user-id",
			TeamId:    "team-id",
			ChannelId: "channel-id",
		}

		command := &model.Command{
			Trigger:                "test",
			AutocompleteRequestURL: ts.URL,
		}

		suggestions, err := th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.NotNil(t, err)
		assert.Equal(t, "app.command.external_autocomplete.response_error.app_error", err.Id)
		assert.Empty(t, suggestions)
	})

	t.Run("server returns AutocompleteData array", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
			assert.Equal(t, "application/json", r.Header.Get("Accept"))

			// Verify URL parameters
			query := r.URL.Query()
			assert.Equal(t, "test", query.Get("trigger"))
			assert.Equal(t, "arg1", query.Get("text"))
			assert.Equal(t, "channel-id", query.Get("channel_id"))
			assert.Equal(t, "team-id", query.Get("team_id"))
			assert.Equal(t, "user-id", query.Get("user_id"))
			assert.Equal(t, "/test arg1", query.Get("user_input"))

			// Return autocomplete data array
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[
				{
					"trigger": "test",
					"hint": "Test command",
					"helpText": "This is a test command",
					"subcommands": [
						{
							"trigger": "subcommand",
							"hint": "Subcommand hint",
							"helpText": "Subcommand help text"
						}
					]
				}
			]`))
		}))
		defer ts.Close()

		commandArgs := &model.CommandArgs{
			Command:   "/test arg1",
			UserId:    "user-id",
			TeamId:    "team-id",
			ChannelId: "channel-id",
		}

		command := &model.Command{
			Trigger:                "test",
			AutocompleteRequestURL: ts.URL,
			Token:                  "test-token",
		}

		suggestions, err := th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.Nil(t, err)
		assert.NotEmpty(t, suggestions)
	})

	t.Run("server returns AutocompleteSuggestion array", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "Token test-token", r.Header.Get("Authorization"))

			// Return autocomplete suggestion array
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[
				{
					"Complete": "test subcommand",
					"Suggestion": "subcommand",
					"Hint": "Subcommand hint",
					"Description": "Subcommand description"
				}
			]`))
		}))
		defer ts.Close()

		commandArgs := &model.CommandArgs{
			Command:   "/test",
			UserId:    "user-id",
			TeamId:    "team-id",
			ChannelId: "channel-id",
		}

		command := &model.Command{
			Trigger:                "test",
			AutocompleteRequestURL: ts.URL,
			Token:                  "test-token",
		}

		suggestions, err := th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.Nil(t, err)
		require.Len(t, suggestions, 1)
		assert.Equal(t, "test subcommand", suggestions[0].Complete)
		assert.Equal(t, "subcommand", suggestions[0].Suggestion)
		assert.Equal(t, "Subcommand hint", suggestions[0].Hint)
		assert.Equal(t, "Subcommand description", suggestions[0].Description)
	})

	t.Run("server returns suggestions for commands with multiple named arguments", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			query := r.URL.Query()

			// If the command has multiple arguments, return suggestions based on the current state
			userInput := query.Get("user_input")

			var responseBody string
			if userInput == "/test command --color" {
				// User is typing a color argument
				responseBody = `[
					{
						"Complete": "test command --color blue",
						"Suggestion": "blue",
						"Hint": "[color]",
						"Description": "Set the color to blue"
					},
					{
						"Complete": "test command --color red",
						"Suggestion": "red",
						"Hint": "[color]",
						"Description": "Set the color to red"
					},
					{
						"Complete": "test command --color green",
						"Suggestion": "green",
						"Hint": "[color]",
						"Description": "Set the color to green"
					}
				]`
			} else if userInput == "/test command --color blue" {
				// User has typed the color, now suggest the next argument
				responseBody = `[
					{
						"Complete": "test command --color blue --size ",
						"Suggestion": "--size",
						"Hint": "[small|medium|large]",
						"Description": "Set the size"
					},
					{
						"Complete": "test command --color blue --shape ",
						"Suggestion": "--shape",
						"Hint": "[circle|square]",
						"Description": "Set the shape"
					}
				]`
			} else if userInput == "/test command --color blue --size" {
				// User is typing the size argument
				responseBody = `[
					{
						"Complete": "test command --color blue --size small",
						"Suggestion": "small",
						"Hint": "[size]",
						"Description": "Small size"
					},
					{
						"Complete": "test command --color blue --size medium",
						"Suggestion": "medium",
						"Hint": "[size]",
						"Description": "Medium size"
					},
					{
						"Complete": "test command --color blue --size large",
						"Suggestion": "large",
						"Hint": "[size]",
						"Description": "Large size"
					}
				]`
			} else {
				// Initial command suggestions
				responseBody = `[
					{
						"Complete": "test command --color ",
						"Suggestion": "--color",
						"Hint": "[blue|red|green]",
						"Description": "Set the color"
					},
					{
						"Complete": "test command --shape ",
						"Suggestion": "--shape",
						"Hint": "[circle|square]",
						"Description": "Set the shape"
					}
				]`
			}

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(responseBody))
		}))
		defer ts.Close()

		// Test initial command suggestions
		commandArgs := &model.CommandArgs{
			Command:   "/test command",
			UserId:    "user-id",
			TeamId:    "team-id",
			ChannelId: "channel-id",
		}

		command := &model.Command{
			Trigger:                "test",
			AutocompleteRequestURL: ts.URL,
		}

		suggestions, err := th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.Nil(t, err)
		require.Len(t, suggestions, 2)
		assert.Equal(t, "test command --color ", suggestions[0].Complete)
		assert.Equal(t, "--color", suggestions[0].Suggestion)
		assert.Equal(t, "[blue|red|green]", suggestions[0].Hint)

		// Test color argument suggestions
		commandArgs.Command = "/test command --color"
		suggestions, err = th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.Nil(t, err)
		require.Len(t, suggestions, 3)
		assert.Equal(t, "test command --color blue", suggestions[0].Complete)
		assert.Equal(t, "blue", suggestions[0].Suggestion)
		assert.Equal(t, "[color]", suggestions[0].Hint)

		// Test after specifying a color
		commandArgs.Command = "/test command --color blue"
		suggestions, err = th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.Nil(t, err)
		require.Len(t, suggestions, 2)
		assert.Equal(t, "test command --color blue --size ", suggestions[0].Complete)
		assert.Equal(t, "--size", suggestions[0].Suggestion)
		assert.Equal(t, "[small|medium|large]", suggestions[0].Hint)

		// Test size argument suggestions
		commandArgs.Command = "/test command --color blue --size"
		suggestions, err = th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.Nil(t, err)
		require.Len(t, suggestions, 3)
		assert.Equal(t, "test command --color blue --size small", suggestions[0].Complete)
		assert.Equal(t, "small", suggestions[0].Suggestion)
		assert.Equal(t, "[size]", suggestions[0].Hint)
	})

	t.Run("server returns invalid JSON", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Return invalid JSON
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"invalid": json`))
		}))
		defer ts.Close()

		commandArgs := &model.CommandArgs{
			Command:   "/test",
			UserId:    "user-id",
			TeamId:    "team-id",
			ChannelId: "channel-id",
		}

		command := &model.Command{
			Trigger:                "test",
			AutocompleteRequestURL: ts.URL,
		}

		suggestions, err := th.App.getCommandExternalSuggestions(th.Context, commandArgs, command)
		assert.NotNil(t, err)
		assert.Equal(t, "app.command.external_autocomplete.parse_error.app_error", err.Id)
		assert.Empty(t, suggestions)
	})
}

func TestProcessExternalAutocompleteResponse(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	commandArgs := &model.CommandArgs{
		Command:   "/test arg1",
		UserId:    "user-id",
		TeamId:    "team-id",
		ChannelId: "channel-id",
	}

	command := &model.Command{
		Trigger:                "test",
		AutocompleteRequestURL: "http://example.com",
	}

	t.Run("process AutocompleteData array", func(t *testing.T) {
		respBody := []byte(`[
			{
				"trigger": "test",
				"hint": "Test command",
				"helpText": "This is a test command",
				"subcommands": [
					{
						"trigger": "subcommand",
						"hint": "Subcommand hint",
						"helpText": "Subcommand help text"
					}
				]
			}
		]`)

		suggestions, err := th.App.processExternalAutocompleteResponse(th.Context, commandArgs, command, respBody)
		assert.Nil(t, err)
		assert.NotEmpty(t, suggestions)
		// Note: We can't easily test the exact content as it depends on the getSuggestions method
	})

	t.Run("process AutocompleteData array with non-matching trigger", func(t *testing.T) {
		respBody := []byte(`[
			{
				"trigger": "different",
				"hint": "Test command",
				"helpText": "This is a test command"
			}
		]`)

		suggestions, err := th.App.processExternalAutocompleteResponse(th.Context, commandArgs, command, respBody)
		assert.Nil(t, err)
		assert.Empty(t, suggestions)
	})

	t.Run("process AutocompleteSuggestion array", func(t *testing.T) {
		respBody := []byte(`[
			{
				"Complete": "test subcommand",
				"Suggestion": "subcommand",
				"Hint": "Subcommand hint",
				"Description": "Subcommand description"
			}
		]`)

		suggestions, err := th.App.processExternalAutocompleteResponse(th.Context, commandArgs, command, respBody)
		assert.Nil(t, err)
		require.Len(t, suggestions, 1)
		assert.Equal(t, "test subcommand", suggestions[0].Complete)
		assert.Equal(t, "subcommand", suggestions[0].Suggestion)
		assert.Equal(t, "Subcommand hint", suggestions[0].Hint)
		assert.Equal(t, "Subcommand description", suggestions[0].Description)
	})

	t.Run("process AutocompleteSuggestion array with multiple named arguments", func(t *testing.T) {
		respBody := []byte(`[
			{
				"Complete": "test config --format json",
				"Suggestion": "json",
				"Hint": "[format]",
				"Description": "Output in JSON format"
			},
			{
				"Complete": "test config --format yaml",
				"Suggestion": "yaml",
				"Hint": "[format]", 
				"Description": "Output in YAML format"
			},
			{
				"Complete": "test config --format text",
				"Suggestion": "text",
				"Hint": "[format]",
				"Description": "Output in plain text format"
			}
		]`)

		suggestions, err := th.App.processExternalAutocompleteResponse(th.Context, commandArgs, command, respBody)
		assert.Nil(t, err)
		require.Len(t, suggestions, 3)
		assert.Equal(t, "test config --format json", suggestions[0].Complete)
		assert.Equal(t, "json", suggestions[0].Suggestion)
		assert.Equal(t, "[format]", suggestions[0].Hint)
		assert.Equal(t, "Output in JSON format", suggestions[0].Description)
	})

	t.Run("invalid JSON", func(t *testing.T) {
		respBody := []byte(`{"invalid": json`)

		suggestions, err := th.App.processExternalAutocompleteResponse(th.Context, commandArgs, command, respBody)
		assert.NotNil(t, err)
		assert.Equal(t, "app.command.external_autocomplete.parse_error.app_error", err.Id)
		assert.Empty(t, suggestions)
	})
}
