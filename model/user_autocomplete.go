// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
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

type UserAutocomplete struct {
	Users        []*User `json:"users"`
	OutOfChannel []*User `json:"out_of_channel,omitempty"`
}

func (o *UserAutocomplete) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func UserAutocompleteFromJson(data io.Reader) *UserAutocomplete {
	decoder := json.NewDecoder(data)
	autocomplete := new(UserAutocomplete)
	err := decoder.Decode(&autocomplete)
	if err == nil {
		return autocomplete
	} else {
		return nil
	}
}

func (o *UserAutocompleteInChannel) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func UserAutocompleteInChannelFromJson(data io.Reader) *UserAutocompleteInChannel {
	var o *UserAutocompleteInChannel
	json.NewDecoder(data).Decode(&o)
	return o
}

func (o *UserAutocompleteInTeam) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func UserAutocompleteInTeamFromJson(data io.Reader) *UserAutocompleteInTeam {
	var o *UserAutocompleteInTeam
	json.NewDecoder(data).Decode(&o)
	return o
}
