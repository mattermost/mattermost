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
	validInvite := func() *MemberInvite {
		return &MemberInvite{
			Emails: []string{"user1@example.com"},
			Profiles: []*MemberInviteProfile{{
				Email:     "user1@example.com",
				Username:  "user.one",
				FirstName: "User",
				LastName:  "One",
			}},
		}
	}

	tests := []struct {
		name        string
		mutate      func(*MemberInvite)
		expectedErr string
	}{
		{
			name:   "valid without profiles",
			mutate: func(invite *MemberInvite) { invite.Profiles = nil },
		},
		{name: "valid with profiles"},
		{
			name:        "no emails",
			mutate:      func(invite *MemberInvite) { invite.Emails = nil },
			expectedErr: "model.member.is_valid.emails.app_error",
		},
		{
			name:        "invalid channel",
			mutate:      func(invite *MemberInvite) { invite.ChannelIds = []string{"junk"} },
			expectedErr: "model.member.is_valid.channel.app_error",
		},
		{
			name:   "case-insensitive profile email",
			mutate: func(invite *MemberInvite) { invite.Emails[0] = "USER1@EXAMPLE.COM" },
		},
		{
			name:        "profile email not invited",
			mutate:      func(invite *MemberInvite) { invite.Profiles[0].Email = "other@example.com" },
			expectedErr: "model.member.is_valid.profile_email.app_error",
		},
		{
			name: "duplicate profile email",
			mutate: func(invite *MemberInvite) {
				invite.Profiles = append(invite.Profiles, &MemberInviteProfile{Email: "USER1@EXAMPLE.COM", Username: "user.two"})
			},
			expectedErr: "model.member.is_valid.profile_email_duplicate.app_error",
		},
		{
			name:        "nil profile",
			mutate:      func(invite *MemberInvite) { invite.Profiles = []*MemberInviteProfile{nil} },
			expectedErr: "model.member.is_valid.profile_nil.app_error",
		},
		{
			name: "duplicate usernames",
			mutate: func(invite *MemberInvite) {
				invite.Emails = append(invite.Emails, "user2@example.com")
				invite.Profiles = append(invite.Profiles, &MemberInviteProfile{Email: "user2@example.com", Username: "USER.ONE"})
			},
			expectedErr: "model.member.is_valid.profile_username_duplicate.app_error",
		},
		{
			name:        "invalid username",
			mutate:      func(invite *MemberInvite) { invite.Profiles[0].Username = "inv@lid" },
			expectedErr: "model.member.is_valid.profile_username.app_error",
		},
		{
			name:   "uppercase username",
			mutate: func(invite *MemberInvite) { invite.Profiles[0].Username = "User.One" },
		},
		{
			name: "first name too long",
			mutate: func(invite *MemberInvite) {
				invite.Profiles[0].FirstName = strings.Repeat("a", UserFirstNameMaxRunes+1)
			},
			expectedErr: "model.member.is_valid.profile_first_name.app_error",
		},
		{
			name:        "last name too long",
			mutate:      func(invite *MemberInvite) { invite.Profiles[0].LastName = strings.Repeat("a", UserLastNameMaxRunes+1) },
			expectedErr: "model.member.is_valid.profile_last_name.app_error",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			invite := validInvite()
			if test.mutate != nil {
				test.mutate(invite)
			}
			appErr := invite.IsValid()
			if test.expectedErr == "" {
				require.Nil(t, appErr)
			} else {
				require.NotNil(t, appErr)
				require.Equal(t, test.expectedErr, appErr.Id)
			}
		})
	}
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
