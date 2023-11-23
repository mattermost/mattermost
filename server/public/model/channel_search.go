// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const ChannelSearchDefaultLimit = 50

type ChannelSearch struct {
	Term                     string   `json:"term"`
	ExcludeDefaultChannels   bool     `json:"exclude_default_channels"`
	NotAssociatedToGroup     string   `json:"not_associated_to_group"`
	TeamIds                  []string `json:"team_ids"`
	GroupConstrained         bool     `json:"group_constrained"`
	ExcludeGroupConstrained  bool     `json:"exclude_group_constrained"`
	ExcludePolicyConstrained bool     `json:"exclude_policy_constrained"`
	Public                   bool     `json:"public"`
	Private                  bool     `json:"private"`
	IncludeDeleted           bool     `json:"include_deleted"`
	IncludeSearchById        bool     `json:"include_search_by_id"`
	Deleted                  bool     `json:"deleted"`
	Page                     *int     `json:"page,omitempty"`
	PerPage                  *int     `json:"per_page,omitempty"`
}
