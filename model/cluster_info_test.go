// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestClusterInfoJson(t *testing.T) {
	cluster := ClusterInfo{Id: NewId(), InterNodeUrl: NewId(), Hostname: NewId()}
	json := cluster.ToJson()
	result := ClusterInfoFromJson(strings.NewReader(json))

	if cluster.Id != result.Id {
		t.Fatal("Ids do not match")
	}

	cluster.SetAlive(true)
	if !cluster.IsAlive() {
		t.Fatal("should be live")
	}

	cluster.SetAlive(false)
	if cluster.IsAlive() {
		t.Fatal("should be not live")
	}
}

func TestClusterInfosJson(t *testing.T) {
	cluster := ClusterInfo{Id: NewId(), InterNodeUrl: NewId(), Hostname: NewId()}
	clusterInfos := make([]*ClusterInfo, 1)
	clusterInfos[0] = &cluster
	json := ClusterInfosToJson(clusterInfos)
	result := ClusterInfosFromJson(strings.NewReader(json))

	if clusterInfos[0].Id != result[0].Id {
		t.Fatal("Ids do not match")
	}

}
