// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestClusterDiscovery(t *testing.T) {
	o := ClusterDiscovery{
		ClusterName: "cluster_name",
	}

	json := o.ToJson()
	result := ClusterDiscoveryFromJson(strings.NewReader(json))

	if result.ClusterName != "cluster_name" {
		t.Fatal("should be set")
	}
}
