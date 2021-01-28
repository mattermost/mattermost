// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	UserPropsKeyCustomStatus = "customStatus"
	UserPropsKeyRecentCustomStatuses = "recentCustomStatuses"

	RecentCustomStatusesMaxLength = 5
)

type CustomStatus struct {
	Emoji string `json:"emoji"`
	Text  string `json:"text"`
}

func (cs *CustomStatus) ToJson() string {
	csCopy := *cs
	b, _ := json.Marshal(csCopy)
	return string(b)
}

func CustomStatusFromJson(data io.Reader) *CustomStatus {
	var cs *CustomStatus
	_ = json.NewDecoder(data).Decode(&cs)
	return cs
}

type RecentCustomStatuses []CustomStatus

func (rcs *RecentCustomStatuses) Add(cs *CustomStatus) *RecentCustomStatuses {
	newRCS := (*rcs)[:0]

	// if same `text` exists in existing recent custom statuses, modify existing status
	for _, status := range *rcs {
		if status.Text != cs.Text {
			newRCS = append(newRCS, status)
		}
	}
	newRCS = append(RecentCustomStatuses{*cs}, newRCS...)
	if len(newRCS) > RecentCustomStatusesMaxLength {
		newRCS = newRCS[:RecentCustomStatusesMaxLength-1]
	}
	return &newRCS
}

func (rcs *RecentCustomStatuses) Remove(cs *CustomStatus) *RecentCustomStatuses {
	var csJSON = cs.ToJson()
	if csJSON == "" || (cs.Emoji == "" && cs.Text == "") {
		return rcs
	}

	newRCS := (*rcs)[:0]
	for _, status := range *rcs {
		if status.ToJson() != csJSON {
			newRCS = append(newRCS, status)
		}
	}

	return &newRCS
}

func (rcs *RecentCustomStatuses) ToJson() string {
	rcsCopy := *rcs
	b, _ := json.Marshal(rcsCopy)
	return string(b)
}

func RecentCustomStatusesFromJson(data io.Reader) *RecentCustomStatuses {
	var rcs *RecentCustomStatuses
	_ = json.NewDecoder(data).Decode(&rcs)
	return rcs
}
