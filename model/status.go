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
	ActiveChannel  string `json:"active_channel,omitempty" db:"-"`
}

func (o *Status) ToJson() string {
	tempChannelId := o.ActiveChannel
	o.ActiveChannel = ""
	b, _ := json.Marshal(o)
	o.ActiveChannel = tempChannelId
	return string(b)
}

func (o *Status) ToClusterJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func StatusFromJson(data io.Reader) *Status {
	var o *Status
	json.NewDecoder(data).Decode(&o)
	return o
}

func StatusListToJson(u []*Status) string {
	activeChannels := make([]string, len(u))
	for index, s := range u {
		activeChannels[index] = s.ActiveChannel
		s.ActiveChannel = ""
	}

	b, _ := json.Marshal(u)

	for index, s := range u {
		s.ActiveChannel = activeChannels[index]
	}

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
