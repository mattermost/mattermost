// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"net/url"
	"strings"
)

type ClientRegistrationRequest struct {
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod *string  `json:"token_endpoint_auth_method,omitempty"`
	ClientName              *string  `json:"client_name,omitempty"`
	ClientURI               *string  `json:"client_uri,omitempty"`
}

type ClientRegistrationResponse struct {
	ClientID                string   `json:"client_id"`
	ClientSecret            *string  `json:"client_secret,omitempty"`
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	Scope                   string   `json:"scope,omitempty"`
	ClientName              *string  `json:"client_name,omitempty"`
	ClientURI               *string  `json:"client_uri,omitempty"`
}

const (
	DCRErrorInvalidRedirectURI    = "invalid_redirect_uri"
	DCRErrorInvalidClientMetadata = "invalid_client_metadata"
	DCRErrorUnsupportedOperation  = "unsupported_operation"
)

type DCRError struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description,omitempty"`
}

type dcrRedirectURIPattern struct {
	scheme   string
	host     string
	path     string
	rawQuery string
}

func (r *ClientRegistrationRequest) IsValid() *AppError {
	if len(r.RedirectURIs) == 0 {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.redirect_uris.app_error", nil, "", http.StatusBadRequest)
	}

	for _, uri := range r.RedirectURIs {
		if !IsValidHTTPURL(uri) {
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.redirect_uri_format.app_error", nil, "uri="+uri, http.StatusBadRequest)
		}
	}

	if r.ClientName != nil && len(*r.ClientName) > 64 {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.client_name.app_error", nil, "", http.StatusBadRequest)
	}

	if r.ClientURI != nil {
		if !IsValidHTTPURL(*r.ClientURI) {
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.client_uri_format.app_error", nil, "uri="+*r.ClientURI, http.StatusBadRequest)
		}
		if len(*r.ClientURI) > 256 {
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.client_uri_length.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if r.TokenEndpointAuthMethod != nil && *r.TokenEndpointAuthMethod != ClientAuthMethodClientSecretPost && *r.TokenEndpointAuthMethod != ClientAuthMethodNone {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.unsupported_auth_method.app_error", nil, "method="+*r.TokenEndpointAuthMethod, http.StatusBadRequest)
	}

	return nil
}

func NewDCRError(errorType, description string) *DCRError {
	return &DCRError{
		Error:            errorType,
		ErrorDescription: description,
	}
}

func GetDefaultGrantTypes() []string {
	return []string{GrantTypeAuthorizationCode, GrantTypeRefreshToken}
}

func GetDefaultResponseTypes() []string {
	return []string{ResponseTypeCode}
}

// IsValidDCRRedirectURIPattern validates a DCR redirect URI allowlist pattern.
// Patterns must start with http:// or https:// and be well-formed for glob matching.
func IsValidDCRRedirectURIPattern(pattern string) bool {
	if strings.HasPrefix(pattern, "https://") {
		if len(pattern) < 9 { // minimum "https://x"
			return false
		}
	} else if strings.HasPrefix(pattern, "http://") {
		if len(pattern) < 8 { // minimum "http://x"
			return false
		}
	} else {
		return false
	}
	// Reject control characters and other invalid chars
	for _, r := range pattern {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	// Reject malformed wildcard runs. Supported tokens are "*" and "**".
	if strings.Contains(pattern, "***") {
		return false
	}

	// Replace wildcard tokens with concrete placeholders so URL parsing can validate
	// overall shape (scheme, host, and URI formatting).
	normalized := strings.ReplaceAll(pattern, "**", "mmdoublewildcard")
	normalized = strings.ReplaceAll(normalized, "*", "mmsinglewildcard")
	// Use a numeric placeholder so wildcarded port values (e.g. localhost:*)
	// normalize to a URI shape accepted by URL parsing (localhost:1).
	normalized = strings.ReplaceAll(normalized, "mmdoublewildcard", "1")
	normalized = strings.ReplaceAll(normalized, "mmsinglewildcard", "1")

	return IsValidHTTPURL(normalized)
}

// RedirectURIMatchesGlob returns true if uri matches the glob pattern.
// Matching is URL-component aware, so host, path, and query wildcards cannot
// satisfy requirements from another component.
func RedirectURIMatchesGlob(uri, pattern string) bool {
	candidate, err := url.ParseRequestURI(uri)
	if err != nil || candidate.Scheme == "" || candidate.Host == "" {
		return false
	}

	if !IsValidDCRRedirectURIPattern(pattern) {
		return false
	}

	parsedPattern, ok := parseDCRRedirectURIPattern(pattern)
	if !ok {
		return false
	}

	if candidate.Scheme != parsedPattern.scheme {
		return false
	}
	if !redirectURIMatchesGlobRecur(candidate.Host, parsedPattern.host, 0, 0) {
		return false
	}
	if !redirectURIMatchesGlobRecur(candidate.EscapedPath(), parsedPattern.path, 0, 0) {
		return false
	}
	if parsedPattern.rawQuery == "" {
		return candidate.RawQuery == ""
	}
	if candidate.RawQuery == "" {
		return false
	}
	return redirectURIMatchesGlobRecur(candidate.RawQuery, parsedPattern.rawQuery, 0, 0)
}

func parseDCRRedirectURIPattern(pattern string) (dcrRedirectURIPattern, bool) {
	scheme, rest, ok := strings.Cut(pattern, "://")
	if !ok {
		return dcrRedirectURIPattern{}, false
	}

	hostEnd := len(rest)
	for _, separator := range []string{"/", "?"} {
		if i := strings.Index(rest, separator); i >= 0 && i < hostEnd {
			hostEnd = i
		}
	}

	host := rest[:hostEnd]
	if host == "" {
		return dcrRedirectURIPattern{}, false
	}

	remainder := rest[hostEnd:]
	path := ""
	rawQuery := ""
	if strings.HasPrefix(remainder, "/") {
		path, rawQuery, _ = strings.Cut(remainder, "?")
	} else if strings.HasPrefix(remainder, "?") {
		rawQuery = remainder[1:]
	}

	return dcrRedirectURIPattern{
		scheme:   scheme,
		host:     host,
		path:     path,
		rawQuery: rawQuery,
	}, true
}

func redirectURIMatchesGlobRecur(uri, pattern string, ui, pi int) bool {
	for pi < len(pattern) {
		if pattern[pi] == '*' {
			if pi+1 < len(pattern) && pattern[pi+1] == '*' {
				// ** matches any chars including /
				pi += 2
				if pi >= len(pattern) {
					return true
				}
				for ui <= len(uri) {
					if redirectURIMatchesGlobRecur(uri, pattern, ui, pi) {
						return true
					}
					ui++
				}
				return false
			}
			// * matches zero or more chars except /
			if redirectURIMatchesGlobRecur(uri, pattern, ui, pi+1) {
				return true
			}
			for ui < len(uri) && uri[ui] != '/' {
				ui++
				if redirectURIMatchesGlobRecur(uri, pattern, ui, pi+1) {
					return true
				}
			}
			return false
		}
		if ui >= len(uri) || uri[ui] != pattern[pi] {
			return false
		}
		ui++
		pi++
	}
	return ui == len(uri)
}

// RedirectURIMatchesAllowlist returns true if uri matches at least one pattern in allowlist.
// If allowlist is empty, returns true (no restriction).
func RedirectURIMatchesAllowlist(uri string, allowlist []string) bool {
	if len(allowlist) == 0 {
		return true
	}
	for _, p := range allowlist {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" && RedirectURIMatchesGlob(uri, trimmed) {
			return true
		}
	}
	return false
}
