// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestClusterDiscovery(t *testing.T) {
	o := ClusterDiscovery{
		Type:        "test_type",
		ClusterName: "cluster_name",
		Hostname:    "test_hostname",
	}

	json := o.ToJson()
	result1 := ClusterDiscoveryFromJson(strings.NewReader(json))

	if result1.ClusterName != "cluster_name" {
		t.Fatal("should be set")
	}

	result2 := ClusterDiscoveryFromJson(strings.NewReader(json))
	result3 := ClusterDiscoveryFromJson(strings.NewReader(json))

	o.Id = "0"
	result1.Id = "1"
	result2.Id = "2"
	result3.Id = "3"
	result3.Hostname = "something_diff"

	if !o.IsEqual(result1) {
		t.Fatal("Should be equal")
	}

	list := make([]*ClusterDiscovery, 0)
	list = append(list, &o)
	list = append(list, result1)
	list = append(list, result2)
	list = append(list, result3)

	rlist := FilterClusterDiscovery(list, func(in *ClusterDiscovery) bool {
		return !o.IsEqual(in)
	})

	if len(rlist) != 1 {
		t.Fatal("should only have 1 result")
	}

	o.AutoFillHostname()
	o.Hostname = ""
	o.AutoFillHostname()

	o.AutoFillIpAddress()
	o.Hostname = ""
	o.AutoFillIpAddress()
}
