// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type InitialLoad struct {
	Config             map[string]string                    `json:"config"`
	License            map[string]string                    `json:"license"`
	User               *User                                `json:"user"`
	UserPreferences    *Preferences                         `json:"user_preferences"`
	TeamMemberships    []*TeamMember                        `json:"team_memberships"`
	Teams              []*Team                              `json:"teams"`
	ChannelMemberships []*ChannelMember                     `json:"channel_memberships"`
	Channels           []*Channel                           `json:"channels"`
	SidebarCategories  map[string]*OrderedSidebarCategories `json:"sidebar_categories"`
	Roles              []*Role                              `json:"roles"`
}
