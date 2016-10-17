// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type UserAutocompleteInChannel struct {
	InChannel    []*User `json:"in_channel"`
	OutOfChannel []*User `json:"out_of_channel"`
}

type UserAutocompleteInTeam struct {
	InTeam []*User `json:"in_team"`
}

func (o *UserAutocompleteInChannel) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserAutocompleteInChannelFromJson(data io.Reader) *UserAutocompleteInChannel {
	decoder := json.NewDecoder(data)
	var o UserAutocompleteInChannel
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *UserAutocompleteInTeam) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserAutocompleteInTeamFromJson(data io.Reader) *UserAutocompleteInTeam {
	decoder := json.NewDecoder(data)
	var o UserAutocompleteInTeam
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
