// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

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

	if err := o.IsValid(); err != nil {
		return nil, err
	}

	return &o, nil
}

func (o *CommandResponse) IsValid() *AppError {
	// check response type
	if o.ResponseType != CommandResponseTypeInChannel && o.ResponseType != CommandResponseTypeEphemeral && o.ResponseType != "" {
		return NewAppError("CommandResponse.IsValid", "model.command_response.is_valid.response_type.app_error", nil, "invalid response type", http.StatusBadRequest)
	}

	maxLength := 65535
	if utf8.RuneCountInString(o.Text) > maxLength {
		return NewAppError("CommandResponse.IsValid", "model.command_response.is_valid.text.app_error", nil, "text is too long", http.StatusBadRequest)
	}

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
