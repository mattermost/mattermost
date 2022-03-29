// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

type MemberInvite struct {
	Emails   []string `json:"emails"`
	Channels []string `json:"channels,omitempty"`
	Message  string   `json:"message"`
}

// IsValid validates that the invitation info is loaded correctly and with the correct structure
func (i *MemberInvite) IsValid() *AppError {
	if len(i.Emails) == 0 {
		return NewAppError("MemberInvite.IsValid", "model.member.is_valid.emails.app_error", nil, "", http.StatusBadRequest)
	}

	if len(i.Channels) > 0 {
		for _, channel := range i.Channels {
			if len(channel) != 26 {
				return NewAppError("MemberInvite.IsValid", "model.member.is_valid.channel.app_error", nil, "channel="+channel, http.StatusBadRequest)
			}
		}
	}

	return nil
}
