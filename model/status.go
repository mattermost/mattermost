// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
	DNDEndTime     int64  `json:"dnd_end_time"`
	PrevStatus     string `json:"-"`
	MondayStart	   int64  `json:"monday_start"`
	MondayEnd  	   int64  `json:"monday_end"`
	TuesdayStart   int64  `json:"tuesday_start"`
	TuesdayEnd	   int64  `json:"tuesday_end"`
	WednesdayStart int64  `json:"wednesday_start"`
	WednesdayEnd   int64  `json:"wednesday_end"`
	ThursdayStart  int64  `json:"thursday_start"`
	ThursdayEnd	   int64  `json:"thursday_end"`
	FridayStart	   int64  `json:"friday_start"`
	FridayEnd	   int64  `json:"friday_end"`
	SaturdayStart  int64  `json:"saturday_start"`
	SaturdayEnd	   int64  `json:"saturday_end"`
	SundayStart	   int64  `json:"sunday_start"`
	SundayEnd	   int64  `json:"sunday_end"`
	Mode		   bool   `json:"mode"`
}

func (o *Status) ToJson() string {
	oCopy := *o
	oCopy.ActiveChannel = ""
	b, _ := json.Marshal(oCopy)
	return string(b)
}

func (o *Status) ToClusterJson() string {
	oCopy := *o
	b, _ := json.Marshal(oCopy)
	return string(b)
}

func StatusFromJson(data io.Reader) *Status {
	var o *Status
	json.NewDecoder(data).Decode(&o)
	return o
}

func StatusListToJson(u []*Status) string {
	uCopy := make([]Status, len(u))
	for i, s := range u {
		sCopy := *s
		sCopy.ActiveChannel = ""
		uCopy[i] = sCopy
	}

	b, _ := json.Marshal(uCopy)
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
