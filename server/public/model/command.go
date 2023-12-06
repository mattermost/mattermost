// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
)

const (
	CommandMethodPost = "P"
	CommandMethodGet  = "G"
	MinTriggerLength  = 1
	MaxTriggerLength  = 128
)

type Command struct {
	Id               string `json:"id"`
	Token            string `json:"token"`
	CreateAt         int64  `json:"create_at"`
	UpdateAt         int64  `json:"update_at"`
	DeleteAt         int64  `json:"delete_at"`
	CreatorId        string `json:"creator_id"`
	TeamId           string `json:"team_id"`
	Trigger          string `json:"trigger"`
	Method           string `json:"method"`
	Username         string `json:"username"`
	IconURL          string `json:"icon_url"`
	AutoComplete     bool   `json:"auto_complete"`
	AutoCompleteDesc string `json:"auto_complete_desc"`
	AutoCompleteHint string `json:"auto_complete_hint"`
	DisplayName      string `json:"display_name"`
	Description      string `json:"description"`
	URL              string `json:"url"`
	// PluginId records the id of the plugin that created this Command. If it is blank, the Command
	// was not created by a plugin.
	PluginId         string            `json:"plugin_id"`
	AutocompleteData *AutocompleteData `db:"-" json:"autocomplete_data,omitempty"`
	// AutocompleteIconData is a base64 encoded svg
	AutocompleteIconData string `db:"-" json:"autocomplete_icon_data,omitempty"`
}

func (o *Command) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":                 o.Id,
		"create_at":          o.CreateAt,
		"update_at":          o.UpdateAt,
		"delete_at":          o.DeleteAt,
		"creator_id":         o.CreatorId,
		"team_id":            o.TeamId,
		"trigger":            o.Trigger,
		"username":           o.Username,
		"icon_url":           o.IconURL,
		"auto_complete":      o.AutoComplete,
		"auto_complete_desc": o.AutoCompleteDesc,
		"auto_complete_hint": o.AutoCompleteHint,
		"display_name":       o.DisplayName,
		"description":        o.Description,
		"url":                o.URL,
	}
}

func (o *Command) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("Command.IsValid", "model.command.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Token) != 26 {
		return NewAppError("Command.IsValid", "model.command.is_valid.token.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Command.IsValid", "model.command.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Command.IsValid", "model.command.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	// If the CreatorId is blank, this should be a command created by a plugin.
	if o.CreatorId == "" && !IsValidPluginId(o.PluginId) {
		return NewAppError("Command.IsValid", "model.command.is_valid.plugin_id.app_error", nil, "", http.StatusBadRequest)
	}

	// If the PluginId is blank, this should be a command associated with a userId.
	if o.PluginId == "" && !IsValidId(o.CreatorId) {
		return NewAppError("Command.IsValid", "model.command.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreatorId != "" && o.PluginId != "" {
		return NewAppError("Command.IsValid", "model.command.is_valid.plugin_id.app_error", nil, "command cannot have both a CreatorId and a PluginId", http.StatusBadRequest)
	}

	if !IsValidId(o.TeamId) {
		return NewAppError("Command.IsValid", "model.command.is_valid.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Trigger) < MinTriggerLength || len(o.Trigger) > MaxTriggerLength || strings.Index(o.Trigger, "/") == 0 || strings.Contains(o.Trigger, " ") {
		return NewAppError("Command.IsValid", "model.command.is_valid.trigger.app_error", nil, "", http.StatusBadRequest)
	}

	if o.URL == "" || len(o.URL) > 1024 {
		return NewAppError("Command.IsValid", "model.command.is_valid.url.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidHTTPURL(o.URL) {
		return NewAppError("Command.IsValid", "model.command.is_valid.url_http.app_error", nil, "", http.StatusBadRequest)
	}

	if !(o.Method == CommandMethodGet || o.Method == CommandMethodPost) {
		return NewAppError("Command.IsValid", "model.command.is_valid.method.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.DisplayName) > 64 {
		return NewAppError("Command.IsValid", "model.command.is_valid.display_name.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Description) > 128 {
		return NewAppError("Command.IsValid", "model.command.is_valid.description.app_error", nil, "", http.StatusBadRequest)
	}

	if o.AutocompleteData != nil {
		if err := o.AutocompleteData.IsValid(); err != nil {
			return NewAppError("Command.IsValid", "model.command.is_valid.autocomplete_data.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	return nil
}

func (o *Command) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.Token == "" {
		o.Token = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
}

func (o *Command) PreUpdate() {
	o.UpdateAt = GetMillis()
}

func (o *Command) Sanitize() {
	o.Token = ""
	o.CreatorId = ""
	o.Method = ""
	o.URL = ""
	o.Username = ""
	o.IconURL = ""
}
