// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Options for counting users
type UserCountOptions struct {
	// Should include users that are bots
	IncludeBotAccounts bool
	// Should include deleted users (of any type)
	IncludeDeleted bool
	// Include remote users
	IncludeRemoteUsers bool
	// Exclude regular users
	ExcludeRegularUsers bool
	// Only include users on a specific team. "" for any team.
	TeamId string
	// Only include users on a specific channel. "" for any channel.
	ChannelId string
	// Restrict to search in a list of teams and channels
	ViewRestrictions *ViewUsersRestrictions
	// Only include users matching any of the given system wide roles.
	Roles []string
	// Only include users matching any of the given channel roles, must be used with ChannelId.
	ChannelRoles []string
	// Only include users matching any of the given team roles, must be used with TeamId.
	TeamRoles []string
}
