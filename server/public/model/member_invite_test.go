// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMemberInviteUnmarshalJSON(t *testing.T) {
	t.Run("raw email array", func(t *testing.T) {
		var invite MemberInvite
		err := json.Unmarshal([]byte(`["user1@example.com","user2@example.com"]`), &invite)
		require.NoError(t, err)
		require.Equal(t, []string{"user1@example.com", "user2@example.com"}, invite.Emails)
		require.Empty(t, invite.ChannelIds)
		require.Empty(t, invite.Profiles)
	})

	t.Run("object with emails and channels", func(t *testing.T) {
		var invite MemberInvite
		err := json.Unmarshal([]byte(`{"emails":["user1@example.com"],"channelIds":["junk"],"message":"hi"}`), &invite)
		require.NoError(t, err)
		require.Equal(t, []string{"user1@example.com"}, invite.Emails)
		require.Equal(t, []string{"junk"}, invite.ChannelIds)
		require.Equal(t, "hi", invite.Message)
		require.Empty(t, invite.Profiles)
	})

	t.Run("object with profiles", func(t *testing.T) {
		var invite MemberInvite
		err := json.Unmarshal([]byte(`{"emails":["user1@example.com"],"profiles":[{"email":"user1@example.com","username":"user.one","first_name":"User","last_name":"One"}]}`), &invite)
		require.NoError(t, err)
		require.Equal(t, []string{"user1@example.com"}, invite.Emails)
		require.Len(t, invite.Profiles, 1)
		require.Equal(t, "user1@example.com", invite.Profiles[0].Email)
		require.Equal(t, "user.one", invite.Profiles[0].Username)
		require.Equal(t, "User", invite.Profiles[0].FirstName)
		require.Equal(t, "One", invite.Profiles[0].LastName)
	})
}

func TestMemberInviteIsValid(t *testing.T) {
	validProfile := func() *MemberInviteProfile {
		return &MemberInviteProfile{
			Email:     "user1@example.com",
			Username:  "user.one",
			FirstName: "User",
			LastName:  "One",
		}
	}
	validInvite := func() *MemberInvite {
		return &MemberInvite{
			Emails:   []string{"user1@example.com"},
			Profiles: []*MemberInviteProfile{validProfile()},
		}
	}

	t.Run("valid without profiles", func(t *testing.T) {
		invite := &MemberInvite{Emails: []string{"user1@example.com"}}
		require.Nil(t, invite.IsValid())
	})

	t.Run("valid with profiles", func(t *testing.T) {
		require.Nil(t, validInvite().IsValid())
	})

	t.Run("no emails", func(t *testing.T) {
		invite := &MemberInvite{}
		appErr := invite.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.member.is_valid.emails.app_error", appErr.Id)
	})

	t.Run("invalid channel id", func(t *testing.T) {
		invite := &MemberInvite{Emails: []string{"user1@example.com"}, ChannelIds: []string{"junk"}}
		appErr := invite.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.member.is_valid.channel.app_error", appErr.Id)
	})

	t.Run("profile email not in email list", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].Email = "other@example.com"
		appErr := invite.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.member.is_valid.profile_email.app_error", appErr.Id)
	})

	t.Run("profile email matching is case-insensitive", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].Email = "User1@Example.com"
		require.Nil(t, invite.IsValid())
	})

	t.Run("invalid username", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].Username = "inv@lid"
		appErr := invite.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.member.is_valid.profile_username.app_error", appErr.Id)
	})

	t.Run("empty username", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].Username = ""
		appErr := invite.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.member.is_valid.profile_username.app_error", appErr.Id)
	})

	t.Run("uppercase username is valid after lowercasing", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].Username = "User.One"
		require.Nil(t, invite.IsValid())
	})

	t.Run("first name too long", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].FirstName = strings.Repeat("a", UserFirstNameMaxRunes+1)
		appErr := invite.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.member.is_valid.profile_first_name.app_error", appErr.Id)
	})

	t.Run("last name too long", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].LastName = strings.Repeat("a", UserLastNameMaxRunes+1)
		appErr := invite.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.member.is_valid.profile_last_name.app_error", appErr.Id)
	})

	t.Run("empty names are allowed", func(t *testing.T) {
		invite := validInvite()
		invite.Profiles[0].FirstName = ""
		invite.Profiles[0].LastName = ""
		require.Nil(t, invite.IsValid())
	})
}

func TestMemberInviteAuditable(t *testing.T) {
	invite := &MemberInvite{
		Emails:     []string{"user1@example.com"},
		ChannelIds: []string{"channel1"},
		Profiles:   []*MemberInviteProfile{{Email: "user1@example.com", Username: "user.one"}},
	}
	auditable := invite.Auditable()
	require.Equal(t, []string{"user1@example.com"}, auditable["emails"])
	require.Equal(t, []string{"channel1"}, auditable["channel_ids"])
	require.Equal(t, 1, auditable["profile_count"])
}
