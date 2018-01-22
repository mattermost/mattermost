// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type UserAccessTokenSearch struct {
	Term string `json:"term"`
}

// ToJson convert a UserAccessTokenSearch to json string
func (c *UserAccessTokenSearch) ToJson() string {
	b, err := json.Marshal(c)
	if err != nil {
		return ""
	}

	return string(b)
}

// UserAccessTokenSearchJson decodes the input and returns a UserAccessTokenSearch
func UserAccessTokenSearchFromJson(data io.Reader) *UserAccessTokenSearch {
	decoder := json.NewDecoder(data)
	var cs UserAccessTokenSearch
	err := decoder.Decode(&cs)
	if err == nil {
		return &cs
	}

	return nil
}
