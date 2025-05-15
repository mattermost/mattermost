// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// getCommandExternalSuggestions fetches autocomplete suggestions from an external service URL
func (a *App) getCommandExternalSuggestions(c request.CTX, commandArgs *model.CommandArgs, command *model.Command) (*model.AutocompleteData, *model.AppError) {
	if command.AutocompleteRequestURL == "" {
		return nil, nil
	}

	input := commandArgs.Command
	parts := strings.Fields(input)

	params := url.Values{}

	if len(parts) > 0 {
		// The first part should be the command trigger (without slash)
		trigger := strings.TrimPrefix(parts[0], "/")
		params.Add("trigger", trigger)

		text := ""
		// Any remaining text is the query
		if len(parts) > 1 {
			text = strings.Join(parts[1:], " ")
			params.Add("text", text)
		}
	}

	params.Add("channel_id", commandArgs.ChannelId)
	params.Add("team_id", commandArgs.TeamId)
	params.Add("user_id", commandArgs.UserId)
	params.Add("user_input", commandArgs.Command)

	req, err := http.NewRequest("GET", command.AutocompleteRequestURL, nil)
	if err != nil {
		return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.request_create.app_error", nil, "error="+err.Error(), http.StatusInternalServerError)
	}

	req.URL.RawQuery = params.Encode()

	if command.Token != "" {
		req.Header.Set("Authorization", "Token "+command.Token)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	httpClient := a.Srv().HTTPService().MakeClient(false)

	resp, err := httpClient.Do(req)
	if err != nil {
		c.Logger().Warn("Error fetching external suggestions",
			mlog.String("url", command.AutocompleteRequestURL),
			mlog.String("trigger", command.Trigger),
			mlog.Err(err))
		return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.request_failed.app_error", nil, "error="+err.Error(), http.StatusInternalServerError)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.Logger().Warn("External autocomplete service returned error",
			mlog.String("url", command.AutocompleteRequestURL),
			mlog.String("trigger", command.Trigger),
			mlog.Int("status", resp.StatusCode))
		return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.response_error.app_error", map[string]any{"StatusCode": resp.StatusCode}, "", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.Logger().Warn("Error reading response body",
			mlog.String("url", command.AutocompleteRequestURL),
			mlog.String("trigger", command.Trigger),
			mlog.Err(err))
		return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.response_read_error.app_error", nil, "error="+err.Error(), http.StatusInternalServerError)
	}

	var suggestions *model.AutocompleteData
	if err = json.Unmarshal(respBody, &suggestions); err == nil {
		return suggestions, nil
	}

	// If both attempts failed, log and return an error
	c.Logger().Warn("Received invalid JSON response",
		mlog.String("url", command.AutocompleteRequestURL),
		mlog.String("error", err.Error()),
		mlog.String("response_body", string(respBody)))
	return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.parse_error.app_error", nil, "error="+err.Error(), http.StatusInternalServerError)
}
