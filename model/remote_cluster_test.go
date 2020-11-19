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

	json, err := o.ToJSON()
	require.NoError(t, err)

	ro, err := RemoteClusterFromJSON(strings.NewReader(json))
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

func TestRemoteClusterMsgJson(t *testing.T) {
	o := RemoteClusterMsg{Id: NewId(), CreateAt: GetMillis(), Token: NewId(), Topic: "shared_channel"}

	json, err := o.ToJSON()
	require.NoError(t, err)

	ro, err := RemoteClusterMsgFromJSON(strings.NewReader(json))
	require.NoError(t, err)

	require.Equal(t, o.Id, ro.Id)
	require.Equal(t, o.CreateAt, ro.CreateAt)
	require.Equal(t, o.Token, ro.Token)
	require.Equal(t, o.Topic, ro.Topic)
}

func TestRemoteClusterMsgIsValid(t *testing.T) {
	id := NewId()
	now := GetMillis()
	data := []struct {
		name  string
		msg   *RemoteClusterMsg
		valid bool
	}{
		{name: "Zero value", msg: &RemoteClusterMsg{}, valid: false},
		{name: "Missing remote id", msg: &RemoteClusterMsg{Id: id}, valid: false},
		{name: "Missing Token", msg: &RemoteClusterMsg{Id: id}, valid: false},
		{name: "Missing Topic", msg: &RemoteClusterMsg{Id: id, Token: NewId()}, valid: false},
		{name: "RemoteClusterMsg valid", msg: &RemoteClusterMsg{Id: id, Token: NewId(), CreateAt: now, Topic: "shared_channel"}, valid: true},
	}

	for _, item := range data {
		err := item.msg.IsValid()
		if item.valid {
			assert.Nil(t, err, item.name)
		} else {
			assert.NotNil(t, err, item.name)
		}
	}
}

func TestFixTopics(t *testing.T) {
	testData := []struct {
		topics   string
		expected string
	}{
		{topics: "", expected: ""},
		{topics: "   ", expected: ""},
		{topics: "share", expected: " share "},
		{topics: "share incident", expected: " share incident "},
		{topics: " share incident ", expected: " share incident "},
		{topics: "    share     incident    ", expected: " share incident "},
	}

	for _, tt := range testData {
		rc := &RemoteCluster{Topics: tt.topics}
		rc.fixTopics()
		assert.Equal(t, tt.expected, rc.Topics)
	}
}
