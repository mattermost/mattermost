// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	STATUS_OUT_OF_OFFICE   = "ooo"
	STATUS_OFFLINE         = "offline"
	STATUS_AWAY            = "away"
	STATUS_DND             = "dnd"
	STATUS_ONLINE          = "online"
	STATUS_CACHE_SIZE      = SESSION_CACHE_SIZE
	STATUS_CHANNEL_TIMEOUT = 20000  // 20 seconds
	STATUS_MIN_UPDATE_TIME = 120000 // 2 minutes
)

type Status struct {
	UserId         string `json:"user_id"`
	Status         string `json:"status"`
	Manual         bool   `json:"manual"`
	LastActivityAt int64  `json:"last_activity_at"`
	ActiveChannel  string `json:"-" db:"-"`
}

type UserStatusClusterMessage struct {
	*Status
	ActiveChannel string `json:"active_channel"`
}

func NewUserStatusClusterMessage(status *Status) *UserStatusClusterMessage {
	return &UserStatusClusterMessage{Status: status, ActiveChannel: status.ActiveChannel}
}

func (s *UserStatusClusterMessage) ToJson() string {
	b, _ := json.Marshal(s)
	return string(b)
}

func UserStatusClusterMessageFromJson(data io.Reader) *UserStatusClusterMessage {
	var s *UserStatusClusterMessage
	json.NewDecoder(data).Decode(&s)
	return s
}

func (s *UserStatusClusterMessage) ToStatus() *Status {
	s.Status.ActiveChannel = s.ActiveChannel
	return s.Status
}

func (o *Status) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func StatusFromJson(data io.Reader) *Status {
	var o *Status
	json.NewDecoder(data).Decode(&o)
	return o
}

func StatusListToJson(u []*Status) string {
	b, _ := json.Marshal(u)
	return string(b)
}

func StatusListFromJson(data io.Reader) []*Status {
	var statuses []*Status
	json.NewDecoder(data).Decode(&statuses)
	return statuses
}

func StatusMapToInterfaceMap(statusMap map[string]*Status) map[string]interface{} {
	interfaceMap := map[string]interface{}{}
	for _, s := range statusMap {
		// Omitted statues mean offline
		if s.Status != STATUS_OFFLINE {
			interfaceMap[s.UserId] = s.Status
		}
	}
	return interfaceMap
}
