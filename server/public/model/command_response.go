// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost/server/public/utils"
)

const (
	CommandResponseTypeInChannel = "in_channel"
	CommandResponseTypeEphemeral = "ephemeral"
)

type CommandResponse struct {
	ResponseType     string               `json:"response_type"`
	Text             string               `json:"text"`
	Username         string               `json:"username"`
	ChannelId        string               `json:"channel_id"`
	IconURL          string               `json:"icon_url"`
	Type             string               `json:"type"`
	Props            StringInterface      `json:"props"`
	GotoLocation     string               `json:"goto_location"`
	TriggerId        string               `json:"trigger_id"`
	SkipSlackParsing bool                 `json:"skip_slack_parsing"` // Set to `true` to skip the Slack-compatibility handling of Text.
	Attachments      []*MessageAttachment `json:"attachments"`
	ExtraResponses   []*CommandResponse   `json:"extra_responses"`
}

func CommandResponseFromHTTPBody(contentType string, body io.Reader) (*CommandResponse, error) {
	if strings.TrimSpace(strings.Split(contentType, ";")[0]) == "application/json" {
		return CommandResponseFromJSON(body)
	}
	if b, err := io.ReadAll(body); err == nil {
		return CommandResponseFromPlainText(string(b)), nil
	}
	return nil, nil
}

func CommandResponseFromPlainText(text string) *CommandResponse {
	return &CommandResponse{
		Text: text,
	}
}

func CommandResponseFromJSON(data io.Reader) (*CommandResponse, error) {
	b, err := io.ReadAll(data)
	if err != nil {
		return nil, err
	}

	var o CommandResponse
	err = json.Unmarshal(b, &o)
	if err != nil {
		return nil, utils.HumanizeJSONError(err, b)
	}

	o.Attachments = StringifyMessageAttachmentFieldValue(o.Attachments)

	for _, resp := range o.ExtraResponses {
		if resp == nil {
			continue
		}
		resp.Attachments = StringifyMessageAttachmentFieldValue(resp.Attachments)
	}

	return &o, nil
}

func (o *CommandResponse) IsValid() *AppError {
	// check response type
	if o.ResponseType != CommandResponseTypeInChannel && o.ResponseType != CommandResponseTypeEphemeral && o.ResponseType != "" {
		return NewAppError("CommandResponse.IsValid", "model.command_response.is_valid.response_type.app_error", nil, "invalid response type", http.StatusBadRequest)
	}

	// icon URL must be a valid URL if set
	if o.IconURL != "" {
		u, err := url.ParseRequestURI(o.IconURL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return NewAppError("CommandResponse.IsValid", "model.command_response.is_valid.icon_url.app_error", nil, "invalid icon url", http.StatusBadRequest)
		}
	}

	// goto location must be a valid URL if set
	if o.GotoLocation != "" {
		if _, err := url.ParseRequestURI(o.GotoLocation); err != nil {
			return NewAppError("CommandResponse.IsValid", "model.command_response.is_valid.goto_location.app_error", nil, "invalid goto location", http.StatusBadRequest)
		}
	}

	for _, attachment := range o.Attachments {
		if attachment == nil {
			continue
		}
		if err := attachment.IsValid(); err != nil {
			return NewAppError("CommandResponse.IsValid", "model.command_response.is_valid.attachment.app_error", nil, "invalid attachment", http.StatusBadRequest)
		}
	}

	// recursively validate nested responses
	for _, resp := range o.ExtraResponses {
		if resp == nil {
			continue
		}

		if err := resp.IsValid(); err != nil {
			return err
		}
	}
	return nil
}
