// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const UserSearchMaxLimit = 1000
const UserSearchDefaultLimit = 100

// UserSearch captures the parameters provided by a client for initiating a user search.
type UserSearch struct {
	Term             string   `json:"term"`
	TeamId           string   `json:"team_id"`
	NotInTeamId      string   `json:"not_in_team_id"`
	InChannelId      string   `json:"in_channel_id"`
	NotInChannelId   string   `json:"not_in_channel_id"`
	InGroupId        string   `json:"in_group_id"`
	GroupConstrained bool     `json:"group_constrained"`
	AllowInactive    bool     `json:"allow_inactive"`
	WithoutTeam      bool     `json:"without_team"`
	Limit            int      `json:"limit"`
	Role             string   `json:"role"`
	Roles            []string `json:"roles"`
	ChannelRoles     []string `json:"channel_roles"`
	TeamRoles        []string `json:"team_roles"`
	NotInGroupId     string   `json:"not_in_group_id"`
}

// UserSearchOptions captures internal parameters derived from the user's permissions and a
// UserSearch request.
type UserSearchOptions struct {
	// IsAdmin tracks whether or not the search is being conducted by an administrator.
	IsAdmin bool
	// AllowEmails allows search to examine the emails of users.
	AllowEmails bool
	// AllowFullNames allows search to examine the full names of users, vs. just usernames and nicknames.
	AllowFullNames bool
	// AllowInactive configures whether or not to return inactive users in the search results.
	AllowInactive bool
	// Narrows the search to the group constrained users
	GroupConstrained bool
	// Limit limits the total number of results returned.
	Limit int
	// Filters for the given role
	Role string
	// Filters for users that have any of the given system roles
	Roles []string
	// Filters for users that have the given channel roles to be used when searching in a channel
	ChannelRoles []string
	// Filters for users that have the given team roles to be used when searching in a team
	TeamRoles []string
	// Restrict to search in a list of teams and channels
	ViewRestrictions *ViewUsersRestrictions
	// List of allowed channels
	ListOfAllowedChannels []string
}
