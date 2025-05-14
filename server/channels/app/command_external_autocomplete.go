// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// getCommandExternalSuggestions fetches autocomplete suggestions from an external service URL
func (a *App) getCommandExternalSuggestions(c request.CTX, commandArgs *model.CommandArgs, command *model.Command) ([]model.AutocompleteSuggestion, *model.AppError) {
	// Skip if URL not specified
	if command.AutocompleteRequestURL == "" {
		return nil, nil
	}

	// Parse input to extract command parts
	input := commandArgs.Command
	parts := strings.Fields(input)
	
	// Create URL parameters
	params := url.Values{}
	
	if len(parts) > 0 {
		// The first part should be the command trigger (without slash)
		trigger := strings.TrimPrefix(parts[0], "/")
		params.Add("trigger", trigger)
		
		// Any remaining text is the query
		if len(parts) > 1 {
			text := strings.Join(parts[1:], " ")
			params.Add("text", text)
		} else {
			params.Add("text", "")
		}
	}
	
	// Add context parameters
	params.Add("channel_id", commandArgs.ChannelId)
	params.Add("team_id", commandArgs.TeamId)
	params.Add("user_id", commandArgs.UserId)
	params.Add("user_input", commandArgs.Command)
	
	// Make the request
	req, err := http.NewRequest("GET", command.AutocompleteRequestURL, nil)
	if err != nil {
		return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.request_create.app_error", nil, "error="+err.Error(), http.StatusInternalServerError)
	}
	
	// Apply the params to the URL
	req.URL.RawQuery = params.Encode()
	
	// Add authorization
	if command.Token != "" {
		req.Header.Set("Authorization", "Token "+command.Token)
	}
	
	// Add content type
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Create a client with timeout
	client := &http.Client{Timeout: 5 * time.Second}
	
	// Execute the request
	resp, err := client.Do(req)
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
	
	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.read_body.app_error", nil, "error="+err.Error(), http.StatusInternalServerError)
	}

	// Process the response in the following order:
	// 1. As a single AutocompleteData object
	// 2. As an array of AutocompleteData objects
	// 3. As an array of AutocompleteSuggestion objects (legacy format)
	return a.processExternalAutocompleteResponse(c, commandArgs, command, respBody)
}

// processExternalAutocompleteResponse handles the response from an external autocomplete service
func (a *App) processExternalAutocompleteResponse(c request.CTX, commandArgs *model.CommandArgs, command *model.Command, respBody []byte) ([]model.AutocompleteSuggestion, *model.AppError) {
	var suggestions []model.AutocompleteSuggestion
	
	// Try as a single AutocompleteData first
	var autocompleteData model.AutocompleteData
	err := json.Unmarshal(respBody, &autocompleteData)
	if err == nil && autocompleteData.Trigger != "" {
		// Successfully decoded as a single AutocompleteData
		cmdTrigger := strings.TrimPrefix(command.Trigger, "/")
		if autocompleteData.Trigger == cmdTrigger {
			// Process using the existing suggestion system
			return a.processAutocompleteData(c, commandArgs, command, &autocompleteData)
		}
	}
	
	// Try as an array of AutocompleteData
	var autocompleteDataArray []*model.AutocompleteData
	err = json.Unmarshal(respBody, &autocompleteDataArray)
	if err == nil && len(autocompleteDataArray) > 0 {
		// Successfully decoded as an array of AutocompleteData
		cmdTrigger := strings.TrimPrefix(command.Trigger, "/")
		for _, data := range autocompleteDataArray {
			if data != nil && data.Trigger == cmdTrigger {
				// Use the existing App's suggestion system
				dataSuggestions := a.getSuggestions(c, commandArgs, []*model.AutocompleteData{data}, "", commandArgs.Command, "")
				suggestions = append(suggestions, dataSuggestions...)
			}
		}
		return suggestions, nil
	}
	
	// Try as an array of AutocompleteSuggestion (legacy format)
	var legacySuggestions []model.AutocompleteSuggestion
	err = json.Unmarshal(respBody, &legacySuggestions)
	if err == nil {
		// Successfully decoded as an array of AutocompleteSuggestion
		return legacySuggestions, nil
	}
	
	// Could not decode response in any expected format
	c.Logger().Warn("Error decoding autocomplete data from external service", 
		mlog.String("url", command.AutocompleteRequestURL),
		mlog.String("trigger", command.Trigger),
		mlog.Err(err))
	return nil, model.NewAppError("getCommandExternalSuggestions", "app.command.external_autocomplete.parse_error.app_error", nil, "error="+err.Error(), http.StatusInternalServerError)
}

