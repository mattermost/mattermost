// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	SidebarCategoryChannels       SidebarCategoryType = "C"
	SidebarCategoryDirectMessages SidebarCategoryType = "D"
	SidebarCategoryFavorites      SidebarCategoryType = "F"
)

type SidebarCategoryType string

type SidebarCategory struct {
	Id          string              `json:"id"`
	UserId      string              `json:"user_id"`
	TeamId      string              `json:"team_id"`
	SortOrder   int64               `json:"-"`
	Type        SidebarCategoryType `json:"type"`
	DisplayName string              `json:"display_name"`
}

type SidebarCategoryWithChannels struct {
	SidebarCategory
	Channels []string `json:"channel_ids"`
}

type SidebarCategoryOrder []string

type OrderedSidebarCategories struct {
	Categories SidebarCategoriesWithChannels `json:"categories"`
	Order      SidebarCategoryOrder          `json:"order"`
}

type SidebarChannel struct {
	ChannelId  string `json:"channel_id"`
	UserId     string `json:"user_id"`
	CategoryId string `json:"category_id"`
	SortOrder  int64  `json:"-"`
}

type SidebarChannels []*SidebarChannel
type SidebarCategoriesWithChannels []*SidebarCategoryWithChannels

func SidebarCategoryFromJson(data io.Reader) (*SidebarCategoryWithChannels, error) {
	var o *SidebarCategoryWithChannels
	if err := json.NewDecoder(data).Decode(&o); err != nil {
		return nil, err
	}
	return o, nil
}

func (o SidebarCategoryWithChannels) ToJson() []byte {
	b, _ := json.Marshal(o)
	return b
}

func (o SidebarCategoriesWithChannels) ToJson() []byte {
	if b, err := json.Marshal(o); err != nil {
		return []byte("[]")
	} else {
		return b
	}
}

func (o OrderedSidebarCategories) ToJson() []byte {
	if b, err := json.Marshal(o); err != nil {
		return []byte("[]")
	} else {
		return b
	}
}
