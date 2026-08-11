// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClientRegistrationRequestIsValid(t *testing.T) {
	t.Run("PublicClient_Valid", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: new(ClientAuthMethodNone),
			ClientName:              new("Test Public Client"),
		}

		require.Nil(t, req.IsValid())
	})

	t.Run("PublicClient_AuthMethodValidation", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: new(ClientAuthMethodNone),
			ClientName:              new("Test Public Client"),
		}

		require.Nil(t, req.IsValid())

		req.TokenEndpointAuthMethod = new("invalid_method")
		require.NotNil(t, req.IsValid())
	})

	t.Run("PublicClient_RedirectURIValidation", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			TokenEndpointAuthMethod: new(ClientAuthMethodNone),
			ClientName:              new("Test Public Client"),
		}

		require.NotNil(t, req.IsValid())

		req.RedirectURIs = []string{"https://example.com/callback"}
		require.Nil(t, req.IsValid())

		req.RedirectURIs = []string{"http://localhost:3000/callback"}
		require.Nil(t, req.IsValid())

		// Custom URI schemes used by desktop OAuth clients are accepted.
		req.RedirectURIs = []string{"cursor://anysphere.cursor-mcp/oauth/callback"}
		require.Nil(t, req.IsValid())

		req.RedirectURIs = []string{"invalid-uri"}
		require.NotNil(t, req.IsValid())

		// Opaque URIs without a host are rejected.
		req.RedirectURIs = []string{"javascript:alert(1)"}
		require.NotNil(t, req.IsValid())
	})
}

func TestNewOAuthAppFromClientRegistration(t *testing.T) {
	t.Run("PublicClient", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: new(ClientAuthMethodNone),
			ClientName:              new("Test Public Client"),
		}

		creatorId := NewId()
		app := NewOAuthAppFromClientRegistration(req, creatorId)

		require.Equal(t, creatorId, app.CreatorId)
		require.Equal(t, req.RedirectURIs, []string(app.CallbackUrls))
		require.Equal(t, *req.TokenEndpointAuthMethod, app.GetTokenEndpointAuthMethod())
		require.Equal(t, *req.ClientName, app.Name)
		require.True(t, app.IsDynamicallyRegistered)

		app.PreSave()
		require.Nil(t, app.IsValid())

		require.Empty(t, app.ClientSecret)
	})
}

