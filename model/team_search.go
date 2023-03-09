// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type TeamSearch struct {
	Term                     string  `json:"term"`
	Page                     *int    `json:"page,omitempty"`
	PerPage                  *int    `json:"per_page,omitempty"`
	AllowOpenInvite          *bool   `json:"allow_open_invite,omitempty"`
	GroupConstrained         *bool   `json:"group_constrained,omitempty"`
	IncludeGroupConstrained  *bool   `json:"include_group_constrained,omitempty"`
	PolicyID                 *string `json:"policy_id,omitempty"`
	ExcludePolicyConstrained *bool   `json:"exclude_policy_constrained,omitempty"`
	IncludePolicyID          *bool   `json:"-"`
	IncludeDeleted           *bool   `json:"-"`
	TeamType                 *string `json:"-"`
}

func (t *TeamSearch) IsPaginated() bool {
	return t.Page != nil && t.PerPage != nil
}
