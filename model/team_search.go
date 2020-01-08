// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type TeamSearch struct {
	Term    string `json:"term"`
	Page    *int   `json:"page,omitempty"`
	PerPage *int   `json:"per_page,omitempty"`
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
