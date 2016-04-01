// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestGetPing(t *testing.T) {
	Setup()

	result, err := Client.GetPing()
	if err != nil {
		t.Fatal(err)
	}

	response := result.Data.(map[string]string)

	_, hasVersionKey := response["version"]
	if hasVersionKey == false {
		t.Fatalf("%s: %s", "Missing 'version' key", response)
	}

	_, hasTimestampKey := response["timestamp"]
	if hasTimestampKey == false {
		t.Fatalf("%s: %s", "Missing 'timestamp' key", response)
	}
}
