// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type StatusSchedule struct {
	UserId         string `json:"user_id"`
	MondayStart    string `json:"monday_start"`
	MondayEnd      string `json:"monday_end"`
	TuesdayStart   string `json:"tuesday_start"`
	TuesdayEnd     string `json:"tuesday_end"`
	WednesdayStart string `json:"wednesday_start"`
	WednesdayEnd   string `json:"wednesday_end"`
	ThursdayStart  string `json:"thursday_start"`
	ThursdayEnd    string `json:"thursday_end"`
	FridayStart    string `json:"friday_start"`
	FridayEnd      string `json:"friday_end"`
	SaturdayStart  string `json:"saturday_start"`
	SaturdayEnd    string `json:"saturday_end"`
	SundayStart    string `json:"sunday_start"`
	SundayEnd      string `json:"sunday_end"`
	Mode           int64  `json:"mode"`
}

func (o *StatusSchedule) ToJson() string {
	oCopy := *o
	b, _ := json.Marshal(oCopy)
	return string(b)
}

func (o *StatusSchedule) ToClusterJson() string {
	oCopy := *o
	b, _ := json.Marshal(oCopy)
	return string(b)
}

func StatusScheduleFromJson(data io.Reader) *StatusSchedule {
	var o *StatusSchedule
	json.NewDecoder(data).Decode(&o)
	return o
}
