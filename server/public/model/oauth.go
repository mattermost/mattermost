// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"slices"
	"unicode/utf8"
)

const (
	OAuthActionSignup     = "signup"
	OAuthActionLogin      = "login"
	OAuthActionEmailToSSO = "email_to_sso"
	OAuthActionSSOToEmail = "sso_to_email"
	OAuthActionMobile     = "mobile"
)

type OAuthApp struct {
	Id              string      `json:"id"`
	CreatorId       string      `json:"creator_id"`
	CreateAt        int64       `json:"create_at"`
	UpdateAt        int64       `json:"update_at"`
	ClientSecret    string      `json:"client_secret"`
	Name            string      `json:"name"`
	Description     string      `json:"description"`
	IconURL         string      `json:"icon_url"`
	CallbackUrls    StringArray `json:"callback_urls"`
	Homepage        string      `json:"homepage"`
	IsTrusted       bool        `json:"is_trusted"`
	MattermostAppID string      `json:"mattermost_app_id"`

	IsDynamicallyRegistered bool `json:"is_dynamically_registered,omitempty"`
}

// OAuthAppRequest represents the request body for creating an OAuth app
type OAuthAppRequest struct {
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	IconURL      string      `json:"icon_url"`
	CallbackUrls StringArray `json:"callback_urls"`
	Homepage     string      `json:"homepage"`
	IsTrusted    bool        `json:"is_trusted"`
	IsPublic     bool        `json:"is_public"`
}

func (a *OAuthApp) Auditable() map[string]any {
	return map[string]any{
		"id":                         a.Id,
		"creator_id":                 a.CreatorId,
		"create_at":                  a.CreateAt,
		"update_at":                  a.UpdateAt,
		"name":                       a.Name,
		"description":                a.Description,
		"icon_url":                   a.IconURL,
		"callback_urls:":             a.CallbackUrls,
		"homepage":                   a.Homepage,
		"is_trusted":                 a.IsTrusted,
		"mattermost_app_id":          a.MattermostAppID,
		"token_endpoint_auth_method": a.GetTokenEndpointAuthMethod(),
		"is_dynamically_registered":  a.IsDynamicallyRegistered,
	}
}

