// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
)

const (
	FunctionMaxNameLength        = 64
	FunctionMaxDescriptionLength = 1024
	FunctionResultMaxContentLength = 65536
)

// Function represents a function that can be called by AI models
type Function struct {
	// Name is the unique identifier for the function within a plugin
	Name string `json:"name"`
	// Description explains what the function does for the AI model
	Description string `json:"description"`
	// InputSchema defines the expected parameters using JSON Schema
	InputSchema map[string]any `json:"input_schema"`
	// Permissions required to execute this function
	Permissions []string `json:"permissions,omitempty"`
	// Scope defines where this function can be used (system, team, channel)
	Scope string `json:"scope,omitempty"`
	// PluginID is automatically set when the function is registered
	PluginID string `json:"plugin_id"`
	// Handler is the function that executes the function (not serialized)
	Handler FunctionHandler `json:"-"`
}

// FunctionHandler is the function signature for function execution
type FunctionHandler func(arguments map[string]any, userContext *FunctionUserContext) (*FunctionResult, *AppError)

// FunctionResult represents the result of executing a function
type FunctionResult struct {
	// Content is the primary result content
	Content []FunctionContent `json:"content"`
	// IsError indicates if this result represents an error
	IsError bool `json:"is_error,omitempty"`
}

// FunctionContent represents different types of content that can be returned
type FunctionContent struct {
	// Type indicates the content type (text, image, resource)
	Type string `json:"type"`
	// Text content
	Text string `json:"text,omitempty"`
	// ImageURL for image content
	ImageURL string `json:"image_url,omitempty"`
	// ResourceURI for resource references
	ResourceURI string `json:"resource_uri,omitempty"`
}

// FunctionUserContext provides context about the user making the request
type FunctionUserContext struct {
	UserID      string   `json:"user_id"`
	TeamID      string   `json:"team_id,omitempty"`
	ChannelID   string   `json:"channel_id,omitempty"`
	SessionID   string   `json:"session_id,omitempty"`
	Permissions []string `json:"permissions"`
	IsGuest     bool     `json:"is_guest"`
	IsAdmin     bool     `json:"is_admin"`
	IsSystemAdmin bool   `json:"is_system_admin"`
}

// FunctionStats provides statistics about the Function service
type FunctionStats struct {
	TotalFunctions         int            `json:"total_functions"`
	FunctionsByPlugin      map[string]int `json:"functions_by_plugin"`
	FunctionExecutions     int64          `json:"function_executions"`
}

// Validation methods

func (f *Function) IsValid() *AppError {
	if len(f.Name) == 0 || len(f.Name) > FunctionMaxNameLength {
		return NewAppError("Function.IsValid", "model.function.name.app_error", 
			map[string]any{"MaxLength": FunctionMaxNameLength}, "", http.StatusBadRequest)
	}

	if !isValidFunctionName(f.Name) {
		return NewAppError("Function.IsValid", "model.function.name.invalid.app_error", nil, "", http.StatusBadRequest)
	}

	if len(f.Description) == 0 || len(f.Description) > FunctionMaxDescriptionLength {
		return NewAppError("Function.IsValid", "model.function.description.app_error", 
			map[string]any{"MaxLength": FunctionMaxDescriptionLength}, "", http.StatusBadRequest)
	}

	if f.InputSchema == nil {
		return NewAppError("Function.IsValid", "model.function.schema.app_error", nil, "", http.StatusBadRequest)
	}

	if f.Handler == nil {
		return NewAppError("Function.IsValid", "model.function.handler.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (uc *FunctionUserContext) IsValid() *AppError {
	if len(uc.UserID) == 0 {
		return NewAppError("FunctionUserContext.IsValid", "model.function_user_context.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// Helper functions

func isValidFunctionName(name string) bool {
	matched, _ := regexp.MatchString(`^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$`, name)
	return matched
}

// ToJSON converts the struct to JSON
func (f *Function) ToJSON() string {
	b, _ := json.Marshal(f)
	return string(b)
}

func (result *FunctionResult) ToJSON() string {
	b, _ := json.Marshal(result)
	return string(b)
}

func (uc *FunctionUserContext) ToJSON() string {
	b, _ := json.Marshal(uc)
	return string(b)
}

func (stats *FunctionStats) ToJSON() string {
	b, _ := json.Marshal(stats)
	return string(b)
}

// FromJSON converts JSON to struct
func FunctionFromJSON(data io.Reader) *Function {
	var function Function
	if err := json.NewDecoder(data).Decode(&function); err != nil {
		return nil
	}
	return &function
}

func FunctionUserContextFromJSON(data io.Reader) *FunctionUserContext {
	var context FunctionUserContext
	if err := json.NewDecoder(data).Decode(&context); err != nil {
		return nil
	}
	return &context
}

// Helper functions for creating common content types
func NewFunctionTextContent(text string) FunctionContent {
	return FunctionContent{
		Type: "text",
		Text: text,
	}
}

func NewFunctionImageContent(imageURL string) FunctionContent {
	return FunctionContent{
		Type:     "image",
		ImageURL: imageURL,
	}
}

func NewFunctionResourceContent(resourceURI string) FunctionContent {
	return FunctionContent{
		Type:        "resource",
		ResourceURI: resourceURI,
	}
}

func NewFunctionResult(content ...FunctionContent) *FunctionResult {
	return &FunctionResult{
		Content: content,
		IsError: false,
	}
}

func NewFunctionErrorResult(message string) *FunctionResult {
	return &FunctionResult{
		Content: []FunctionContent{NewFunctionTextContent(message)},
		IsError: true,
	}
}

// GetQualifiedFunctionName returns the fully qualified function name (plugin.function)
func (f *Function) GetQualifiedName() string {
	if f.PluginID == "" {
		return f.Name
	}
	return fmt.Sprintf("%s.%s", f.PluginID, f.Name)
}