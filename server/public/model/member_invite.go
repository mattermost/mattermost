// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"
)

type MemberInvite struct {
	Emails     []string               `json:"emails"`
	ChannelIds []string               `json:"channelIds,omitempty"`
	Message    string                 `json:"message"`
	Profiles   []*MemberInviteProfile `json:"profiles,omitempty"`
}

// MemberInviteProfile carries admin-chosen profile fields for a single invited email,
// applied to the account created from that invitation.
type MemberInviteProfile struct {
	Email     string `json:"email"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func (i *MemberInvite) Auditable() map[string]any {
	return map[string]any{
		"emails":        i.Emails,
		"channel_ids":   i.ChannelIds,
		"profile_count": len(i.Profiles),
	}
}

// IsValid validates that the invitation info is loaded correctly and with the correct structure
func (i *MemberInvite) IsValid() *AppError {
	if len(i.Emails) == 0 {
		return NewAppError("MemberInvite.IsValid", "model.member.is_valid.emails.app_error", nil, "", http.StatusBadRequest)
	}

	if len(i.ChannelIds) > 0 {
		for _, channel := range i.ChannelIds {
			if len(channel) != 26 {
				return NewAppError("MemberInvite.IsValid", "model.member.is_valid.channel.app_error", nil, "channel="+channel, http.StatusBadRequest)
			}
		}
	}

	for _, profile := range i.Profiles {
		if !slices.Contains(i.Emails, strings.ToLower(profile.Email)) {
			return NewAppError("MemberInvite.IsValid", "model.member.is_valid.profile_email.app_error", nil, "email="+profile.Email, http.StatusBadRequest)
		}

		if !IsValidUsername(strings.ToLower(profile.Username)) {
			return NewAppError("MemberInvite.IsValid", "model.member.is_valid.profile_username.app_error", nil, "username="+profile.Username, http.StatusBadRequest)
		}

		if utf8.RuneCountInString(profile.FirstName) > UserFirstNameMaxRunes {
			return NewAppError("MemberInvite.IsValid", "model.member.is_valid.profile_first_name.app_error", nil, "email="+profile.Email, http.StatusBadRequest)
		}

		if utf8.RuneCountInString(profile.LastName) > UserLastNameMaxRunes {
			return NewAppError("MemberInvite.IsValid", "model.member.is_valid.profile_last_name.app_error", nil, "email="+profile.Email, http.StatusBadRequest)
		}
	}

	return nil
}

func (i *MemberInvite) UnmarshalJSON(b []byte) error {
	var emails []string
	if err := json.Unmarshal(b, &emails); err == nil {
		*i = MemberInvite{}
		i.Emails = emails
		return nil
	}

	type TempMemberInvite MemberInvite
	var o2 TempMemberInvite
	if err := json.Unmarshal(b, &o2); err != nil {
		return err
	}
	*i = MemberInvite(o2)
	return nil
}
