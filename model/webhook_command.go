// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type WebhookSuggestions struct {
	Username    string            `json:"username"`
	Suggestions []*SuggestCommand `json:"suggestions"`
}

func (o *WebhookSuggestions) AddSuggestion(suggest *SuggestCommand) {

	if o.Suggestions == nil {
		o.Suggestions = make([]*SuggestCommand, 0, 128)
	}

	o.Suggestions = append(o.Suggestions, suggest)
}

func (o *WebhookSuggestions) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func WebhookSuggestionsFromJson(data io.Reader) *WebhookSuggestions {
	decoder := json.NewDecoder(data)
	var o WebhookSuggestions
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
