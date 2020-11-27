// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoteClusterJson(t *testing.T) {
	o := RemoteCluster{RemoteId: NewId(), DisplayName: "test"}

	json, err := o.ToJSON()
	require.NoError(t, err)

	ro, err := RemoteClusterFromJSON(strings.NewReader(json))
	require.NoError(t, err)

	require.Equal(t, o.RemoteId, ro.RemoteId)
	require.Equal(t, o.DisplayName, ro.DisplayName)
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
		{name: "Missing cluster_name", rc: &RemoteCluster{RemoteId: id}, valid: false},
		{name: "Missing host_name", rc: &RemoteCluster{RemoteId: id, DisplayName: "test cluster"}, valid: false},
		{name: "Missing create_at", rc: &RemoteCluster{RemoteId: id, DisplayName: "test cluster", SiteURL: "blap.com"}, valid: false},
		{name: "Missing last_ping_at", rc: &RemoteCluster{RemoteId: id, DisplayName: "test cluster", SiteURL: "blap.com", CreateAt: now}, valid: false},
		{name: "RemoteCluster valid", rc: &RemoteCluster{RemoteId: id, DisplayName: "test cluster", SiteURL: "blap.com", CreateAt: now, LastPingAt: now}, valid: true},
		{name: "Include protocol", rc: &RemoteCluster{RemoteId: id, DisplayName: "test cluster", SiteURL: "http://blap.com", CreateAt: now, LastPingAt: now}, valid: true},
		{name: "Include protocol & port", rc: &RemoteCluster{RemoteId: id, DisplayName: "test cluster", SiteURL: "http://blap.com:8065", CreateAt: now, LastPingAt: now}, valid: true},
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

	o := RemoteCluster{RemoteId: NewId(), DisplayName: "test"}
	o.PreSave()

	require.GreaterOrEqual(t, o.CreateAt, now)
	require.GreaterOrEqual(t, o.LastPingAt, now)
}

func TestRemoteClusterMsgJson(t *testing.T) {
	o := RemoteClusterMsg{Id: NewId(), CreateAt: GetMillis(), Token: NewId(), Topic: "shared_channel"}

	json, err := json.Marshal(o)
	require.NoError(t, err)

	ro, err := RemoteClusterMsgFromJSON(strings.NewReader(string(json)))
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

func TestRemoteClusterInviteEncryption(t *testing.T) {
	testData := []struct {
		name     string
		password string
		invite   RemoteClusterInvite
	}{
		{name: "empty password", password: "", invite: RemoteClusterInvite{RemoteId: NewId(), SiteURL: "https://somewhere.com:8065", Token: NewId()}},
		{name: "good password", password: "Ultra secret password!", invite: RemoteClusterInvite{RemoteId: NewId(), SiteURL: "https://nowhere.com:8065", Token: NewId()}},
	}

	for _, tt := range testData {
		encrypted, err := tt.invite.Encrypt(tt.password)
		require.NoError(t, err)

		invite := RemoteClusterInvite{}
		err = invite.Decrypt(encrypted, tt.password)
		require.NoError(t, err)

		assert.Equal(t, tt.invite, invite)
	}
}
