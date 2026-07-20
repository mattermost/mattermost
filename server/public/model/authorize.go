// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/url"
	"regexp"
)

var (
	codeChallengeRegex = regexp.MustCompile("^[A-Za-z0-9_-]+$")
	codeVerifierRegex  = regexp.MustCompile(`^[A-Za-z0-9\-._~]+$`)
)

const (
	AuthCodeExpireTime          = 60 * 10 // 10 minutes
	AuthCodeResponseType        = "code"
	ImplicitResponseType        = "token"
	DefaultScope                = "user"
	PKCECodeChallengeMethodS256 = "S256"
	PKCECodeChallengeMinLength  = 43
	PKCECodeChallengeMaxLength  = 128
	PKCECodeVerifierMinLength   = 43
	PKCECodeVerifierMaxLength   = 128
)

type AuthData struct {
	ClientId            string `json:"client_id"`
	UserId              string `json:"user_id"`
	Code                string `json:"code"`
	ExpiresIn           int32  `json:"expires_in"`
	CreateAt            int64  `json:"create_at"`
	RedirectUri         string `json:"redirect_uri"`
	State               string `json:"state"`
	Scope               string `json:"scope"`
	CodeChallenge       string `json:"code_challenge,omitempty"`
	CodeChallengeMethod string `json:"code_challenge_method,omitempty"`
	Resource            string `json:"resource,omitempty"`
}

type AuthorizeRequest struct {
	ResponseType        string `json:"response_type"`
	ClientId            string `json:"client_id"`
	RedirectURI         string `json:"redirect_uri"`
	Scope               string `json:"scope"`
	State               string `json:"state"`
	CodeChallenge       string `json:"code_challenge,omitempty"`
	CodeChallengeMethod string `json:"code_challenge_method,omitempty"`
	Resource            string `json:"resource,omitempty"`
}

// IsValid validates the AuthData and returns an error if it isn't configured
// correctly.
func (ad *AuthData) IsValid() *AppError {
	if !IsValidId(ad.ClientId) {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.client_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(ad.UserId) {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if ad.Code == "" || len(ad.Code) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.auth_code.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if ad.ExpiresIn == 0 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.expires.app_error", nil, "", http.StatusBadRequest)
	}

	if ad.CreateAt <= 0 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.create_at.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if len(ad.RedirectUri) > 256 || !IsValidHTTPURL(ad.RedirectUri) {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.redirect_uri.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if len(ad.State) > 1024 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.state.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if len(ad.Scope) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.scope.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	// PKCE validation - if one PKCE field is present, both must be present and valid
	if ad.CodeChallenge != "" || ad.CodeChallengeMethod != "" {
		if err := ad.validatePKCE(); err != nil {
			return err
		}
	}

	// Resource validation per RFC 8707
	if ad.Resource != "" {
		if err := ValidateResourceParameter(ad.Resource, ad.ClientId, "AuthData.IsValid"); err != nil {
			return err
		}
	}

	return nil
}

// IsValid validates the AuthorizeRequest and returns an error if it isn't configured
// correctly.
func (ar *AuthorizeRequest) IsValid() *AppError {
	if !IsValidId(ar.ClientId) {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.client_id.app_error", nil, "", http.StatusBadRequest)
	}

	if ar.ResponseType == "" {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.response_type.app_error", nil, "", http.StatusBadRequest)
	}

	if ar.RedirectURI == "" || len(ar.RedirectURI) > 256 || !IsValidHTTPURL(ar.RedirectURI) {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.redirect_uri.app_error", nil, "client_id="+ar.ClientId, http.StatusBadRequest)
	}

	if len(ar.State) > 1024 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.state.app_error", nil, "client_id="+ar.ClientId, http.StatusBadRequest)
	}

	if len(ar.Scope) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.scope.app_error", nil, "client_id="+ar.ClientId, http.StatusBadRequest)
	}

	// PKCE validation - if one PKCE field is present, both must be present and valid
	if ar.CodeChallenge != "" || ar.CodeChallengeMethod != "" {
		if err := ar.validatePKCE(); err != nil {
			return err
		}
	}

	// Resource validation per RFC 8707
	if ar.Resource != "" {
		if err := ValidateResourceParameter(ar.Resource, ar.ClientId, "AuthorizeRequest.IsValid"); err != nil {
			return err
		}
	}

	return nil
}

func (ad *AuthData) PreSave() {
	if ad.ExpiresIn == 0 {
		ad.ExpiresIn = AuthCodeExpireTime
	}

	if ad.CreateAt == 0 {
		ad.CreateAt = GetMillis()
	}

	if ad.Scope == "" {
		ad.Scope = DefaultScope
	}
}

func (ad *AuthData) IsExpired() bool {
	return GetMillis() > ad.CreateAt+int64(ad.ExpiresIn*1000)
}

