// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClusterMessage(t *testing.T) {
	m := ClusterMessage{
		Event:    CLUSTER_EVENT_PUBLISH,
		SendType: CLUSTER_SEND_BEST_EFFORT,
		Data:     "hello",
	}
	json := m.ToJson()
	result := ClusterMessageFromJson(strings.NewReader(json))

	require.Equal(t, "hello", result.Data)

	badresult := ClusterMessageFromJson(strings.NewReader("junk"))
	if badresult != nil {
		t.Fatal("should not have parsed")
	}
}
