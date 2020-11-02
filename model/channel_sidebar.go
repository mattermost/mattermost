// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"regexp"
)

type SidebarCategoryType string
type SidebarCategorySorting string

const (
	// Each sidebar category has a 'type'. System categories are Channels, Favorites and DMs
	// All user-created categories will have type Custom
	SidebarCategoryChannels       SidebarCategoryType = "channels"
	SidebarCategoryDirectMessages SidebarCategoryType = "direct_messages"
	SidebarCategoryFavorites      SidebarCategoryType = "favorites"
	SidebarCategoryCustom         SidebarCategoryType = "custom"
	// Increment to use when adding/reordering things in the sidebar
	MinimalSidebarSortDistance = 10
	// Default Sort Orders for categories
	DefaultSidebarSortOrderFavorites = 0
	DefaultSidebarSortOrderChannels  = DefaultSidebarSortOrderFavorites + MinimalSidebarSortDistance
	DefaultSidebarSortOrderDMs       = DefaultSidebarSortOrderChannels + MinimalSidebarSortDistance
	// Sorting modes
	// default for all categories except DMs (behaves like manual)
	SidebarCategorySortDefault SidebarCategorySorting = ""
	// sort manually
	SidebarCategorySortManual SidebarCategorySorting = "manual"
	// sort by recency (default for DMs)
	SidebarCategorySortRecent SidebarCategorySorting = "recent"
	// sort by display name alphabetically
	SidebarCategorySortAlphabetical SidebarCategorySorting = "alpha"
)

// SidebarCategory represents the corresponding DB table
// SortOrder is never returned to the user and only used for queries
type SidebarCategory struct {
	Id          string                 `json:"id"`
	UserId      string                 `json:"user_id"`
	TeamId      string                 `json:"team_id"`
	SortOrder   int64                  `json:"-"`
	Sorting     SidebarCategorySorting `json:"sorting"`
	Type        SidebarCategoryType    `json:"type"`
	DisplayName string                 `json:"display_name"`
}

// SidebarCategoryWithChannels combines data from SidebarCategory table with the Channel IDs that belong to that category
type SidebarCategoryWithChannels struct {
	SidebarCategory
	Channels []string `json:"channel_ids"`
}

type SidebarCategoryOrder []string

// OrderedSidebarCategories combines categories, their channel IDs and an array of Category IDs, sorted
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
	err := json.NewDecoder(data).Decode(&o)
	return o, err
}

func SidebarCategoriesFromJson(data io.Reader) ([]*SidebarCategoryWithChannels, error) {
	var o []*SidebarCategoryWithChannels
	err := json.NewDecoder(data).Decode(&o)
	return o, err
}

func OrderedSidebarCategoriesFromJson(data io.Reader) (*OrderedSidebarCategories, error) {
	var o *OrderedSidebarCategories
	err := json.NewDecoder(data).Decode(&o)
	return o, err
}

func (o SidebarCategoryWithChannels) ToJson() []byte {
	b, _ := json.Marshal(o)
	return b
}

func SidebarCategoriesWithChannelsToJson(o []*SidebarCategoryWithChannels) []byte {
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

var categoryIdPattern = regexp.MustCompile("(favorites|channels|direct_messages)_[a-z0-9]{26}_[a-z0-9]{26}")

func IsValidCategoryId(s string) bool {
	// Category IDs can either be regular IDs
	if IsValidId(s) {
		return true
	}

	// Or default categories can follow the pattern {type}_{userID}_{teamID}
	return categoryIdPattern.MatchString(s)
}
