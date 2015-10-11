// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	RESP_EXECUTED = "executed"
)

type Command struct {
	Command      string            `json:"command"`
	Response     string            `json:"response"`
	GotoLocation string            `json:"goto_location"`
	ChannelId    string            `json:"channel_id"`
	Suggest      bool              `json:"-"`
	Suggestions  []*SuggestCommand `json:"suggestions"`
}

func (o *Command) AddSuggestion(suggest *SuggestCommand) {

	if o.Suggest {
		if o.Suggestions == nil {
			o.Suggestions = make([]*SuggestCommand, 0, 128)
		}

		o.Suggestions = append(o.Suggestions, suggest)
	}
}

func (o *Command) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandFromJson(data io.Reader) *Command {
	decoder := json.NewDecoder(data)
	var o Command
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
