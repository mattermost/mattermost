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
	Id           string `json:"id,omitempty"`
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

type RetentionPolicyWithApplied struct {
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

type RetentionPolicyEnrichedList struct {
	Policies   []*RetentionPolicyEnriched `json:"policies"`
	TotalCount *int                       `json:"total_count,omitempty"`
}

type RetentionPolicyWithCountsList struct {
	Policies   []*RetentionPolicyWithCounts `json:"policies"`
	TotalCount *int                         `json:"total_count,omitempty"`
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

func (rp *RetentionPolicyEnriched) ToJson() []byte {
	b, _ := json.Marshal(rp)
	return b
}

func RetentionPolicyEnrichedFromJson(data io.Reader) (*RetentionPolicyEnriched, error) {
	var rp *RetentionPolicyEnriched
	err := json.NewDecoder(data).Decode(&rp)
	return rp, err
}

func RetentionPolicyEnrichedListFromJson(data io.Reader) ([]*RetentionPolicyEnriched, error) {
	var rpList *RetentionPolicyEnrichedList
	err := json.NewDecoder(data).Decode(&rpList)
	if err != nil {
		return nil, err
	}
	return rpList.Policies, nil
}

func (rpList *RetentionPolicyEnrichedList) ToJson() []byte {
	b, _ := json.Marshal(rpList)
	return b
}

func RetentionPolicyWithCountsListFromJson(data io.Reader) ([]*RetentionPolicyWithCounts, error) {
	var rpList *RetentionPolicyWithCountsList
	err := json.NewDecoder(data).Decode(&rpList)
	if err != nil {
		return nil, err
	}
	return rpList.Policies, nil
}

func (rpList *RetentionPolicyWithCountsList) ToJson() []byte {
	b, _ := json.Marshal(rpList)
	return b
}

func RetentionPolicyWithAppliedFromJson(data io.Reader) (*RetentionPolicyWithApplied, error) {
	var rp *RetentionPolicyWithApplied
	err := json.NewDecoder(data).Decode(&rp)
	return rp, err
}

func (rp *RetentionPolicyWithApplied) ToJson() []byte {
	b, _ := json.Marshal(rp)
	return b
}