func (a *OAuthApp) IsValid() *AppError {
	if !IsValidId(a.Id) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.app_id.app_error", nil, "", http.StatusBadRequest)
	}

	if a.CreateAt == 0 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.create_at.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.UpdateAt == 0 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.update_at.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if !IsValidId(a.CreatorId) && !a.IsDynamicallyRegistered {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.creator_id.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	// Validate client secret length if present
	if a.ClientSecret != "" && len(a.ClientSecret) > 128 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.client_secret.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.Name == "" || len(a.Name) > 64 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.name.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if len(a.CallbackUrls) == 0 || len(fmt.Sprintf("%s", a.CallbackUrls)) > 1024 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.callback.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	for _, callback := range a.CallbackUrls {
		if !IsValidHTTPURL(callback) {
			return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.callback.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if a.Homepage == "" && !a.IsDynamicallyRegistered {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.homepage.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.Homepage != "" && (len(a.Homepage) > 256 || !IsValidHTTPURL(a.Homepage)) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.homepage.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(a.Description) > 512 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.description.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.IconURL != "" {
		if len(a.IconURL) > 512 || !IsValidHTTPURL(a.IconURL) {
			return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.icon_url.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
		}
	}

	if len(a.MattermostAppID) > 32 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.mattermost_app_id.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	return nil
}

// PreSave will set the Id and ClientSecret if missing.  It will also fill
// in the CreateAt, UpdateAt times. It should be run before saving the app to the db.
func (a *OAuthApp) PreSave() {
	if a.Id == "" {
		a.Id = NewId()
	}

	// PreSave no longer generates client secrets - callers must explicitly set ClientSecret
	// if they want to create a confidential client

	a.CreateAt = GetMillis()
	a.UpdateAt = a.CreateAt
}

// PreUpdate should be run before updating the app in the db.
func (a *OAuthApp) PreUpdate() {
	a.UpdateAt = GetMillis()
}

// Generate a valid strong etag so the browser can cache the results
func (a *OAuthApp) Etag() string {
	return Etag(a.Id, a.UpdateAt)
}

// Remove any private data from the app object
func (a *OAuthApp) Sanitize() {
	a.ClientSecret = ""
}

func (a *OAuthApp) IsValidRedirectURL(url string) bool {
	return slices.Contains(a.CallbackUrls, url)
}

// GetTokenEndpointAuthMethod returns the OAuth token endpoint authentication method
// based on whether the client has a secret
func (a *OAuthApp) GetTokenEndpointAuthMethod() string {
	if a.ClientSecret == "" {
		return ClientAuthMethodNone
	}
	return ClientAuthMethodClientSecretPost
}

// IsPublicClient returns true if this is a public client (uses "none" auth method)
func (a *OAuthApp) IsPublicClient() bool {
	return a.GetTokenEndpointAuthMethod() == ClientAuthMethodNone
}

// ValidateForGrantType validates the OAuth app for a specific grant type and provided credentials
func (a *OAuthApp) ValidateForGrantType(grantType, clientSecret, codeVerifier string) *AppError {
	if a.IsPublicClient() {
		return a.validatePublicClientGrant(grantType, clientSecret, codeVerifier)
	}
	return a.validateConfidentialClientGrant(grantType, clientSecret)
}

// validatePublicClientGrant validates that public client requests follow OAuth 2.1 security requirements
func (a *OAuthApp) validatePublicClientGrant(grantType, clientSecret, codeVerifier string) *AppError {
	// Public clients must not provide a client secret
	if clientSecret != "" {
		return NewAppError("OAuthApp.validatePublicClientGrant", "model.oauth.validate_grant.public_client_secret.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	// Public clients cannot use refresh token grant type
	if grantType == RefreshTokenGrantType {
		return NewAppError("OAuthApp.validatePublicClientGrant", "model.oauth.validate_grant.public_client_refresh_token.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	// Public clients must use PKCE for authorization code grant
	if grantType == AccessTokenGrantType && codeVerifier == "" {
		return NewAppError("OAuthApp.validatePublicClientGrant", "model.oauth.validate_grant.pkce_required.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	return nil
}

// validateConfidentialClientGrant validates confidential client authentication
func (a *OAuthApp) validateConfidentialClientGrant(grantType, clientSecret string) *AppError {
	// Confidential clients must provide correct client secret
	if subtle.ConstantTimeCompare([]byte(a.ClientSecret), []byte(clientSecret)) == 0 {
		return NewAppError("OAuthApp.validateConfidentialClientGrant", "model.oauth.validate_grant.credentials.app_error", nil, "app_id="+a.Id, http.StatusUnauthorized)
	}

	return nil
}

func NewOAuthAppFromClientRegistration(req *ClientRegistrationRequest, creatorId string) *OAuthApp {
	app := &OAuthApp{
		CreatorId:               creatorId,
		CallbackUrls:            req.RedirectURIs,
		IsDynamicallyRegistered: true,
	}

	if req.ClientName != nil {
		app.Name = *req.ClientName
	} else {
		app.Name = "Dynamically Registered Client"
	}

	// Generate client secret based on requested auth method, default to confidential client
	requestedAuthMethod := ClientAuthMethodClientSecretPost
	if req.TokenEndpointAuthMethod != nil {
		requestedAuthMethod = *req.TokenEndpointAuthMethod
	}

	if requestedAuthMethod != ClientAuthMethodNone {
		app.ClientSecret = NewId()
	}

	if req.ClientURI != nil {
		app.Homepage = *req.ClientURI
	}

	return app
}

func (a *OAuthApp) ToClientRegistrationResponse(siteURL string) *ClientRegistrationResponse {
	resp := &ClientRegistrationResponse{
		ClientID:                a.Id,
		RedirectURIs:            a.CallbackUrls,
		TokenEndpointAuthMethod: a.GetTokenEndpointAuthMethod(),
		GrantTypes:              GetDefaultGrantTypes(),
		ResponseTypes:           GetDefaultResponseTypes(),
		Scope:                   ScopeUser,
	}

	if !a.IsPublicClient() {
		resp.ClientSecret = &a.ClientSecret
	}

	if a.Name != "" {
		resp.ClientName = &a.Name
	}

	if a.Homepage != "" {
		resp.ClientURI = &a.Homepage
	}

	return resp
}
