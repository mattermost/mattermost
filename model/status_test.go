// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStatus(t *testing.T) {
	status := Status{NewId(), STATUS_ONLINE, true, 0, "123"}
	json := status.ToJson()
	status2 := StatusFromJson(strings.NewReader(json))

	if status.UserId != status2.UserId {
		t.Fatal("UserId should have matched")
	}

	if status.Status != status2.Status {
		t.Fatal("Status should have matched")
	}

	if status.LastActivityAt != status2.LastActivityAt {
		t.Fatal("LastActivityAt should have matched")
	}

	if status.Manual != status2.Manual {
		t.Fatal("Manual should have matched")
	}

	assert.Equal(t, "", status2.ActiveChannel)

	json = status.ToClusterJson()
	status2 = StatusFromJson(strings.NewReader(json))

	assert.Equal(t, status.ActiveChannel, status2.ActiveChannel)
}

func TestStatusListToJson(t *testing.T) {
	statuses := []*Status{{NewId(), STATUS_ONLINE, true, 0, "123"}, {NewId(), STATUS_OFFLINE, true, 0, ""}}
	jsonStatuses := StatusListToJson(statuses)

	var dat []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStatuses), &dat); err != nil {
		panic(err)
	}

	assert.Equal(t, len(dat), 2)

	_, ok := dat[0]["active_channel"]
	assert.False(t, ok)
	assert.Equal(t, statuses[0].ActiveChannel, "123")
	assert.Equal(t, statuses[0].UserId, dat[0]["user_id"])
	assert.Equal(t, statuses[1].UserId, dat[1]["user_id"])
}

func TestStatusListFromJson(t *testing.T) {
	const jsonStream = `
    		 [{"user_id":"k39fowpzhfffjxeaw8ecyrygme","status":"online","manual":true,"last_activity_at":0},{"user_id":"e9f1bbg8wfno7b3k7yk79bbwfy","status":"offline","manual":true,"last_activity_at":0}]
    	`
	var dat []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStream), &dat); err != nil {
		panic(err)
	}

	toDec := strings.NewReader(jsonStream)
	statusesFromJson := StatusListFromJson(toDec)

	if statusesFromJson[0].UserId != dat[0]["user_id"] {
		t.Fatal("UserId should be equal")
	}
	if statusesFromJson[1].UserId != dat[1]["user_id"] {
		t.Fatal("UserId should be equal")
	}
}