// processAutocompleteData processes a single AutocompleteData object into suggestions
func (a *App) processAutocompleteData(c request.CTX, commandArgs *model.CommandArgs, command *model.Command, autocompleteData *model.AutocompleteData) ([]model.AutocompleteSuggestion, *model.AppError) {
	// Create a copy with sanitized trigger to prevent double slashes
	dataCopy := *autocompleteData
	dataCopy.Trigger = strings.TrimPrefix(command.Trigger, "/")
	
	// Check if command ends with space (for enhanced UX)
	endsWithSpace := strings.HasSuffix(commandArgs.Command, " ")
	parts := strings.Fields(commandArgs.Command)
	
	// Generate suggestions using the existing system
	suggestions := a.getSuggestions(c, commandArgs, []*model.AutocompleteData{&dataCopy}, "", commandArgs.Command, "")
	
	// Special case: If the command ends with a space and we're in a subcommand,
	// show argument suggestions immediately without requiring user to type a dash
	if endsWithSpace && len(parts) >= 2 {
		namedArgSuggestions := a.getImmediateArgSuggestions(commandArgs, &dataCopy, parts)
		if len(namedArgSuggestions) > 0 {
			return namedArgSuggestions, nil
		}
	}
	
	return suggestions, nil
}

// getImmediateArgSuggestions returns argument suggestions when a command ends with a space
func (a *App) getImmediateArgSuggestions(commandArgs *model.CommandArgs, data *model.AutocompleteData, parts []string) []model.AutocompleteSuggestion {
	// Initialize empty suggestions array
	namedArgSuggestions := []model.AutocompleteSuggestion{}
	
	// Look for the matching subcommand
	if len(parts) >= 2 {
		for _, subCmd := range data.SubCommands {
			if strings.EqualFold(subCmd.Trigger, parts[1]) {
				// If this subcommand has arguments, show all of them immediately
				if len(subCmd.Arguments) > 0 {
					// Add all arguments from this subcommand
					for _, arg := range subCmd.Arguments {
						if arg.Name != "" {
							// Format the argument with -- prefix
							argName := "--" + arg.Name
							
							// Construct the complete suggestion
							complete := commandArgs.Command + argName + " "
							
							// Add the suggestion
							suggestion := model.AutocompleteSuggestion{
								Complete:    complete,
								Suggestion:  argName,
								Hint:        getArgHint(arg),
								Description: arg.HelpText,
							}
							
							namedArgSuggestions = append(namedArgSuggestions, suggestion)
						}
					}
				}
				
				// We found the matching subcommand, no need to continue searching
				break
			}
		}
	}
	
	// Also add top-level command arguments if any (future enhancement)
	
	return namedArgSuggestions
}

// Helper function to get hint string based on argument type
func getArgHint(arg *model.AutocompleteArg) string {
	var hintStr string
	
	if arg.Type == model.AutocompleteArgTypeText {
		if textArg, ok := arg.Data.(*model.AutocompleteTextArg); ok {
			hintStr = textArg.Hint
		} else if mapData, ok := arg.Data.(map[string]interface{}); ok {
			hintStr, _ = mapData["Hint"].(string)
		}
	} else if arg.Type == model.AutocompleteArgTypeStaticList {
		hintStr = "[list of options]"
	} else if arg.Type == model.AutocompleteArgTypeDynamicList {
		hintStr = "[dynamic options]"
	}
	
	return hintStr
}