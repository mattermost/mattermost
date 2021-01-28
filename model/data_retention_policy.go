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
	Id           string `json:"id"`
	DisplayName  string `json:"display_name"`
	PostDuration int64  `json:"post_duration"`
}

type ChannelDisplayInfo struct {
	Id              string `json:"id"`
	DisplayName     string `json:"display_name"`
	TeamDisplayName string `json:"team_display_name"`
}

type TeamDisplayInfo struct {
	Id          string `json:"id"`
	DisplayName string `json:"display_name"`
}

type RetentionPolicyEnriched struct {
	RetentionPolicy
	Teams    []TeamDisplayInfo    `json:"teams"`
	Channels []ChannelDisplayInfo `json:"channels"`
}

type RetentionPolicyUpdate struct {
	RetentionPolicy
	TeamIds    []string `json:"team_ids"`
	ChannelIds []string `json:"channel_ids"`
}

type RetentionPolicyWithCounts struct {
	RetentionPolicy
	ChannelCount int64 `json:"channel_count"`
	TeamCount    int64 `json:"team_count"`
}

type RetentionPolicyChannel struct {
	PolicyId  string
	ChannelId string
}

type RetentionPolicyTeam struct {
	PolicyId string
	TeamId   string
}

func (rp *GlobalRetentionPolicy) ToJson() []byte {
	b, _ := json.Marshal(rp)
	return b
}

func GlobalRetentionPolicyFromJson(data io.Reader) *GlobalRetentionPolicy {
	var grp *GlobalRetentionPolicy
	json.NewDecoder(data).Decode(&grp)
	return grp
}

func (rp *RetentionPolicy) ToJson() []byte {
	b, _ := json.Marshal(rp)
	return b
}

func (rp *RetentionPolicyEnriched) ToJson() []byte {
	b, _ := json.Marshal(rp)
	return b
}

func RetentionPolicyFromJson(data io.Reader) (*RetentionPolicy, error) {
	var rp *RetentionPolicy
	err := json.NewDecoder(data).Decode(&rp)
	return rp, err
}

func RetentionPolicyUpdateFromJson(data io.Reader) (*RetentionPolicyUpdate, error) {
	var rp *RetentionPolicyUpdate
	err := json.NewDecoder(data).Decode(&rp)
	return rp, err
}