// validatePKCEParameters validates PKCE parameters (shared validation logic)
func validatePKCEParameters(codeChallenge, codeChallengeMethod, clientId, caller string) *AppError {
	if codeChallenge == "" {
		return NewAppError(caller, "model.authorize.is_valid.code_challenge.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	if codeChallengeMethod == "" {
		return NewAppError(caller, "model.authorize.is_valid.code_challenge_method.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	// Only support S256 method for security
	if codeChallengeMethod != PKCECodeChallengeMethodS256 {
		return NewAppError(caller, "model.authorize.is_valid.code_challenge_method.unsupported.app_error", nil, "client_id="+clientId+", method="+codeChallengeMethod, http.StatusBadRequest)
	}

	// Validate code challenge format (base64url encoded)
	if len(codeChallenge) < PKCECodeChallengeMinLength || len(codeChallenge) > PKCECodeChallengeMaxLength {
		return NewAppError(caller, "model.authorize.is_valid.code_challenge.length.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	// Validate base64url format (no padding, URL-safe characters)
	if !codeChallengeRegex.MatchString(codeChallenge) {
		return NewAppError(caller, "model.authorize.is_valid.code_challenge.format.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	return nil
}

// validatePKCE validates PKCE parameters for AuthData
func (ad *AuthData) validatePKCE() *AppError {
	return validatePKCEParameters(ad.CodeChallenge, ad.CodeChallengeMethod, ad.ClientId, "AuthData.validatePKCE")
}

// validatePKCE validates PKCE parameters for AuthorizeRequest
func (ar *AuthorizeRequest) validatePKCE() *AppError {
	return validatePKCEParameters(ar.CodeChallenge, ar.CodeChallengeMethod, ar.ClientId, "AuthorizeRequest.validatePKCE")
}

// VerifyPKCE verifies a PKCE code_verifier against the stored code_challenge
func (ad *AuthData) VerifyPKCE(codeVerifier string) bool {
	// Both empty = no PKCE was used (backward compatibility)
	if ad.CodeChallenge == "" && ad.CodeChallengeMethod == "" {
		return true
	}

	// Only one empty = invalid data state
	if ad.CodeChallenge == "" || ad.CodeChallengeMethod == "" {
		return false
	}

	// Validate code verifier length
	if len(codeVerifier) < PKCECodeVerifierMinLength || len(codeVerifier) > PKCECodeVerifierMaxLength {
		return false
	}

	// Validate code verifier format (unreserved characters from RFC 3986)
	if !codeVerifierRegex.MatchString(codeVerifier) {
		return false
	}

	// Only S256 method is supported
	if ad.CodeChallengeMethod != PKCECodeChallengeMethodS256 {
		return false
	}

	// Calculate S256 challenge: BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
	hash := sha256.Sum256([]byte(codeVerifier))
	calculatedChallenge := base64.RawURLEncoding.EncodeToString(hash[:])

	return calculatedChallenge == ad.CodeChallenge
}

// ValidatePKCEForClientType validates PKCE parameters based on OAuth client type and security requirements
func (ad *AuthData) ValidatePKCEForClientType(isPublicClient bool, codeVerifier string) *AppError {
	if isPublicClient {
		// RFC 7636: Public clients MUST use PKCE
		if ad.CodeChallenge == "" {
			return NewAppError("AuthData.ValidatePKCEForClientType", "model.authorize.validate_pkce.public_client_required.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
		}
		if codeVerifier == "" {
			return NewAppError("AuthData.ValidatePKCEForClientType", "model.authorize.validate_pkce.verifier_required.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
		}
		// Verify the code verifier matches the stored code challenge
		if !ad.VerifyPKCE(codeVerifier) {
			return NewAppError("AuthData.ValidatePKCEForClientType", "model.authorize.validate_pkce.verification_failed.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
		}
	} else {
		// Confidential clients: PKCE is optional but enforced if initiated
		if ad.CodeChallenge != "" {
			// Client started flow with PKCE - code_verifier is required
			if codeVerifier == "" {
				return NewAppError("AuthData.ValidatePKCEForClientType", "model.authorize.validate_pkce.verifier_required.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
			}
			// Verify the code verifier matches the stored code challenge
			if !ad.VerifyPKCE(codeVerifier) {
				return NewAppError("AuthData.ValidatePKCEForClientType", "model.authorize.validate_pkce.verification_failed.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
			}
		} else if codeVerifier != "" {
			// Client provided code_verifier but didn't use PKCE in authorization - reject
			return NewAppError("AuthData.ValidatePKCEForClientType", "model.authorize.validate_pkce.not_used_in_auth.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
		}
	}

	return nil
}

// ValidateResourceParameter validates a resource parameter per RFC 8707
func ValidateResourceParameter(resource, clientId, caller string) *AppError {
	// Empty resource parameter is allowed (no resource specified)
	if resource == "" {
		return nil
	}

	// Resource must not exceed 512 characters to fit in database column
	if len(resource) > 512 {
		return NewAppError(caller, "model.authorize.is_valid.resource.length.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	parsedURL, err := url.Parse(resource)
	if err != nil {
		return NewAppError(caller, "model.authorize.is_valid.resource.invalid_uri.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	// Must be absolute URI (has scheme)
	if !parsedURL.IsAbs() {
		return NewAppError(caller, "model.authorize.is_valid.resource.not_absolute.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	// Must not include a fragment component per RFC 8707
	if parsedURL.Fragment != "" {
		return NewAppError(caller, "model.authorize.is_valid.resource.has_fragment.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
	}

	return nil
}
