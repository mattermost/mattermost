// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

// Options for counting users
type UserCountOptions struct {
	// Should include users that are bots
	IncludeBotAccounts bool
	// Should include deleted users (of any type)
	IncludeDeleted bool
	// Exclude regular users
	ExcludeRegularUsers bool
	// Only include users on a specific team. "" for any team.
	TeamId string
	// Restrict to search in a list of teams and channels
	ViewRestrictions *ViewUsersRestrictions
}
