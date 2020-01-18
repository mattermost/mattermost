// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type CommandMoveRequest struct {
	TeamId string `json:"team_id"`
}

func TeamIdFromCommandMoveRequestJson(data io.Reader) (string, error) {
	decoder := json.NewDecoder(data)
	var cmr CommandMoveRequest
	err := decoder.Decode(&cmr)
	if err != nil {
		return "", err
	}
	return cmr.TeamId, nil
}

func (cmr *CommandMoveRequest) ToJson() string {
	b, err := json.Marshal(cmr)
	if err != nil {
		return ""
	}
	return string(b)
}
