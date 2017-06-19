// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestClusterMessage(t *testing.T) {
	m := ClusterMessage{
		Event:    CLUSTER_EVENT_PUBLISH,
		SendType: CLUSTER_SEND_BEST_EFFORT,
		Data:     "hello",
	}
	json := m.ToJson()
	result := ClusterMessageFromJson(strings.NewReader(json))

	if result.Data != "hello" {
		t.Fatal()
	}

	badresult := ClusterMessageFromJson(strings.NewReader("junk"))
	if badresult != nil {
		t.Fatal("should not have parsed")
	}
}
