// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoteClusterJson(t *testing.T) {
	o := RemoteCluster{Id: NewId(), ClusterName: "test"}
	json := o.ToJson()
	ro, err := RemoteClusterFromJson(strings.NewReader(json))

	require.NoError(t, err)
	require.Equal(t, o.Id, ro.Id)
	require.Equal(t, o.ClusterName, ro.ClusterName)
}

func TestRemoteClusterIsValid(t *testing.T) {
	id := NewId()
	now := GetMillis()
	data := []struct {
		name  string
		rc    *RemoteCluster
		valid bool
	}{
		{name: "Zero value", rc: &RemoteCluster{}, valid: false},
		{name: "Missing cluster_name", rc: &RemoteCluster{Id: id}, valid: false},
		{name: "Missing host_name", rc: &RemoteCluster{Id: id, ClusterName: "test cluster"}, valid: false},
		{name: "Missing create_at", rc: &RemoteCluster{Id: id, ClusterName: "test cluster", Hostname: "blap.com"}, valid: false},
		{name: "Missing last_ping_at", rc: &RemoteCluster{Id: id, ClusterName: "test cluster", Hostname: "blap.com", CreateAt: now}, valid: false},
		{name: "RemoteCluster valid", rc: &RemoteCluster{Id: id, ClusterName: "test cluster", Hostname: "blap.com", CreateAt: now, LastPingAt: now}, valid: true},
	}

	for _, item := range data {
		err := item.rc.IsValid()
		if item.valid {
			assert.Nil(t, err, item.name)
		} else {
			assert.NotNil(t, err, item.name)
		}
	}
}

func TestRemoteClusterPreSave(t *testing.T) {
	now := GetMillis()

	o := RemoteCluster{Id: NewId(), ClusterName: "test"}
	o.PreSave()

	require.GreaterOrEqual(t, o.CreateAt, now)
	require.GreaterOrEqual(t, o.LastPingAt, now)
}
