// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
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
type SidebarCategory struct {
	Id          string                 `json:"id"`
	UserId      string                 `json:"user_id"`
	TeamId      string                 `json:"team_id"`
	SortOrder   int64                  `json:"sort_order"`
	Sorting     SidebarCategorySorting `json:"sorting"`
	Type        SidebarCategoryType    `json:"type"`
	DisplayName string                 `json:"display_name"`
	Muted       bool                   `json:"muted"`
	Collapsed   bool                   `json:"collapsed"`
}

// SidebarCategoryWithChannels combines data from SidebarCategory table with the Channel IDs that belong to that category
type SidebarCategoryWithChannels struct {
	SidebarCategory
	Channels []string `json:"channel_ids"`
}

func (sc SidebarCategoryWithChannels) ChannelIds() []string {
	return sc.Channels
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

var categoryIdPattern = regexp.MustCompile("(favorites|channels|direct_messages)_[a-z0-9]{26}_[a-z0-9]{26}")

func IsValidCategoryId(s string) bool {
	// Category IDs can either be regular IDs
	if IsValidId(s) {
		return true
	}

	// Or default categories can follow the pattern {type}_{userID}_{teamID}
	return categoryIdPattern.MatchString(s)
}

func (SidebarCategoryType) ImplementsGraphQLType(name string) bool {
	return name == "SidebarCategoryType"
}

func (t SidebarCategoryType) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(t))
}

func (t *SidebarCategoryType) UnmarshalGraphQL(input any) error {
	chType, ok := input.(string)
	if !ok {
		return errors.New("wrong type")
	}

	*t = SidebarCategoryType(chType)
	return nil
}

func (SidebarCategorySorting) ImplementsGraphQLType(name string) bool {
	return name == "SidebarCategorySorting"
}

func (t SidebarCategorySorting) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(t))
}

func (t *SidebarCategorySorting) UnmarshalGraphQL(input any) error {
	chType, ok := input.(string)
	if !ok {
		return errors.New("wrong type")
	}

	*t = SidebarCategorySorting(chType)
	return nil
}

func (t *SidebarCategory) SortOrder_() float64 {
	return float64(t.SortOrder)
}
