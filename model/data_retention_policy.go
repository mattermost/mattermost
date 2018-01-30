// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

func (me *DataRetentionPolicy) ToJson() string {
	b, _ := json.Marshal(me)
	return string(b)
}

func DataRetentionPolicyFromJson(data io.Reader) *DataRetentionPolicy {
	var me *DataRetentionPolicy
	json.NewDecoder(data).Decode(&me)
	return me
}
