// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestMetrics(t *testing.T) {
	Setup()

	if 0 > Met.TotalWebSocketConnections.Value() {
		t.Fatal("failed to init")
	}

	if 0 > Met.TotalMasterDbConnections.Value() {
		t.Fatal("failed to init")
	}

	if 0 > Met.TotalReadDbConnections.Value() {
		t.Fatal("failed to init")
	}
}
