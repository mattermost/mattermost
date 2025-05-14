// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// TestGetExternalSuggestions tests retrieving autocomplete suggestions from an external service
func TestGetExternalSuggestions(t *testing.T) {
	// Setup test data - example suggestions that would be returned by the external service
	suggestions := []model.AutocompleteSuggestion{
		{
			Complete:    "/test option1",
			Suggestion:  "option1",
			Hint:        "hint1",
			Description: "description1",
		},
		{
			Complete:    "/test option2",
			Suggestion:  "option2",
			Hint:        "hint2",
			Description: "description2",
		},
	}

	// Create a mock external autocomplete service using httptest
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check required query parameters - these should match what our implementation sends
		userInput := r.URL.Query().Get("user_input")
		channelID := r.URL.Query().Get("channel_id")
		teamID := r.URL.Query().Get("team_id")
		userID := r.URL.Query().Get("user_id")

		// Validate expected parameters
		if userInput == "" || channelID == "" || teamID == "" || userID == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Validate authorization header - should match the token in our command
		if r.Header.Get("Authorization") != "Token test-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		// Return suggestions as JSON response
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(suggestions); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	}))
	defer ts.Close()

	// Create test helper and app
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create test command with external autocomplete URL
	command := &model.Command{
		Trigger:                "test",
		AutoComplete:           true,
		AutoCompleteDesc:       "Test command",
		AutoCompleteHint:       "This is a test command",
		Token:                  "test-token",
		AutocompleteRequestURL: ts.URL,
	}

	// Create command args
	commandArgs := &model.CommandArgs{
		Command:   "/test arg1",
		ChannelId: "test-channel",
		TeamId:    "test-team",
		UserId:    "test-user",
		SiteURL:   "http://test-site",
	}

	// Test fetching external suggestions
	ctx := &request.Context{}
	results, err := th.App.getCommandExternalSuggestions(ctx, commandArgs, command)
	require.Nil(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, "/test option1", results[0].Complete)
	assert.Equal(t, "option1", results[0].Suggestion)
	assert.Equal(t, "hint1", results[0].Hint)
	assert.Equal(t, "description1", results[0].Description)

	// Test integration with GetSuggestions
	commands := []*model.Command{command}
	results2 := th.App.GetSuggestions(ctx, commandArgs, commands, model.SystemUserRoleId)
	require.Len(t, results2, 2)
	assert.Equal(t, "/test option1", results2[0].Complete)

	// Test invalid URL
	command.AutocompleteRequestURL = "http://invalid-url"
	results3, err := th.App.getCommandExternalSuggestions(ctx, commandArgs, command)
	assert.NotNil(t, err)
	assert.Nil(t, results3)
}

// TestCommandValidation verifies that commands with autocomplete URLs are properly validated
func TestCommandValidation(t *testing.T) {
	// Base command for all tests
	baseCmd := func() *model.Command {
		return &model.Command{
			Id:        model.NewId(),
			Token:     model.NewId(),
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			CreatorId: model.NewId(),
			TeamId:    model.NewId(),
			Trigger:   "test",
			Method:    model.CommandMethodPost,
			URL:       "http://example.com",
		}
	}

	// Valid HTTPS URL should pass validation
	t.Run("ValidURL", func(t *testing.T) {
		cmd := baseCmd()
		cmd.AutocompleteRequestURL = "https://example.com/autocomplete"
		err := cmd.IsValid()
		require.Nil(t, err)
	})

	// Empty URL is allowed (no external autocomplete)
	t.Run("EmptyURL", func(t *testing.T) {
		cmd := baseCmd()
		cmd.AutocompleteRequestURL = ""
		err := cmd.IsValid()
		require.Nil(t, err)
	})

	// Non-HTTP protocols should be rejected
	t.Run("InvalidProtocol", func(t *testing.T) {
		cmd := baseCmd()
		cmd.AutocompleteRequestURL = "ftp://example.com"
		err := cmd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.command.is_valid.autocomplete_url_http.app_error", err.Id)
	})

	// URLs exceeding the maximum length should be rejected
	t.Run("TooLong", func(t *testing.T) {
		cmd := baseCmd()
		// Create a URL that exceeds the 1024 character limit
		cmd.AutocompleteRequestURL = "http://" + string(make([]byte, 1020)) + ".com"
		err := cmd.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.command.is_valid.autocomplete_url.app_error", err.Id)
	})
}
