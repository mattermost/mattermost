// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type Audits []Audit

func (o Audits) Etag() string {
	if len(o) > 0 {
		// the first in the list is always the most current
		return Etag(o[0].CreateAt)
	}
	return ""
}

func (o Audits) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func AuditsFromJson(data io.Reader) Audits {
	var o Audits
	json.NewDecoder(data).Decode(&o)
	return o
}
