// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
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

	// DCR (Dynamic Client Registration) fields
	GrantTypes              StringArray `json:"grant_types,omitempty"`
	ResponseTypes           StringArray `json:"response_types,omitempty"`
	TokenEndpointAuthMethod *string     `json:"token_endpoint_auth_method,omitempty"`
	ClientURI               *string     `json:"client_uri,omitempty"`
	LogoURI                 *string     `json:"logo_uri,omitempty"`
	Scope                   *string     `json:"scope,omitempty"`

	// DCR management fields
	ClientIDIssuedAt        int64 `json:"client_id_issued_at,omitempty"`
	IsDynamicallyRegistered bool  `json:"is_dynamically_registered,omitempty"`
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
		"grant_types":                a.GrantTypes,
		"response_types":             a.ResponseTypes,
		"token_endpoint_auth_method": a.TokenEndpointAuthMethod,
		"client_uri":                 a.ClientURI,
		"logo_uri":                   a.LogoURI,
		"scope":                      a.Scope,
		"is_dynamically_registered":  a.IsDynamicallyRegistered,
	}
}

// IsValid validates the app and returns an error if it isn't configured
// correctly.
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

	if !IsValidId(a.CreatorId) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.creator_id.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.ClientSecret == "" || len(a.ClientSecret) > 128 {
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

	// Homepage is required for traditional OAuth apps, but optional for DCR apps
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

	// DCR field validation - we only support client_secret_post
	if a.TokenEndpointAuthMethod != nil {
		switch *a.TokenEndpointAuthMethod {
		case ClientAuthMethodClientSecretPost:
			// Valid - this is the only method we support
		default:
			return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.token_endpoint_auth_method.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
		}
	}

	// Validate DCR URIs
	if a.ClientURI != nil && *a.ClientURI != "" && !IsValidHTTPURL(*a.ClientURI) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.client_uri.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.LogoURI != nil && *a.LogoURI != "" && !IsValidHTTPURL(*a.LogoURI) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.logo_uri.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	// Validate grant types and response types compatibility
	if len(a.GrantTypes) > 0 && len(a.ResponseTypes) > 0 {
		if err := ValidateGrantTypesAndResponseTypes(a.GrantTypes, a.ResponseTypes); err != nil {
			return err
		}
	}

	return nil
}

// PreSave will set the Id and ClientSecret if missing.  It will also fill
// in the CreateAt, UpdateAt times. It should be run before saving the app to the db.
func (a *OAuthApp) PreSave() {
	if a.Id == "" {
		a.Id = NewId()
	}

	if a.ClientSecret == "" {
		a.ClientSecret = NewId()
	}

	// Set DCR defaults if not specified
	if len(a.GrantTypes) == 0 {
		a.GrantTypes = GetDefaultGrantTypes()
	}

	if len(a.ResponseTypes) == 0 {
		a.ResponseTypes = GetDefaultResponseTypes()
	}

	if a.TokenEndpointAuthMethod == nil {
		a.TokenEndpointAuthMethod = NewPointer(ClientAuthMethodClientSecretPost)
	}

	// Set timestamps for DCR
	if a.ClientIDIssuedAt == 0 {
		a.ClientIDIssuedAt = GetMillis()
	}

	// Set registration access token for dynamically registered clients

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
	for _, u := range a.CallbackUrls {
		if u == url {
			return true
		}
	}

	return false
}

// NewOAuthAppFromClientRegistration creates a new OAuthApp from a ClientRegistrationRequest
func NewOAuthAppFromClientRegistration(req *ClientRegistrationRequest, creatorId string) *OAuthApp {
	app := &OAuthApp{
		CreatorId:               creatorId,
		CallbackUrls:            req.RedirectURIs,
		IsDynamicallyRegistered: true,
	}

	// Set basic metadata
	if req.ClientName != nil {
		app.Name = *req.ClientName
	} else {
		app.Name = "Dynamically Registered Client"
	}

	if req.ClientURI != nil {
		app.ClientURI = req.ClientURI
		app.Homepage = *req.ClientURI // Use client_uri as homepage for compatibility
	}
	// Note: Homepage is optional for DCR apps per RFC 7591

	// Set DCR-specific fields
	if req.TokenEndpointAuthMethod != nil {
		app.TokenEndpointAuthMethod = req.TokenEndpointAuthMethod
	}

	if len(req.GrantTypes) > 0 {
		app.GrantTypes = req.GrantTypes
	}

	if len(req.ResponseTypes) > 0 {
		app.ResponseTypes = req.ResponseTypes
	}

	if req.LogoURI != nil {
		app.LogoURI = req.LogoURI
		app.IconURL = *req.LogoURI // Use logo_uri as icon_url for compatibility
	}

	if req.Scope != nil {
		app.Scope = req.Scope
	}

	return app
}

// ToClientRegistrationResponse converts an OAuthApp to a ClientRegistrationResponse
func (a *OAuthApp) ToClientRegistrationResponse(siteURL string) *ClientRegistrationResponse {
	authMethod := ClientAuthMethodClientSecretPost // default
	if a.TokenEndpointAuthMethod != nil {
		authMethod = *a.TokenEndpointAuthMethod
	}
	resp := &ClientRegistrationResponse{
		ClientID:                a.Id,
		ClientIDIssuedAt:        a.ClientIDIssuedAt,
		RedirectURIs:            a.CallbackUrls,
		TokenEndpointAuthMethod: authMethod,
		GrantTypes:              a.GrantTypes,
		ResponseTypes:           a.ResponseTypes,
	}

	// Include client secret for confidential clients
	if a.TokenEndpointAuthMethod != nil && *a.TokenEndpointAuthMethod != ClientAuthMethodNone {
		resp.ClientSecret = &a.ClientSecret
	}

	// Set optional metadata
	if a.Name != "" {
		resp.ClientName = &a.Name
	}

	if a.ClientURI != nil && *a.ClientURI != "" {
		resp.ClientURI = a.ClientURI
	}

	if a.LogoURI != nil && *a.LogoURI != "" {
		resp.LogoURI = a.LogoURI
	}

	if a.Scope != nil && *a.Scope != "" {
		resp.Scope = a.Scope
	}

	return resp
}
