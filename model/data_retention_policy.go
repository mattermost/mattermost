// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type GlobalRetentionPolicy struct {
	MessageDeletionEnabled bool  `json:"message_deletion_enabled"`
	FileDeletionEnabled    bool  `json:"file_deletion_enabled"`
	MessageRetentionCutoff int64 `json:"message_retention_cutoff"`
	FileRetentionCutoff    int64 `json:"file_retention_cutoff"`
}

type RetentionPolicy struct {
	Id           string      `json:"id"`
	DisplayName  string      `json:"display_name"`
	PostDuration int64       `json:"post_duration"`
	ChannelIds   StringArray `json:"channel_ids" db:"-"`
	TeamIds      StringArray `json:"team_ids" db:"-"`
}

type RetentionPolicyWithCounts struct {
	Id           string `json:"id"`
	DisplayName  string `json:"display_name"`
	PostDuration int64  `json:"post_duration"`
	ChannelCount int64  `json:"channel_count"`
	TeamCount    int64  `json:"team_count"`
}

type RetentionPolicyChannel struct {
	PolicyId  string
	ChannelId string
}

type RetentionPolicyTeam struct {
	PolicyId string
	TeamId   string
}

func (grp *GlobalRetentionPolicy) ToJson() string {
	b, _ := json.Marshal(grp)
	return string(b)
}

func GlobalRetentionPolicyFromJson(data io.Reader) *GlobalRetentionPolicy {
	var grp *GlobalRetentionPolicy
	json.NewDecoder(data).Decode(&grp)
	return grp
}

func (rp *RetentionPolicy) ToJsonBytes() []byte {
	b, _ := json.Marshal(rp)
	return b
}

func (rp *RetentionPolicy) ToJson() string {
	return string(rp.ToJsonBytes())
}

func RetentionPolicyFromJson(data io.Reader) (*RetentionPolicy, error) {
	var rp *RetentionPolicy
	err := json.NewDecoder(data).Decode(&rp)
	return rp, err
}
