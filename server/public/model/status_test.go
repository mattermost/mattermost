// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStatus(t *testing.T) {
	status := Status{NewId(), StatusOnline, true, 0, "123", 0, ""}
	js, err := status.ToJSON()
	assert.NoError(t, err)
	var status2 Status
	err = json.Unmarshal(js, &status2)
	assert.NoError(t, err)

	assert.Equal(t, status.UserId, status2.UserId, "UserId should have matched")
	assert.Equal(t, status.Status, status2.Status, "Status should have matched")
	assert.Equal(t, status.LastActivityAt, status2.LastActivityAt, "LastActivityAt should have matched")
	assert.Equal(t, status.Manual, status2.Manual, "Manual should have matched")
	assert.Equal(t, "", status2.ActiveChannel)
}

func TestStatusListToJSON(t *testing.T) {
	statuses := []*Status{{NewId(), StatusOnline, true, 0, "123", 0, ""}, {NewId(), StatusOffline, true, 0, "", 0, ""}}
	jsonStatuses, err := StatusListToJSON(statuses)
	assert.NoError(t, err)

	var dat []map[string]any
	if err := json.Unmarshal(jsonStatuses, &dat); err != nil {
		panic(err)
	}

	assert.Len(t, dat, 2)

	_, ok := dat[0]["active_channel"]
	assert.False(t, ok)
	assert.Equal(t, statuses[0].ActiveChannel, "123")
	assert.Equal(t, statuses[0].UserId, dat[0]["user_id"])
	assert.Equal(t, statuses[1].UserId, dat[1]["user_id"])
}
