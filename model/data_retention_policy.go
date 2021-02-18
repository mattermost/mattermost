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

type RetentionPolicyWithTeamsAndChannels struct {
	RetentionPolicy
	Teams    []*Team    `json:"teams"`
	Channels []*Channel `json:"channels"`
}

type RetentionPolicyWithTeamAndChannelIds struct {
	RetentionPolicy
	TeamIds    []string `json:"team_ids"`
	ChannelIds []string `json:"channel_ids"`
}

type RetentionPolicyWithTeamAndChannelCounts struct {
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

type RetentionPolicyWithTeamsAndChannelsList struct {
	Policies   []*RetentionPolicyWithTeamsAndChannels `json:"policies"`
	TotalCount *int                                   `json:"total_count,omitempty"`
}

type RetentionPolicyWithTeamAndChannelCountsList struct {
	Policies   []*RetentionPolicyWithTeamAndChannelCounts `json:"policies"`
	TotalCount *int                                       `json:"total_count,omitempty"`
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

func (rp *RetentionPolicyWithTeamsAndChannels) ToJson() []byte {
	b, _ := json.Marshal(rp)
	return b
}

func RetentionPolicyEnrichedFromJson(data io.Reader) (*RetentionPolicyWithTeamsAndChannels, error) {
	var rp *RetentionPolicyWithTeamsAndChannels
	err := json.NewDecoder(data).Decode(&rp)
	return rp, err
}

func RetentionPolicyWithTeamsAndChannelsListFromJson(data io.Reader) ([]*RetentionPolicyWithTeamsAndChannels, error) {
	var rpList *RetentionPolicyWithTeamsAndChannelsList
	err := json.NewDecoder(data).Decode(&rpList)
	if err != nil {
		return nil, err
	}
	return rpList.Policies, nil
}

func (rpList *RetentionPolicyWithTeamsAndChannelsList) ToJson() []byte {
	b, _ := json.Marshal(rpList)
	return b
}

func RetentionPolicyWithTeamAndChannelCountsListFromJson(data io.Reader) ([]*RetentionPolicyWithTeamAndChannelCounts, error) {
	var rpList *RetentionPolicyWithTeamAndChannelCountsList
	err := json.NewDecoder(data).Decode(&rpList)
	if err != nil {
		return nil, err
	}
	return rpList.Policies, nil
}

func (rpList *RetentionPolicyWithTeamAndChannelCountsList) ToJson() []byte {
	b, _ := json.Marshal(rpList)
	return b
}

func RetentionPolicyWithTeamAndChannelIdsFromJson(data io.Reader) (*RetentionPolicyWithTeamAndChannelIds, error) {
	var rp *RetentionPolicyWithTeamAndChannelIds
	err := json.NewDecoder(data).Decode(&rp)
	return rp, err
}

func (rp *RetentionPolicyWithTeamAndChannelIds) ToJson() []byte {
	b, _ := json.Marshal(rp)
	return b
}
