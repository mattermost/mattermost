// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"unicode/utf8"
)

type GrantType string

const (
	GrantTypeClientCredentials GrantType = "client_credentials"
)

type OAuthOutgoingConnection struct {
	Id            string      `json:"id"`
	CreatorId     string      `json:"creator_id"`
	CreateAt      int64       `json:"create_at"`
	UpdateAt      int64       `json:"update_at"`
	Name          string      `json:"name"`
	ClientId      string      `json:"client_id"`
	ClientSecret  string      `json:"client_secret"`
	OAuthTokenURL string      `json:"oauth_token_url"`
	GrantType     GrantType   `json:"grant_type"`
	Audiences     StringArray `json:"audiences"`
}

func (oa *OAuthOutgoingConnection) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":         oa.Id,
		"creator_id": oa.CreatorId,
		"create_at":  oa.CreateAt,
		"update_at":  oa.UpdateAt,
		"name":       oa.Name,
		"grant_type": oa.GrantType,
	}
}

// IsValid validates the object and returns an error if it isn't properly configured
func (oa *OAuthOutgoingConnection) IsValid() *AppError {
	if !IsValidId(oa.Id) {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.id.error", nil, "", http.StatusBadRequest)
	}

	if oa.CreateAt == 0 {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.create_at.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.UpdateAt == 0 {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.update_at.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if !IsValidId(oa.CreatorId) {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.creator_id.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(oa.Name) > 64 {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.name.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if len(oa.ClientId) == 0 || utf8.RuneCountInString(oa.ClientId) > 255 {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.client_id.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if len(oa.ClientSecret) == 0 || utf8.RuneCountInString(oa.ClientSecret) > 255 {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.client_secret.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if len(oa.OAuthTokenURL) == 0 || utf8.RuneCountInString(oa.OAuthTokenURL) > 256 {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.oauth_token_url.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.GrantType != GrantTypeClientCredentials {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.grant_type.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if len(oa.Audiences) == 0 {
		return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.audience.empty", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if len(oa.Audiences) > 0 {
		for _, audience := range oa.Audiences {
			if !IsValidHTTPURL(audience) {
				return NewAppError("OAuthOutgoingConnection.IsValid", "model.oauth_outgoing_connection.is_valid.audience.error", nil, "id="+oa.Id, http.StatusBadRequest)
			}
		}
	}

	return nil
}

// PreSave will set the Id if empty, ensuring the object has one and the create/update times.
func (oa *OAuthOutgoingConnection) PreSave() {
	if oa.Id == "" {
		oa.Id = NewId()
	}

	oa.CreateAt = GetMillis()
	oa.UpdateAt = oa.CreateAt
}

// PreUpdate will set the update time to now.
func (oa *OAuthOutgoingConnection) PreUpdate() {
	oa.UpdateAt = GetMillis()
}

// Etag returns the ETag for the cache.
func (oa *OAuthOutgoingConnection) Etag() string {
	return Etag(oa.Id, oa.UpdateAt)
}

// Sanitize removes any sensitive fields from the OAuthOutgoingConnection object.
func (oa *OAuthOutgoingConnection) Sanitize() {
	oa.ClientId = ""
	oa.ClientSecret = ""
}
