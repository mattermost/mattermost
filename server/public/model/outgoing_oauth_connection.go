// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"net/url"
	"unicode/utf8"
)

type OutgoingOAuthConnectionGrantType string

func (gt OutgoingOAuthConnectionGrantType) IsValid() bool {
	return gt == OutgoingOAuthConnectionGrantTypeClientCredentials || gt == OutgoingOAuthConnectionGrantTypePassword
}

const (
	OutgoingOAuthConnectionGrantTypeClientCredentials OutgoingOAuthConnectionGrantType = "client_credentials"
	OutgoingOAuthConnectionGrantTypePassword          OutgoingOAuthConnectionGrantType = "password"

	defaultGetConnectionsLimit = 50
)

type OutgoingOAuthConnection struct {
	Id                  string                           `json:"id"`
	CreatorId           string                           `json:"creator_id"`
	CreateAt            int64                            `json:"create_at"`
	UpdateAt            int64                            `json:"update_at"`
	Name                string                           `json:"name"`
	ClientId            string                           `json:"client_id,omitempty"`
	ClientSecret        string                           `json:"client_secret,omitempty"`
	CredentialsUsername *string                          `json:"credentials_username,omitempty"`
	CredentialsPassword *string                          `json:"credentials_password,omitempty"`
	OAuthTokenURL       string                           `json:"oauth_token_url"`
	GrantType           OutgoingOAuthConnectionGrantType `json:"grant_type"`
	Audiences           StringArray                      `json:"audiences"`
}

func (oa *OutgoingOAuthConnection) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":         oa.Id,
		"creator_id": oa.CreatorId,
		"create_at":  oa.CreateAt,
		"update_at":  oa.UpdateAt,
		"name":       oa.Name,
		"grant_type": oa.GrantType,
	}
}

// Sanitize removes any sensitive fields from the OutgoingOAuthConnection object.
func (oa *OutgoingOAuthConnection) Sanitize() {
	oa.ClientSecret = ""
	oa.CredentialsPassword = nil
}

// Patch updates the OutgoingOAuthConnection object with the non-empty fields from the given connection.
func (oa *OutgoingOAuthConnection) Patch(conn *OutgoingOAuthConnection) {
	if conn == nil {
		return
	}

	if conn.Name != "" {
		oa.Name = conn.Name
	}
	if conn.ClientId != "" {
		oa.ClientId = conn.ClientId
	}
	if conn.ClientSecret != "" {
		oa.ClientSecret = conn.ClientSecret
	}
	if conn.OAuthTokenURL != "" {
		oa.OAuthTokenURL = conn.OAuthTokenURL
	}
	if conn.GrantType != "" {
		oa.GrantType = conn.GrantType
	}
	if len(conn.Audiences) > 0 {
		oa.Audiences = conn.Audiences
	}
	if conn.CredentialsUsername != nil {
		oa.CredentialsUsername = conn.CredentialsUsername
	}
	if conn.CredentialsPassword != nil {
		oa.CredentialsPassword = conn.CredentialsPassword
	}
}

// IsValid validates the object and returns an error if it isn't properly configured
func (oa *OutgoingOAuthConnection) IsValid() *AppError {
	if !IsValidId(oa.Id) {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.id.error", nil, "", http.StatusBadRequest)
	}

	if oa.CreateAt == 0 {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.create_at.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.UpdateAt == 0 {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.update_at.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if !IsValidId(oa.CreatorId) {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.creator_id.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.Name == "" || utf8.RuneCountInString(oa.Name) > 64 {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.name.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.ClientId == "" || utf8.RuneCountInString(oa.ClientId) > 255 {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.client_id.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.ClientSecret == "" || utf8.RuneCountInString(oa.ClientSecret) > 255 {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.client_secret.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if !IsValidHTTPURL(oa.OAuthTokenURL) || utf8.RuneCountInString(oa.OAuthTokenURL) > 256 {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.oauth_token_url.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if err := oa.HasValidGrantType(); err != nil {
		return err
	}

	if len(oa.Audiences) == 0 {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.audience.empty", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if len(oa.Audiences) > 0 {
		for _, audience := range oa.Audiences {
			if !IsValidHTTPURL(audience) {
				return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.audience.error", map[string]any{"Url": audience}, "id="+oa.Id, http.StatusBadRequest)
			}
		}
	}

	return nil
}

// HasValidGrantType validates the grant type and its parameters returning an error if it isn't properly configured
func (oa *OutgoingOAuthConnection) HasValidGrantType() *AppError {
	if !oa.GrantType.IsValid() {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.grant_type.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.GrantType == OutgoingOAuthConnectionGrantTypePassword && (oa.CredentialsUsername == nil || oa.CredentialsPassword == nil) {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.password_credentials.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	if oa.GrantType == OutgoingOAuthConnectionGrantTypePassword && (*oa.CredentialsUsername == "" || *oa.CredentialsPassword == "") {
		return NewAppError("OutgoingOAuthConnection.IsValid", "model.outgoing_oauth_connection.is_valid.password_credentials.error", nil, "id="+oa.Id, http.StatusBadRequest)
	}

	return nil
}

// PreSave will set the Id if empty, ensuring the object has one and the create/update times.
func (oa *OutgoingOAuthConnection) PreSave() {
	if oa.Id == "" {
		oa.Id = NewId()
	}

	oa.CreateAt = GetMillis()
	oa.UpdateAt = oa.CreateAt
}

// PreUpdate will set the update time to now.
func (oa *OutgoingOAuthConnection) PreUpdate() {
	oa.UpdateAt = GetMillis()
}

// Etag returns the ETag for the cache.
func (oa *OutgoingOAuthConnection) Etag() string {
	return Etag(oa.Id, oa.UpdateAt)
}

// OutgoingOAuthConnectionGetConnectionsFilter is used to filter outgoing connections
type OutgoingOAuthConnectionGetConnectionsFilter struct {
	OffsetId string
	Limit    int
	Audience string

	// TeamId is not used as a filter but as a way to check if the current user has permission to
	// access the outgoing oauth connection for the given team in order to use them in the slash
	// commands and outgoing webhooks.
	TeamId string
}

// SetDefaults sets the default values for the filter
func (oaf *OutgoingOAuthConnectionGetConnectionsFilter) SetDefaults() {
	if oaf.Limit == 0 {
		oaf.Limit = defaultGetConnectionsLimit
	}
}

// ToURLValues converts the filter to url.Values
func (oaf *OutgoingOAuthConnectionGetConnectionsFilter) ToURLValues() url.Values {
	v := url.Values{}

	if oaf.Limit > 0 {
		v.Set("limit", fmt.Sprintf("%d", oaf.Limit))
	}

	if oaf.OffsetId != "" {
		v.Set("offset_id", oaf.OffsetId)
	}

	if oaf.Audience != "" {
		v.Set("audience", oaf.Audience)
	}

	if oaf.TeamId != "" {
		v.Set("team_id", oaf.TeamId)
	}
	return v
}

// OutgoingOAuthConnectionToken is used to return the token for an outgoing connection oauth
// authentication request
type OutgoingOAuthConnectionToken struct {
	AccessToken string
	TokenType   string
}

func (ooct *OutgoingOAuthConnectionToken) AsHeaderValue() string {
	return ooct.TokenType + " " + ooct.AccessToken
}
