// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"github.com/mattermost/mattermost-server/v6/utils/jsonutils"
	"io"
)

const (
	CommandResponseTypeInChannel = "in_channel"
	CommandResponseTypeEphemeral = "ephemeral"
)

type CommandResponse struct {
	ResponseType     string             `json:"response_type"`
	Text             string             `json:"text"`
	Username         string             `json:"username"`
	ChannelId        string             `json:"channel_id"`
	IconURL          string             `json:"icon_url"`
	Type             string             `json:"type"`
	Props            StringInterface    `json:"props"`
	GotoLocation     string             `json:"goto_location"`
	TriggerId        string             `json:"trigger_id"`
	SkipSlackParsing bool               `json:"skip_slack_parsing"` // Set to `true` to skip the Slack-compatibility handling of Text.
	Attachments      []*SlackAttachment `json:"attachments"`
	ExtraResponses   []*CommandResponse `json:"extra_responses"`
}

func CommandResponseFromHTTPBody(body io.Reader) (*CommandResponse, error) {
	if commandResponse, err := CommandResponseFromJSON(body); err == nil {
		return commandResponse, nil
	} else {
		return CommandResponseFromPlainText(body)
	}
}

func CommandResponseFromPlainText(body io.Reader) (*CommandResponse, error) {
	if b, err := io.ReadAll(body); err == nil {
		return &CommandResponse{
			Text: string(b),
		}, nil
	}
	return nil, nil
}

func CommandResponseFromJSON(data io.Reader) (*CommandResponse, error) {
	b, err := io.ReadAll(data)
	if err != nil {
		return nil, err
	}

	var o CommandResponse
	err = json.Unmarshal(b, &o)
	if err != nil {
		return nil, jsonutils.HumanizeJSONError(err, b)
	}

	o.Attachments = StringifySlackFieldValue(o.Attachments)

	if o.ExtraResponses != nil {
		for _, resp := range o.ExtraResponses {
			resp.Attachments = StringifySlackFieldValue(resp.Attachments)
		}
	}

	return &o, nil
}
