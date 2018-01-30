// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type SuggestCommand struct {
	Suggestion  string `json:"suggestion"`
	Description string `json:"description"`
}

func (o *SuggestCommand) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func SuggestCommandFromJson(data io.Reader) *SuggestCommand {
	var o *SuggestCommand
	json.NewDecoder(data).Decode(&o)
	return o
}
