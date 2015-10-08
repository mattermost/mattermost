// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
)

type TeamSignup struct {
	Team    Team     `json:"team"`
	User    User     `json:"user"`
	Invites []string `json:"invites"`
	Data    string   `json:"data"`
	Hash    string   `json:"hash"`
}

func TeamSignupFromJson(data io.Reader) *TeamSignup {
	decoder := json.NewDecoder(data)
	var o TeamSignup
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		fmt.Println(err)

		return nil
	}
}

func (o *TeamSignup) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}
