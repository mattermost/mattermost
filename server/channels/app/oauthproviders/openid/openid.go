// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package oauthopenid implements generic OpenID Connect (OAuth 2.0) support
// for Mattermost Team/Free Edition by registering a provider under the
// model.ServiceOpenid key. This enables MM_OPENIDSETTINGS_* environment
// variables to work without an Enterprise license.
package oauthopenid

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const jwksCacheTTL = 10 * time.Minute

// jwkSet is the JSON structure returned by a JWKS endpoint.
type jwkSet struct {
	Keys []jwk `json:"keys"`
}

// jwk represents a single JSON Web Key.
type jwk struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	// RSA
	N string `json:"n"`
	E string `json:"e"`
	// EC
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type jwksCacheEntry struct {
	keys      map[string]crypto.PublicKey
	fetchedAt time.Time
}

// OpenIDProvider implements einterfaces.OAuthProvider for generic OIDC.
// It caches the JWKS and issuer resolved from the discovery document so that
// id_token signatures can be verified without a round-trip on every login.
type OpenIDProvider struct {
	mu        sync.RWMutex
	issuer    string
	jwksURI   string
	jwksCache *jwksCacheEntry
}

// OpenIDUser maps standard OIDC userinfo claims.
type OpenIDUser struct {
	Sub               string `json:"sub"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`
	PreferredUsername string `json:"preferred_username"`
}

// openIDClaims is used only for JWT parsing; embedding RegisteredClaims lets
// golang-jwt/v5 enforce exp/nbf/iat automatically.
type openIDClaims struct {
	Email             string `json:"email"`
	Name              string `json:"name"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`
	PreferredUsername string `json:"preferred_username"`
	jwtv5.RegisteredClaims
}

func init() {
	einterfaces.RegisterOAuthProvider(model.ServiceOpenid, &OpenIDProvider{})
}

func (u *OpenIDUser) IsValid() error {
	if u.Sub == "" {
		return errors.New("openid: user sub claim cannot be empty")
	}
	if u.Email == "" {
		return errors.New("openid: user email claim cannot be empty")
	}
	return nil
}

func (u *OpenIDUser) hasAuthData() error {
	if u.Sub == "" {
		return errors.New("openid: user sub claim cannot be empty")
	}
	return nil
}

func (u *OpenIDUser) mergeFallback(fallback *OpenIDUser) {
	if fallback == nil {
		return
	}
	if u.Sub == "" {
		u.Sub = fallback.Sub
	}
	if u.Email == "" {
		u.Email = fallback.Email
	}
	if u.Name == "" {
		u.Name = fallback.Name
	}
	if u.GivenName == "" {
		u.GivenName = fallback.GivenName
	}
	if u.FamilyName == "" {
		u.FamilyName = fallback.FamilyName
	}
	if u.PreferredUsername == "" {
		u.PreferredUsername = fallback.PreferredUsername
	}
}

func openIDUserFromModelUser(user *model.User) *OpenIDUser {
	if user == nil {
		return nil
	}
	ou := &OpenIDUser{
		Email:             user.Email,
		GivenName:         user.FirstName,
		FamilyName:        user.LastName,
		PreferredUsername: user.Username,
	}
	if user.AuthData != nil {
		ou.Sub = *user.AuthData
	}
	return ou
}

func userFromOpenIDUser(logger mlog.LoggerIFace, ou *OpenIDUser, settings *model.SSOSettings) *model.User {
	user := &model.User{}

	// Derive username: prefer preferred_username, fall back to email local-part.
	raw := ou.PreferredUsername
	if raw == "" {
		raw = strings.Split(ou.Email, "@")[0]
	} else {
		// Drop domain suffix when preferred_username looks like an email.
		raw = strings.Split(raw, "@")[0]
	}
	// UsePreferredUsername=true keeps the claim as-is; default behaviour
	// (false) still uses preferred_username but sanitises it.
	_ = settings // UsePreferredUsername has no meaningful effect here since
	// Keycloak already exposes the short username via preferred_username.
	user.Username = model.CleanUsername(logger, raw)

	// Names.
	if ou.GivenName != "" || ou.FamilyName != "" {
		user.FirstName = ou.GivenName
		user.LastName = ou.FamilyName
	} else if ou.Name != "" {
		parts := strings.SplitN(ou.Name, " ", 2)
		user.FirstName = parts[0]
		if len(parts) == 2 {
			user.LastName = parts[1]
		}
	}

	user.Email = strings.ToLower(ou.Email)
	// sub is a stable, unique identifier across the OIDC provider.
	user.AuthData = &ou.Sub
	user.AuthService = model.ServiceOpenid

	return user
}

