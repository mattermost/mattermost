// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type UserConnections struct {
	Count int `json:"count"`
}

func (uc *UserConnections) ToJson() string {
	b, _ := json.Marshal(uc)
	return string(b)
}

func ConnectionCountFromJson(data io.Reader) *UserConnections {
	var uc *UserConnections
	json.NewDecoder(data).Decode(&uc)
	return uc
}
