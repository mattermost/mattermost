// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type UserAutocomplete struct {
	In  []*User `json:"in"`
	Out []*User `json:"out"`
}

func (o *UserAutocomplete) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserAutocompleteFromJson(data io.Reader) *UserAutocomplete {
	decoder := json.NewDecoder(data)
	var o UserAutocomplete
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
