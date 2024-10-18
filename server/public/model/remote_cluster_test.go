// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/rand"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoteClusterIsValid(t *testing.T) {
	id := NewId()
	creator := NewId()
	now := GetMillis()
	data := []struct {
		name  string
		rc    *RemoteCluster
		valid bool
	}{
		{name: "Zero value", rc: &RemoteCluster{}, valid: false},
		{name: "Missing cluster_name", rc: &RemoteCluster{RemoteId: id}, valid: false},
		{name: "Missing host_name", rc: &RemoteCluster{RemoteId: id, Name: NewId()}, valid: false},
		{name: "Missing create_at", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "example.com"}, valid: false},
		{name: "Missing last_ping_at", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "example.com", CreatorId: creator, CreateAt: now}, valid: true},
		{name: "Missing creator", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "example.com", CreateAt: now, LastPingAt: now}, valid: false},
		{name: "Bad default_team_id", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "example.com", CreateAt: now, LastPingAt: now, CreatorId: creator, DefaultTeamId: "bad-id"}, valid: false},
		{name: "Valid default_team_id", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "example.com", CreateAt: now, LastPingAt: now, CreatorId: creator, DefaultTeamId: NewId()}, valid: true},
		{name: "RemoteCluster valid", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "example.com", CreateAt: now, LastPingAt: now, CreatorId: creator}, valid: true},
		{name: "Include protocol", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "http://example.com", CreateAt: now, LastPingAt: now, CreatorId: creator}, valid: true},
		{name: "Include protocol & port", rc: &RemoteCluster{RemoteId: id, Name: NewId(), SiteURL: "http://example.com:8065", CreateAt: now, LastPingAt: now, CreatorId: creator}, valid: true},
	}

	for _, item := range data {
		appErr := item.rc.IsValid()
		if item.valid {
			assert.Nil(t, appErr, item.name)
		} else {
			assert.NotNil(t, appErr, item.name)
		}
	}
}

func TestRemoteClusterPreSave(t *testing.T) {
	now := GetMillis()

	o := RemoteCluster{RemoteId: NewId(), Name: NewId()}
	o.PreSave()

	require.GreaterOrEqual(t, o.CreateAt, now)
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
		{name: "Missing Topic", msg: &RemoteClusterMsg{Id: id}, valid: false},
		{name: "Missing Payload", msg: &RemoteClusterMsg{Id: id, CreateAt: now, Topic: "shared_channel"}, valid: false},
		{name: "RemoteClusterMsg valid", msg: &RemoteClusterMsg{Id: id, CreateAt: now, Topic: "shared_channel", Payload: []byte("{\"hello\":\"world\"}")}, valid: true},
	}

	for _, item := range data {
		appErr := item.msg.IsValid()
		if item.valid {
			assert.Nil(t, appErr, item.name)
		} else {
			assert.NotNil(t, appErr, item.name)
		}
	}
}

func TestRemoteClusterInviteIsValid(t *testing.T) {
	id := NewId()
	url := "https://localhost:8080/test"
	token := NewId()

	data := []struct {
		name   string
		invite *RemoteClusterInvite
		valid  bool
	}{
		{name: "Zero value", invite: &RemoteClusterInvite{}, valid: false},
		{name: "Missing remote id", invite: &RemoteClusterInvite{Token: token, SiteURL: url}, valid: false},
		{name: "Missing site url", invite: &RemoteClusterInvite{RemoteId: id, Token: token}, valid: false},
		{name: "Bad site url", invite: &RemoteClusterInvite{RemoteId: id, Token: token, SiteURL: ":/localhost"}, valid: false},
		{name: "Missing token", invite: &RemoteClusterInvite{RemoteId: id, SiteURL: url}, valid: false},
		{name: "RemoteClusterInvite valid", invite: &RemoteClusterInvite{RemoteId: id, Token: token, SiteURL: url}, valid: true},
	}

	for _, item := range data {
		appErr := item.invite.IsValid()
		if item.valid {
			assert.Nil(t, appErr, item.name)
		} else {
			assert.NotNil(t, appErr, item.name)
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
		name       string
		badDecrypt bool
		password   string
		invite     RemoteClusterInvite
	}{
		{name: "empty password", badDecrypt: false, password: "", invite: makeInvite("https://example.com:8065")},
		{name: "good password", badDecrypt: false, password: "Ultra secret password!", invite: makeInvite("https://example.com:8065")},
		{name: "bad decrypt", badDecrypt: true, password: "correct horse battery staple", invite: makeInvite("https://example.com:8065")},
	}

	for _, tt := range testData {
		encrypted, err := tt.invite.Encrypt(tt.password)
		require.NoError(t, err)

		invite := RemoteClusterInvite{}
		if tt.badDecrypt {
			buf := make([]byte, len(encrypted))
			_, err = io.ReadFull(rand.Reader, buf)
			assert.NoError(t, err)

			err = invite.Decrypt(buf, tt.password)
			require.Error(t, err)
		} else {
			err = invite.Decrypt(encrypted, tt.password)
			require.NoError(t, err)
			assert.Equal(t, tt.invite, invite)
		}
	}
}

func makeInvite(url string) RemoteClusterInvite {
	return RemoteClusterInvite{
		RemoteId: NewId(),
		SiteURL:  url,
		Token:    NewId(),
	}
}

func TestNewIDFromBytes(t *testing.T) {
	tests := []struct {
		name string
		ss   string
	}{
		{name: "empty", ss: ""},
		{name: "very short", ss: "x"},
		{name: "normal", ss: "com.mattermost.msteams-sync"},
		{name: "long", ss: "com.mattermost.msteams-synccom.mattermost.msteams-synccom.mattermost.msteams-synccom.mattermost.msteams-sync"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got1 := newIDFromBytes([]byte(tt.ss))

			assert.True(t, IsValidId(got1), "not a valid id")

			got2 := newIDFromBytes([]byte(tt.ss))
			assert.Equal(t, got1, got2, "newIDFromBytes must generate same id for same inputs")
		})
	}
}