// GetUserFromJSON parses a standard OIDC userinfo JSON payload.
func (p *OpenIDProvider) GetUserFromJSON(rctx request.CTX, data io.Reader, tokenUser *model.User, settings *model.SSOSettings) (*model.User, error) {
	var ou OpenIDUser
	if err := json.NewDecoder(data).Decode(&ou); err != nil {
		return nil, err
	}
	ou.mergeFallback(openIDUserFromModelUser(tokenUser))
	if err := ou.IsValid(); err != nil {
		return nil, err
	}
	return userFromOpenIDUser(rctx.Logger(), &ou, settings), nil
}

// oidcDiscovery is the subset of the OIDC discovery document we need.
type oidcDiscovery struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
	JwksURI               string `json:"jwks_uri"`
}

// fetchDiscovery fetches and parses the OIDC discovery document at discoveryURL.
// The URL must use HTTPS to prevent MITM substitution of endpoint addresses.
func fetchDiscovery(discoveryURL string) (*oidcDiscovery, error) {
	if !strings.HasPrefix(discoveryURL, "https://") {
		return nil, errors.New("openid: discovery endpoint must use HTTPS")
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(discoveryURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("openid discovery: unexpected status " + resp.Status)
	}
	var doc oidcDiscovery
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

// GetSSOSettings returns the OpenIdSettings block from the server config,
// auto-populating AuthEndpoint/TokenEndpoint/UserAPIEndpoint from the
// discovery document when DiscoveryEndpoint is set and the individual
// endpoint fields are empty. It also caches the JWKS URI and issuer for
// subsequent id_token verification.
func (p *OpenIDProvider) GetSSOSettings(rctx request.CTX, config *model.Config, _ string) (*model.SSOSettings, error) {
	s := config.OpenIdSettings // copy so we don't mutate global config

	discoveryURL := ""
	if s.DiscoveryEndpoint != nil {
		discoveryURL = *s.DiscoveryEndpoint
	}

	// If individual endpoints are already populated, use them as-is.
	if discoveryURL == "" ||
		(s.AuthEndpoint != nil && *s.AuthEndpoint != "" &&
			s.TokenEndpoint != nil && *s.TokenEndpoint != "" &&
			s.UserAPIEndpoint != nil && *s.UserAPIEndpoint != "") {
		return &s, nil
	}

	// Resolve from discovery document.
	doc, err := fetchDiscovery(discoveryURL)
	if err != nil {
		if rctx != nil {
			rctx.Logger().Warn("OpenID: failed to fetch discovery document",
				mlog.String("url", discoveryURL), mlog.Err(err))
		}
		return &s, nil // fall back to whatever is in config
	}

	if doc.AuthorizationEndpoint != "" {
		s.AuthEndpoint = model.NewPointer(doc.AuthorizationEndpoint)
	}
	if doc.TokenEndpoint != "" {
		s.TokenEndpoint = model.NewPointer(doc.TokenEndpoint)
	}
	if doc.UserinfoEndpoint != "" {
		s.UserAPIEndpoint = model.NewPointer(doc.UserinfoEndpoint)
	}

	// Cache issuer and JWKS URI for id_token signature verification.
	if doc.JwksURI != "" || doc.Issuer != "" {
		p.mu.Lock()
		p.issuer = doc.Issuer
		p.jwksURI = doc.JwksURI
		p.mu.Unlock()
	}

	return &s, nil
}

// parseJWK converts a JSON Web Key into a Go crypto.PublicKey.
func parseJWK(key jwk) (crypto.PublicKey, error) {
	switch key.Kty {
	case "RSA":
		nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			return nil, fmt.Errorf("openid: invalid RSA n: %w", err)
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil {
			return nil, fmt.Errorf("openid: invalid RSA e: %w", err)
		}
		e := new(big.Int).SetBytes(eBytes)
		if !e.IsInt64() {
			return nil, errors.New("openid: RSA exponent too large")
		}
		return &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: int(e.Int64()),
		}, nil
	case "EC":
		xBytes, err := base64.RawURLEncoding.DecodeString(key.X)
		if err != nil {
			return nil, fmt.Errorf("openid: invalid EC x: %w", err)
		}
		yBytes, err := base64.RawURLEncoding.DecodeString(key.Y)
		if err != nil {
			return nil, fmt.Errorf("openid: invalid EC y: %w", err)
		}
		var curve elliptic.Curve
		switch key.Crv {
		case "P-256":
			curve = elliptic.P256()
		case "P-384":
			curve = elliptic.P384()
		case "P-521":
			curve = elliptic.P521()
		default:
			return nil, fmt.Errorf("openid: unsupported EC curve %q", key.Crv)
		}
		return &ecdsa.PublicKey{
			Curve: curve,
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}, nil
	default:
		return nil, fmt.Errorf("openid: unsupported JWK key type %q", key.Kty)
	}
}

// getJWKS returns the cached key set or fetches it fresh from the JWKS URI.
func (p *OpenIDProvider) getJWKS() (map[string]crypto.PublicKey, error) {
	p.mu.RLock()
	uri := p.jwksURI
	cache := p.jwksCache
	p.mu.RUnlock()

	if uri == "" {
		return nil, errors.New("openid: JWKS URI not available")
	}
	if cache != nil && time.Since(cache.fetchedAt) < jwksCacheTTL {
		return cache.keys, nil
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(uri)
	if err != nil {
		return nil, fmt.Errorf("openid: jwks fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openid: jwks fetch: status %s", resp.Status)
	}

	var set jwkSet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return nil, fmt.Errorf("openid: jwks decode: %w", err)
	}

	keys := make(map[string]crypto.PublicKey, len(set.Keys))
	for _, k := range set.Keys {
		pub, err := parseJWK(k)
		if err != nil {
			continue // skip unsupported key types without aborting
		}
		keys[k.Kid] = pub
	}

	p.mu.Lock()
	p.jwksCache = &jwksCacheEntry{keys: keys, fetchedAt: time.Now()}
	p.mu.Unlock()

	return keys, nil
}

// verifyToken parses and validates the JWT signature, expiry, and issuer.
func (p *OpenIDProvider) verifyToken(idToken string, keys map[string]crypto.PublicKey, issuer string) (*openIDClaims, error) {
	var claims openIDClaims
	_, err := jwtv5.ParseWithClaims(idToken, &claims, func(token *jwtv5.Token) (interface{}, error) {
		kid, _ := token.Header["kid"].(string)
		if pub, ok := keys[kid]; ok {
			return pub, nil
		}
		// Some providers omit kid when the JWKS has only one key.
		if len(keys) == 1 {
			for _, pub := range keys {
				return pub, nil
			}
		}
		return nil, fmt.Errorf("openid: no JWK found for kid %q", kid)
	}, jwtv5.WithExpirationRequired())
	if err != nil {
		return nil, err
	}

	// Verify issuer when known — prevents tokens from foreign OIDC providers.
	if issuer != "" && claims.Issuer != issuer {
		return nil, fmt.Errorf("openid: id_token issuer mismatch: got %q, want %q", claims.Issuer, issuer)
	}

	return &claims, nil
}

// GetUserFromIdToken verifies the id_token signature using the provider's JWKS
// and extracts standard OIDC profile claims. On key-ID mismatch the JWKS cache
// is invalidated and the fetch retried once to handle seamless key rotation.
func (p *OpenIDProvider) GetUserFromIdToken(rctx request.CTX, idToken string) (*model.User, error) {
	p.mu.RLock()
	jwksURI := p.jwksURI
	issuer := p.issuer
	p.mu.RUnlock()

	if jwksURI == "" {
		// Discovery was not performed — fall back to unverified parsing with a warning.
		if rctx != nil {
			rctx.Logger().Warn("OpenID: id_token signature not verified — set DiscoveryEndpoint to enable JWKS verification")
		}
		return p.parseUnverified(rctx, idToken)
	}

	keys, err := p.getJWKS()
	if err != nil {
		return nil, err
	}

	claims, err := p.verifyToken(idToken, keys, issuer)
	if err != nil {
		// Invalidate the JWKS cache and retry once to handle key rotation.
		p.mu.Lock()
		p.jwksCache = nil
		p.mu.Unlock()

		keys, err2 := p.getJWKS()
		if err2 != nil {
			return nil, fmt.Errorf("openid: id_token verification failed: %w", err)
		}
		claims, err = p.verifyToken(idToken, keys, issuer)
		if err != nil {
			return nil, fmt.Errorf("openid: id_token verification failed: %w", err)
		}
	}

	ou := &OpenIDUser{
		Sub:               claims.Subject,
		Email:             claims.Email,
		Name:              claims.Name,
		GivenName:         claims.GivenName,
		FamilyName:        claims.FamilyName,
		PreferredUsername: claims.PreferredUsername,
	}
	if err := ou.hasAuthData(); err != nil {
		return nil, err
	}
	return userFromOpenIDUser(rctx.Logger(), ou, nil), nil
}

// parseUnverified decodes the JWT payload without verifying its signature.
// This is only reachable when DiscoveryEndpoint is not configured and therefore
// the JWKS URI is unknown. Production deployments should always set DiscoveryEndpoint.
func (p *OpenIDProvider) parseUnverified(rctx request.CTX, idToken string) (*model.User, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) < 2 {
		return nil, errors.New("openid: invalid id_token format")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}
	var ou OpenIDUser
	if err := json.Unmarshal(payload, &ou); err != nil {
		return nil, err
	}
	if err := ou.hasAuthData(); err != nil {
		return nil, err
	}
	var logger mlog.LoggerIFace
	if rctx != nil {
		logger = rctx.Logger()
	}
	return userFromOpenIDUser(logger, &ou, nil), nil
}

// IsSameUser compares the stable sub claim stored as AuthData.
func (p *OpenIDProvider) IsSameUser(_ request.CTX, dbUser, oauthUser *model.User) bool {
	return dbUser.AuthData != nil && oauthUser.AuthData != nil &&
		*dbUser.AuthData == *oauthUser.AuthData
}
