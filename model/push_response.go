// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	PushStatus         = "status"
	PushStatusOk       = "OK"
	PushStatusFail     = "FAIL"
	PushStatusRemove   = "REMOVE"
	PushStatusErrorMsg = "error"
)

type PushResponse map[string]string

func NewOkPushResponse() PushResponse {
	m := make(map[string]string)
	m[PushStatus] = PushStatusOk
	return m
}

func NewRemovePushResponse() PushResponse {
	m := make(map[string]string)
	m[PushStatus] = PushStatusRemove
	return m
}

func NewErrorPushResponse(message string) PushResponse {
	m := make(map[string]string)
	m[PushStatus] = PushStatusFail
	m[PushStatusErrorMsg] = message
	return m
}

func (pr *PushResponse) ToJson() string {
	b, _ := json.Marshal(pr)
	return string(b)
}

func PushResponseFromJson(data io.Reader) PushResponse {
	decoder := json.NewDecoder(data)

	var objmap PushResponse
	if err := decoder.Decode(&objmap); err != nil {
		return make(map[string]string)
	}
	return objmap
}
