// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestClusterInfoJson(t *testing.T) {
	cluster := ClusterInfo{IpAddress: NewId(), Hostname: NewId()}
	json := cluster.ToJson()
	result := ClusterInfoFromJson(strings.NewReader(json))

	assert.Equal(t, cluster.IpAddress, result.IpAddress, "Ids do not match")
}

func TestClusterInfosJson(t *testing.T) {
	cluster := ClusterInfo{IpAddress: NewId(), Hostname: NewId()}
	clusterInfos := make([]*ClusterInfo, 1)
	clusterInfos[0] = &cluster
	json := ClusterInfosToJson(clusterInfos)
	result := ClusterInfosFromJson(strings.NewReader(json))

	assert.Equal(t, clusterInfos[0].IpAddress, result[0].IpAddress, "Ids do not match")
}
