// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

type GroupSyncableType int

const (
	GSTeam GroupSyncableType = iota
	GSChannel
)

var GroupSyncableTypes = []GroupSyncableType{GSTeam, GSChannel}

func (gst GroupSyncableType) String() string {
	// Order matters. Keep in sync with iotas.
	return [...]string{"Team", "Channel"}[gst]
}

type GroupSyncable struct {
	GroupId    string            `json:"group_id"`
	SyncableId string            `db:"-" json:"-"`
	CanLeave   bool              `json:"can_leave"`
	AutoAdd    bool              `json:"auto_add"`
	CreateAt   int64             `json:"create_at"`
	DeleteAt   int64             `json:"delete_at"`
	UpdateAt   int64             `json:"update_at"`
	Type       GroupSyncableType `db:"-" json:"-"`
}

func (syncable *GroupSyncable) IsValid() *AppError {
	if !IsValidId(syncable.GroupId) {
		return NewAppError("GroupSyncable.SyncableIsValid", "model.group_syncable.group_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !IsValidId(syncable.SyncableId) {
		return NewAppError("GroupSyncable.SyncableIsValid", "model.group_syncable.syncable_id.app_error", nil, "", http.StatusBadRequest)
	}
	if syncable.AutoAdd == false && syncable.CanLeave == false {
		return NewAppError("GroupSyncable.SyncableIsValid", "model.group_syncable.invalid_state", nil, "", http.StatusBadRequest)
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
			syncable.Type = GSTeam
		case "channel_id":
			syncable.SyncableId = value.(string)
			syncable.Type = GSChannel
		case "group_id":
			syncable.GroupId = value.(string)
		case "can_leave":
			syncable.CanLeave = value.(bool)
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
	case GSTeam:
		return json.Marshal(&struct {
			TeamId string `json:"team_id"`
			*Alias
		}{
			TeamId: syncable.SyncableId,
			Alias:  (*Alias)(syncable),
		})
	case GSChannel:
		return json.Marshal(&struct {
			ChannelId string `json:"channel_id"`
			*Alias
		}{
			ChannelId: syncable.SyncableId,
			Alias:     (*Alias)(syncable),
		})
	default:
		return nil, &json.MarshalerError{}
	}
}

type GroupSyncablePatch struct {
	CanLeave *bool `json:"can_leave"`
	AutoAdd  *bool `json:"auto_add"`
}

func (syncable *GroupSyncable) Patch(patch *GroupSyncablePatch) {
	if patch.CanLeave != nil {
		syncable.CanLeave = *patch.CanLeave
	}
	if patch.AutoAdd != nil {
		syncable.AutoAdd = *patch.AutoAdd
	}
}
