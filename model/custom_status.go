// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"fmt"
	"time"

	"github.com/graph-gophers/graphql-go"
)

const (
	UserPropsKeyCustomStatus = "customStatus"

	CustomStatusTextMaxRunes = 100
	MaxRecentCustomStatuses  = 5
	DefaultCustomStatusEmoji = "speech_balloon"
)

var validCustomStatusDuration = map[string]bool{
	"thirty_minutes": true,
	"one_hour":       true,
	"four_hours":     true,
	"today":          true,
	"this_week":      true,
	"date_and_time":  true,
}

type CustomStatus struct {
	Emoji     string    `json:"emoji"`
	Text      string    `json:"text"`
	Duration  string    `json:"duration"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (cs *CustomStatus) PreSave() {
	if cs.Emoji == "" {
		cs.Emoji = DefaultCustomStatusEmoji
	}

	if cs.Duration == "" && !cs.ExpiresAt.Before(time.Now()) {
		cs.Duration = "date_and_time"
	}

	runes := []rune(cs.Text)
	if len(runes) > CustomStatusTextMaxRunes {
		cs.Text = string(runes[:CustomStatusTextMaxRunes])
	}
}

func (cs *CustomStatus) AreDurationAndExpirationTimeValid() bool {
	if cs.Duration == "" && (cs.ExpiresAt.IsZero() || !cs.ExpiresAt.Before(time.Now())) {
		return true
	}

	if validCustomStatusDuration[cs.Duration] && !cs.ExpiresAt.Before(time.Now()) {
		return true
	}

	return false
}

// ExpiresAt_ returns the time in a type that has the marshal/unmarshal methods
// attached to it.
func (cs *CustomStatus) ExpiresAt_() graphql.Time {
	return graphql.Time{Time: cs.ExpiresAt}
}

func RuneToHexadecimalString(r rune) string {
	return fmt.Sprintf("%04x", r)
}

type RecentCustomStatuses []CustomStatus

func (rcs RecentCustomStatuses) Contains(cs *CustomStatus) (bool, error) {
	if cs == nil {
		return false, nil
	}

	csJSON, jsonErr := json.Marshal(cs)
	if jsonErr != nil {
		return false, jsonErr
	}

	// status is empty
	if len(csJSON) == 0 || (cs.Emoji == "" && cs.Text == "") {
		return false, nil
	}

	for _, status := range rcs {
		js, jsonErr := json.Marshal(status)
		if jsonErr != nil {
			return false, jsonErr
		}
		if bytes.Equal(js, csJSON) {
			return true, nil
		}
	}

	return false, nil
}

func (rcs RecentCustomStatuses) Add(cs *CustomStatus) RecentCustomStatuses {
	newRCS := rcs[:0]

	// if same `text` exists in existing recent custom statuses, modify existing status
	for _, status := range rcs {
		if status.Text != cs.Text {
			newRCS = append(newRCS, status)
		}
	}
	newRCS = append(RecentCustomStatuses{*cs}, newRCS...)
	if len(newRCS) > MaxRecentCustomStatuses {
		newRCS = newRCS[:MaxRecentCustomStatuses]
	}
	return newRCS
}

func (rcs RecentCustomStatuses) Remove(cs *CustomStatus) (RecentCustomStatuses, error) {
	if cs == nil {
		return rcs, nil
	}

	csJSON, jsonErr := json.Marshal(cs)
	if jsonErr != nil {
		return rcs, jsonErr
	}

	if len(csJSON) == 0 || (cs.Emoji == "" && cs.Text == "") {
		return rcs, nil
	}

	newRCS := rcs[:0]
	for _, status := range rcs {
		js, jsonErr := json.Marshal(status)
		if jsonErr != nil {
			return rcs, jsonErr
		}
		if !bytes.Equal(js, csJSON) {
			newRCS = append(newRCS, status)
		}
	}

	return newRCS, nil
}
