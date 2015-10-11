// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type System struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

func (o *System) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func SystemFromJson(data io.Reader) *System {
	decoder := json.NewDecoder(data)
	var o System
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
