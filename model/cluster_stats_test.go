// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClusterStatsJson(t *testing.T) {
	cluster := ClusterStats{Id: NewId(), TotalWebsocketConnections: 1, TotalReadDbConnections: 1}
	json := cluster.ToJson()
	result := ClusterStatsFromJson(strings.NewReader(json))

	require.Equal(t, cluster.Id, result.Id, "Ids do not match")
}
