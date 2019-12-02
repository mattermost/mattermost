// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
)

type GroupSyncableType string

const (
	GroupSyncableTypeTeam    GroupSyncableType = "Team"
	GroupSyncableTypeChannel GroupSyncableType = "Channel"
)

func (gst GroupSyncableType) String() string {
	return string(gst)
}

type GroupSyncable struct {
	GroupId string `json:"group_id"`

	// SyncableId represents the Id of the model that is being synced with the group, for example a ChannelId or
	// TeamId.
	SyncableId string `db:"-" json:"-"`

	AutoAdd     bool              `json:"auto_add"`
	SchemeAdmin bool              `json:"scheme_admin"`
	CreateAt    int64             `json:"create_at"`
	DeleteAt    int64             `json:"delete_at"`
	UpdateAt    int64             `json:"update_at"`
	Type        GroupSyncableType `db:"-" json:"-"`

	// Values joined in from the associated team and/or channel
	ChannelDisplayName string `db:"-" json:"-"`
	TeamDisplayName    string `db:"-" json:"-"`
	TeamType           string `db:"-" json:"-"`
	ChannelType        string `db:"-" json:"-"`
	TeamID             string `db:"-" json:"-"`
}

func (syncable *GroupSyncable) IsValid() *AppError {
	if !IsValidId(syncable.GroupId) {
		return NewAppError("GroupSyncable.SyncableIsValid", "model.group_syncable.group_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !IsValidId(syncable.SyncableId) {
		return NewAppError("GroupSyncable.SyncableIsValid", "model.group_syncable.syncable_id.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func (syncable *GroupSyncable) UnmarshalJSON(b []byte) error {
	var kvp map[string]interface{}
	err := json.Unmarshal(b, &kvp)
	if err != nil {
		return err
	}
	for key, value := range kvp {
		switch key {
		case "team_id":
			syncable.SyncableId = value.(string)
			syncable.Type = GroupSyncableTypeTeam
		case "channel_id":
			syncable.SyncableId = value.(string)
			syncable.Type = GroupSyncableTypeChannel
		case "group_id":
			syncable.GroupId = value.(string)
		case "auto_add":
			syncable.AutoAdd = value.(bool)
		default:
		}
	}
	return nil
}

func (syncable *GroupSyncable) MarshalJSON() ([]byte, error) {
	type Alias GroupSyncable

	switch syncable.Type {
	case GroupSyncableTypeTeam:
		return json.Marshal(&struct {
			TeamID          string `json:"team_id"`
			TeamDisplayName string `json:"team_display_name,omitempty"`
			TeamType        string `json:"team_type,omitempty"`
			*Alias
		}{
			TeamDisplayName: syncable.TeamDisplayName,
			TeamType:        syncable.TeamType,
			TeamID:          syncable.SyncableId,
			Alias:           (*Alias)(syncable),
		})
	case GroupSyncableTypeChannel:
		return json.Marshal(&struct {
			ChannelID          string `json:"channel_id"`
			ChannelDisplayName string `json:"channel_display_name,omitempty"`
			ChannelType        string `json:"channel_type,omitempty"`

			TeamID          string `json:"team_id,omitempty"`
			TeamDisplayName string `json:"team_display_name,omitempty"`
			TeamType        string `json:"team_type,omitempty"`

			*Alias
		}{
			ChannelID:          syncable.SyncableId,
			ChannelDisplayName: syncable.ChannelDisplayName,
			ChannelType:        syncable.ChannelType,

			TeamID:          syncable.TeamID,
			TeamDisplayName: syncable.TeamDisplayName,
			TeamType:        syncable.TeamType,

			Alias: (*Alias)(syncable),
		})
	default:
		return nil, &json.MarshalerError{
			Err: fmt.Errorf("unknown syncable type: %s", syncable.Type),
		}
	}
}

type GroupSyncablePatch struct {
	AutoAdd     *bool `json:"auto_add"`
	SchemeAdmin *bool `json:"scheme_admin"`
}

func (syncable *GroupSyncable) Patch(patch *GroupSyncablePatch) {
	if patch.AutoAdd != nil {
		syncable.AutoAdd = *patch.AutoAdd
	}
	if patch.SchemeAdmin != nil {
		syncable.SchemeAdmin = *patch.SchemeAdmin
	}
}

type UserTeamIDPair struct {
	UserID string
	TeamID string
}

type UserChannelIDPair struct {
	UserID    string
	ChannelID string
}

func GroupSyncableFromJson(data io.Reader) *GroupSyncable {
	groupSyncable := &GroupSyncable{}
	bodyBytes, _ := ioutil.ReadAll(data)
	json.Unmarshal(bodyBytes, groupSyncable)
	return groupSyncable
}

func GroupSyncablesFromJson(data io.Reader) []*GroupSyncable {
	groupSyncables := []*GroupSyncable{}
	bodyBytes, _ := ioutil.ReadAll(data)
	json.Unmarshal(bodyBytes, &groupSyncables)
	return groupSyncables
}

func NewGroupTeam(groupID, teamID string, autoAdd bool) *GroupSyncable {
	return &GroupSyncable{
		GroupId:    groupID,
		SyncableId: teamID,
		Type:       GroupSyncableTypeTeam,
		AutoAdd:    autoAdd,
	}
}

func NewGroupChannel(groupID, channelID string, autoAdd bool) *GroupSyncable {
	return &GroupSyncable{
		GroupId:    groupID,
		SyncableId: channelID,
		Type:       GroupSyncableTypeChannel,
		AutoAdd:    autoAdd,
	}
}
