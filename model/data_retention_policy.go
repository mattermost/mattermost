// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type DataRetentionPolicy struct {
	MessageDeletionEnabled bool  `json:"message_deletion_enabled"`
	FileDeletionEnabled    bool  `json:"file_deletion_enabled"`
	MessageRetentionCutoff int64 `json:"message_retention_cutoff"`
	FileRetentionCutoff    int64 `json:"file_retention_cutoff"`
}

func (drp *DataRetentionPolicy) ToJson() string {
	b, _ := json.Marshal(drp)
	return string(b)
}

func DataRetentionPolicyFromJson(data io.Reader) *DataRetentionPolicy {
	var drp *DataRetentionPolicy
	json.NewDecoder(data).Decode(&drp)
	return drp
}
