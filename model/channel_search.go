// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const CHANNEL_SEARCH_DEFAULT_LIMIT = 50

type ChannelSearch struct {
	Term                   string `json:"term"`
	ExcludeDefaultChannels bool   `json:"exclude_default_channels"`
	NotAssociatedToGroup   string `json:"not_associated_to_group"`
	Page                   *int   `json:"page,omitempty"`
	PerPage                *int   `json:"per_page,omitempty"`
}

// ToJson convert a Channel to a json string
func (c *ChannelSearch) ToJson() string {
	b, _ := json.Marshal(c)
	return string(b)
}

// ChannelSearchFromJson will decode the input and return a Channel
func ChannelSearchFromJson(data io.Reader) *ChannelSearch {
	var cs *ChannelSearch
	json.NewDecoder(data).Decode(&cs)
	return cs
}
