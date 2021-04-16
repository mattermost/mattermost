// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

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

// ToJson convert a TeamSearch to json string
func (t *TeamSearch) ToJson() string {
	b, err := json.Marshal(t)
	if err != nil {
		return ""
	}

	return string(b)
}

// TeamSearchFromJson decodes the input and returns a TeamSearch
func TeamSearchFromJson(data io.Reader) *TeamSearch {
	decoder := json.NewDecoder(data)
	var cs TeamSearch
	err := decoder.Decode(&cs)
	if err == nil {
		return &cs
	}

	return nil
}
