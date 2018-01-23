// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type EmojiSearch struct {
	Term       string `json:"term"`
	PrefixOnly bool   `json:"prefix_only"`
}

func (es *EmojiSearch) ToJson() string {
	b, err := json.Marshal(es)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func EmojiSearchFromJson(data io.Reader) *EmojiSearch {
	decoder := json.NewDecoder(data)
	var es EmojiSearch
	err := decoder.Decode(&es)
	if err == nil {
		return &es
	} else {
		return nil
	}
}
