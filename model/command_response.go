// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/url"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost-server/v5/utils/jsonutils"
)

const (
	COMMAND_RESPONSE_TYPE_IN_CHANNEL = "in_channel"
	COMMAND_RESPONSE_TYPE_EPHEMERAL  = "ephemeral"
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

func (o *CommandResponse) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func (o *CommandResponse) IsValid() error {
	var errs *multierror.Error
	if o.Text == "" && len(o.Attachments) == 0 {
		errs = multierror.Append(errs, errors.New("'text' or 'attachments' is required"))
	}
	if o.ResponseType != "" && o.ResponseType != "ephemeral" && o.ResponseType != "in_channel" {
		errs = multierror.Append(errs, errors.New("'response_type' must be empty, 'ephemeral', or 'in_channel'"))
	}
	if _, err := url.ParseRequestURI(o.GotoLocation); o.GotoLocation != "" && err != nil {
		errs = multierror.Append(errs, fmt.Errorf("'goto_location' must be a valid URI: %w", err))
	}
	if _, err := url.ParseRequestURI(o.IconURL); o.IconURL != "" && err != nil {
		errs = multierror.Append(errs, fmt.Errorf("'icon_url' must be a valid URI: %w", err))
	}
	if o.Type != "" && !strings.HasPrefix(o.Type, "custom_") {
		errs = multierror.Append(errs, errors.New("'type' must start with 'custom_'"))
	}
	reservedProps := []string{"from_webhook", "override_username", "override_icon_url", "attachments"}
	for _, p := range reservedProps {
		if _, ok := o.Props[p]; ok {
			errs = multierror.Append(errs, fmt.Errorf("'%s' cannot be used as a key in 'props'", p))
		}
	}
	for _, extra := range o.ExtraResponses {
		if extra.GotoLocation != "" {
			errs = multierror.Append(errs, errors.New("extra response cannot contain 'goto_location'"))
		}
		if len(extra.ExtraResponses) > 0 {
			errs = multierror.Append(errs, errors.New("extra response cannot contain additional 'extra_responses'"))
		}
		if err := extra.IsValid(); err != nil {
			errs = multierror.Append(errs, err)
		}
	}
	return errs.ErrorOrNil()
}

func CommandResponseFromHTTPBody(contentType string, body io.Reader) (*CommandResponse, error) {
	if strings.TrimSpace(strings.Split(contentType, ";")[0]) == "application/json" {
		return CommandResponseFromJson(body)
	}
	if b, err := ioutil.ReadAll(body); err == nil {
		return CommandResponseFromPlainText(string(b)), nil
	}
	return nil, nil
}

func CommandResponseFromPlainText(text string) *CommandResponse {
	return &CommandResponse{
		Text: text,
	}
}

func CommandResponseFromJson(data io.Reader) (*CommandResponse, error) {
	b, err := ioutil.ReadAll(data)
	if err != nil {
		return nil, err
	}

	var o CommandResponse
	err = json.Unmarshal(b, &o)
	if err != nil {
		return nil, jsonutils.HumanizeJsonError(err, b)
	}

	o.Attachments = StringifySlackFieldValue(o.Attachments)

	if o.ExtraResponses != nil {
		for _, resp := range o.ExtraResponses {
			resp.Attachments = StringifySlackFieldValue(resp.Attachments)
		}
	}

	return &o, nil
}
