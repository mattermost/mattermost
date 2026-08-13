// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/rand"
	"io"
	"strings"
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
		{name: "Missing site_url", rc: &RemoteCluster{RemoteId: id, Name: NewId(), CreatorId: creator, CreateAt: now}, valid: false},
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
		skipFIPS   bool
	}{
		{name: "empty password", badDecrypt: false, password: "", invite: makeInvite("https://example.com:8065"), skipFIPS: true},
		{name: "good password", badDecrypt: false, password: "Ultra secret password!", invite: makeInvite("https://example.com:8065")},
		{name: "bad decrypt", badDecrypt: true, password: "correct horse battery staple", invite: makeInvite("https://example.com:8065")},
	}

	for _, tt := range testData {
		t.Run(tt.name, func(t *testing.T) {
			if tt.skipFIPS && FIPSEnabled {
				t.Skip("skipping under FIPS: encryption requires keys >= 14 bytes")
			}
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
		})
	}
}

func TestRemoteClusterInviteBackwardCompatibility(t *testing.T) {
	// Test that we can decrypt invites created with the old scrypt method
	oldInvite := RemoteClusterInvite{
		RemoteId:       NewId(),
		SiteURL:        "https://example.com:8065",
		Token:          NewId(),
		RefreshedToken: NewId(),
		Version:        2, // Old version using scrypt
	}

	password := NewTestPassword()

	// Encrypt with old method (scrypt)
	encrypted, err := oldInvite.Encrypt(password)
	require.NoError(t, err)

	// Decrypt should work with backward compatibility
	decryptedInvite := RemoteClusterInvite{}
	err = decryptedInvite.Decrypt(encrypted, password)
	require.NoError(t, err)
	assert.Equal(t, oldInvite, decryptedInvite)

	// Test new version (PBKDF2)
	newInvite := RemoteClusterInvite{
		RemoteId:       NewId(),
		SiteURL:        "https://example.com:8065",
		Token:          NewId(),
		RefreshedToken: NewId(),
		Version:        3, // New version using PBKDF2
	}

	// Encrypt with new method (PBKDF2)
	encrypted, err = newInvite.Encrypt(password)
	require.NoError(t, err)

	// Decrypt should work
	decryptedInvite = RemoteClusterInvite{}
	err = decryptedInvite.Decrypt(encrypted, password)
	require.NoError(t, err)
	assert.Equal(t, newInvite, decryptedInvite)
}

func makeInvite(url string) RemoteClusterInvite {
	return RemoteClusterInvite{
		RemoteId:       NewId(),
		SiteURL:        url,
		Token:          NewId(),
		RefreshedToken: NewId(),
		Version:        3,
	}
}

func TestRemoteClusterToRemoteClusterInfo(t *testing.T) {
	remoteID := NewId()
	now := GetMillis()
	rc := &RemoteCluster{
		RemoteId:    remoteID,
		Name:        "test-name",
		DisplayName: "Test Display Name",
		CreateAt:    now,
		DeleteAt:    0,
		LastPingAt:  now,
		SiteURL:     "https://example.com:8065",
	}

	info := rc.ToRemoteClusterInfo()

	assert.Equal(t, remoteID, info.RemoteId, "RemoteId should be set")
	assert.Equal(t, rc.Name, info.Name)
	assert.Equal(t, rc.DisplayName, info.DisplayName)
	assert.Equal(t, rc.CreateAt, info.CreateAt)
	assert.Equal(t, rc.DeleteAt, info.DeleteAt)
	assert.Equal(t, rc.LastPingAt, info.LastPingAt)
	assert.Equal(t, rc.SiteURL, info.SiteURL)
}

func TestRemoteClusterIsPlugin(t *testing.T) {
	t.Run("PluginID set returns true", func(t *testing.T) {
		rc := &RemoteCluster{PluginID: "com.example.plugin", SiteURL: "https://example.com"}
		assert.True(t, rc.IsPlugin())
	})

	t.Run("empty PluginID returns false", func(t *testing.T) {
		rc := &RemoteCluster{SiteURL: "https://example.com"}
		assert.False(t, rc.IsPlugin())
	})

	t.Run("plugin_ SiteURL prefix with empty PluginID returns false", func(t *testing.T) {
		rc := &RemoteCluster{SiteURL: SiteURLPlugin + "com.example.plugin"}
		assert.False(t, rc.IsPlugin(), "IsPlugin should only check PluginID, not SiteURL prefix")
	})
}

func TestCleanRemoteName(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{name: "single space", in: "legacy plugin", want: "legacy-plugin"},
		{name: "multiple spaces", in: "remote 1 plugin", want: "remote-1-plugin"},
		{name: "uppercase", in: "Plugin A", want: "plugin-a"},
		{name: "preserves dot, hyphen, underscore", in: "com.example_plugin-1", want: "com.example_plugin-1"},
		{name: "trims separators", in: "  ---my remote---  ", want: "my-remote"},
		{name: "punctuation collapses", in: "plugin@home!", want: "plugin-home"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CleanRemoteName(tc.in)
			assert.Equal(t, tc.want, got)
			assert.True(t, IsValidRemoteName(got), "CleanRemoteName must produce a valid name")
		})
	}

	t.Run("empty input falls back to NewId", func(t *testing.T) {
		got := CleanRemoteName("")
		assert.True(t, IsValidRemoteName(got))
		assert.Len(t, got, 26)
	})

	t.Run("only invalid characters falls back to NewId", func(t *testing.T) {
		got := CleanRemoteName("@@@ !!! ???")
		assert.True(t, IsValidRemoteName(got))
		assert.Len(t, got, 26)
	})

	t.Run("over-length input is truncated", func(t *testing.T) {
		in := strings.Repeat("a", RemoteNameMaxLength+10)
		got := CleanRemoteName(in)
		assert.True(t, IsValidRemoteName(got))
		assert.LessOrEqual(t, len(got), RemoteNameMaxLength)
	})
}
