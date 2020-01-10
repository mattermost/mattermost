// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

type GuestsInvite struct {
	Emails   []string `json:"emails"`
	Channels []string `json:"channels"`
	Message  string   `json:"message"`
}

// IsValid validates the user and returns an error if it isn't configured
// correctly.
func (i *GuestsInvite) IsValid() *AppError {
	if len(i.Emails) == 0 {
		return NewAppError("GuestsInvite.IsValid", "model.guest.is_valid.emails.app_error", nil, "", http.StatusBadRequest)
	}

	for _, email := range i.Emails {
		if len(email) > USER_EMAIL_MAX_LENGTH || len(email) == 0 || !IsValidEmail(email) {
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

// GuestsInviteFromJson will decode the input and return a GuestsInvite
func GuestsInviteFromJson(data io.Reader) *GuestsInvite {
	var i *GuestsInvite
	json.NewDecoder(data).Decode(&i)
	return i
}

func (i *GuestsInvite) ToJson() string {
	b, _ := json.Marshal(i)
	return string(b)
}
