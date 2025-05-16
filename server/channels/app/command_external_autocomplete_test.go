// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetCommandExternalSuggestions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Allow local connections for tests
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

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
		assert.Nil(t, suggestions)
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
		assert.Nil(t, suggestions)
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
		// The error could be either response_error or request_failed depending on HTTP client behavior
		assert.Contains(t, err.Id, "app.command.external_autocomplete")
		assert.Nil(t, suggestions)
	})

	t.Run("server returns AutocompleteData", func(t *testing.T) {
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

			// Return autocomplete data
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"trigger": "test",
				"hint": "Test command",
				"helpText": "This is a test command",
				"subCommands": [
					{
						"trigger": "subcommand",
						"hint": "Subcommand hint",
						"helpText": "Subcommand help text"
					}
				]
			}`))
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
		assert.NotNil(t, suggestions)
		assert.Equal(t, "test", suggestions.Trigger)
		assert.Equal(t, "Test command", suggestions.Hint)
		assert.Equal(t, "This is a test command", suggestions.HelpText)
		require.Len(t, suggestions.SubCommands, 1)
		assert.Equal(t, "subcommand", suggestions.SubCommands[0].Trigger)
	})

	t.Run("invalid JSON", func(t *testing.T) {
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
		assert.Nil(t, suggestions)
	})
}