func TestRedirectURIMatchesGlob(t *testing.T) {
	t.Run("direct match", func(t *testing.T) {
		require.True(t, RedirectURIMatchesGlob("https://example.com/cb", "https://example.com/cb"))
		require.False(t, RedirectURIMatchesGlob("https://example.com/cb", "https://example.com/cb2"))
		require.False(t, RedirectURIMatchesGlob("https://example.com/cb2", "https://example.com/cb"))
	})

	t.Run("full-string anchored", func(t *testing.T) {
		require.False(t, RedirectURIMatchesGlob("https://example.com/cb/evil", "https://example.com/cb"))
		require.False(t, RedirectURIMatchesGlob("https://evil.example.com/cb", "https://example.com/cb"))
	})

	t.Run("single star matches non-slash chars", func(t *testing.T) {
		require.True(t, RedirectURIMatchesGlob("https://example.com/cb", "https://example.com/*"))
		require.True(t, RedirectURIMatchesGlob("https://example.com/segment", "https://example.com/*"))
		require.False(t, RedirectURIMatchesGlob("https://example.com/a/b", "https://example.com/*"))
		require.True(t, RedirectURIMatchesGlob("https://example.com/", "https://example.com/*"))
	})

	t.Run("double star matches including slash", func(t *testing.T) {
		require.True(t, RedirectURIMatchesGlob("https://example.com/a/b/c", "https://example.com/**"))
		require.True(t, RedirectURIMatchesGlob("https://example.com/callback", "https://example.com/**"))
		require.True(t, RedirectURIMatchesGlob("https://example.com/", "https://example.com/**"))
		require.False(t, RedirectURIMatchesGlob("https://evil.example.com/", "https://example.com/**"))
	})

	t.Run("host wildcard", func(t *testing.T) {
		require.True(t, RedirectURIMatchesGlob("https://app.example.com/cb", "https://*.example.com/cb"))
		require.True(t, RedirectURIMatchesGlob("https://app.example.com/cb", "https://*.example.com/**"))
		require.True(t, RedirectURIMatchesGlob("https://foo.example.com/path", "https://*.example.com/*"))
		require.False(t, RedirectURIMatchesGlob("https://example.com.evil/cb", "https://*.example.com/cb"))
	})

	t.Run("wildcards do not cross URL component boundaries", func(t *testing.T) {
		require.False(t, RedirectURIMatchesGlob("https://attacker.example.net?x=.example.com/cb", "https://*.example.com/**"))
		require.False(t, RedirectURIMatchesGlob("https://app.example.com/callback?x=/admin", "https://app.example.com/callback/admin"))
	})

	t.Run("query string must be explicitly allowed", func(t *testing.T) {
		require.False(t, RedirectURIMatchesGlob("https://app.example.com/callback?tenant=foo", "https://app.example.com/callback"))
		require.True(t, RedirectURIMatchesGlob("https://app.example.com/callback?tenant=foo", "https://app.example.com/callback?tenant=*"))
	})

	t.Run("port wildcard", func(t *testing.T) {
		require.True(t, RedirectURIMatchesGlob("https://localhost:3000/cb", "https://localhost:*/cb"))
		require.False(t, RedirectURIMatchesGlob("https://localhost:3000/cb", "https://localhost:8080/cb"))
	})

	t.Run("custom scheme", func(t *testing.T) {
		require.True(t, RedirectURIMatchesGlob("cursor://anysphere.cursor-mcp/oauth/callback", "cursor://anysphere.cursor-mcp/oauth/callback"))
		require.True(t, RedirectURIMatchesGlob("cursor://anysphere.cursor-mcp/oauth/callback", "cursor://anysphere.cursor-mcp/**"))
		require.False(t, RedirectURIMatchesGlob("cursor://anysphere.cursor-mcp/oauth/callback", "cursor://other.app/**"))
		// Scheme must match exactly: an https candidate must not satisfy a cursor:// pattern.
		require.False(t, RedirectURIMatchesGlob("https://anysphere.cursor-mcp/oauth/callback", "cursor://anysphere.cursor-mcp/**"))
	})

	t.Run("multiple patterns one match suffices", func(t *testing.T) {
		allowlist := []string{"https://a.com/**", "https://b.com/**"}
		require.True(t, RedirectURIMatchesAllowlist("https://a.com/x", allowlist))
		require.True(t, RedirectURIMatchesAllowlist("https://b.com/y", allowlist))
		require.False(t, RedirectURIMatchesAllowlist("https://c.com/z", allowlist))
	})

	t.Run("empty allowlist permits all", func(t *testing.T) {
		require.True(t, RedirectURIMatchesAllowlist("https://any.com/cb", []string{}))
	})

	t.Run("one bad URI rejects request", func(t *testing.T) {
		allowlist := []string{"https://allowed.com/**"}
		uris := []string{"https://allowed.com/cb1", "https://disallowed.com/cb2"}
		allMatch := true
		for _, uri := range uris {
			if !RedirectURIMatchesAllowlist(uri, allowlist) {
				allMatch = false
				break
			}
		}
		require.False(t, allMatch)
	})
}

func TestIsValidDCRRedirectURI(t *testing.T) {
	valid := []string{
		"https://example.com/callback",
		"http://localhost:3000/cb",
		"cursor://anysphere.cursor-mcp/oauth/callback",
		"com.example.app://callback",
	}
	for _, uri := range valid {
		require.True(t, IsValidDCRRedirectURI(uri), "expected valid: %s", uri)
	}

	invalid := []string{
		"",
		"cursor://",           // custom scheme without a host
		"https://",            // http scheme without a host
		"javascript:alert(1)", // opaque URI, no host
		"data:text/html,hi",   // opaque URI, no host
		"/relative/path",      // not absolute
		"not a url",
	}
	for _, uri := range invalid {
		require.False(t, IsValidDCRRedirectURI(uri), "expected invalid: %s", uri)
	}
}

func TestIsValidDCRRedirectURIPattern(t *testing.T) {
	valid := []string{
		"https://example.com/**",
		"http://localhost:3000/cb",
		"http://localhost:*",
		"http://x",  // minimum valid http URL
		"https://x", // minimum valid https URL
		"cursor://anysphere.cursor-mcp/oauth/callback", // custom desktop-app scheme
		"cursor://app/callback",
		"com.example.app://callback/**",
		"cursor://*.example.com/**", // wildcards allowed with custom schemes
	}
	for _, p := range valid {
		require.True(t, IsValidDCRRedirectURIPattern(p), "expected valid: %s", p)
	}

	invalid := []string{
		"",
		"https://",                // missing host
		"cursor://",               // custom scheme missing host
		"://example.com",          // missing scheme
		"javascript:alert(1)",     // opaque URI, no host
		"https://example.com/***", // malformed wildcard run
	}
	for _, p := range invalid {
		require.False(t, IsValidDCRRedirectURIPattern(p), "expected invalid: %s", p)
	}
}
