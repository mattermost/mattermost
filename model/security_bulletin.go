// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type SecurityBulletin struct {
	Id               string `json:"id"`
	AppliesToVersion string `json:"applies_to_version"`
}

type SecurityBulletins []SecurityBulletin

func (me *SecurityBulletin) ToJson() string {
	b, _ := json.Marshal(me)
	return string(b)
}

func SecurityBulletinFromJson(data io.Reader) *SecurityBulletin {
	var o *SecurityBulletin
	json.NewDecoder(data).Decode(&o)
	return o
}

func (me SecurityBulletins) ToJson() string {
	if b, err := json.Marshal(me); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func SecurityBulletinsFromJson(data io.Reader) SecurityBulletins {
	var o SecurityBulletins
	json.NewDecoder(data).Decode(&o)
	return o
}
