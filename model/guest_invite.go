// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

type GuestsInvite struct {
	Emails   []string `json:"emails"`
	Channels []string `json:"channels"`
	Message  string   `json:"message"`
}

type EmailInvite interface {
	GetChannels() []string
	SetChannels(channels []string)
}

func (i *GuestsInvite) GetChannels() []string {
	return i.Channels
}

func (i *GuestsInvite) SetChannels(channels []string) {
	i.Channels = channels
}

// IsValid validates the user and returns an error if it isn't configured
// correctly.
func (i *GuestsInvite) IsValid() *AppError {
	if len(i.Emails) == 0 {
		return NewAppError("GuestsInvite.IsValid", "model.guest.is_valid.emails.app_error", nil, "", http.StatusBadRequest)
	}

	for _, email := range i.Emails {
		if len(email) > UserEmailMaxLength || email == "" || !IsValidEmail(email) {
			return NewAppError("GuestsInvite.IsValid", "model.guest.is_valid.email.app_error", nil, "email="+email, http.StatusBadRequest)
		}
	}

	if len(i.Channels) == 0 {
		return NewAppError("GuestsInvite.IsValid", "model.guest.is_valid.channels.app_error", nil, "", http.StatusBadRequest)
	}

	for _, channel := range i.Channels {
		if len(channel) != 26 {
			return NewAppError("GuestsInvite.IsValid", "model.guest.is_valid.channel.app_error", nil, "channel="+channel, http.StatusBadRequest)
		}
	}
	return nil
}
