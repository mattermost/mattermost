// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestClusterInfoJson(t *testing.T) {
	cluster := ClusterInfo{Id: NewId(), InternodeUrl: NewId(), Hostname: NewId()}
	json := cluster.ToJson()
	result := ClusterInfoFromJson(strings.NewReader(json))

	if cluster.Id != result.Id {
		t.Fatal("Ids do not match")
	}
}
