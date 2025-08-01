// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAuthPreSave(t *testing.T) {
	a1 := AuthData{}
	a1.ClientId = NewId()
	a1.UserId = NewId()
	a1.Code = NewId()
	a1.PreSave()
	a1.IsExpired()
}

func TestAuthIsValid(t *testing.T) {
	ad := AuthData{}

	require.NotNil(t, ad.IsValid())

	ad.ClientId = NewRandomString(28)
	require.NotNil(t, ad.IsValid(), "Should have failed Client Id")

	ad.ClientId = NewId()
	require.NotNil(t, ad.IsValid())

	ad.UserId = NewRandomString(28)
	require.NotNil(t, ad.IsValid(), "Should have failed User Id")

	ad.UserId = NewId()
	require.NotNil(t, ad.IsValid())

	ad.Code = NewRandomString(129)
	require.NotNil(t, ad.IsValid(), "Should have failed Code to long")

	ad.Code = ""
	require.NotNil(t, ad.IsValid(), "Should have failed Code not set")

	ad.Code = NewId()
	require.NotNil(t, ad.IsValid())

	ad.ExpiresIn = 0
	require.NotNil(t, ad.IsValid(), "Should have failed invalid ExpiresIn")

	ad.ExpiresIn = 1
	require.NotNil(t, ad.IsValid())

	ad.CreateAt = 0
	require.NotNil(t, ad.IsValid(), "Should have failed Invalid Create At")

	ad.CreateAt = 1
	require.NotNil(t, ad.IsValid())

	ad.State = NewRandomString(129)
	require.NotNil(t, ad.IsValid(), "Should have failed invalid State")

	ad.State = NewRandomString(128)
	require.NotNil(t, ad.IsValid())

	ad.Scope = NewRandomString(1025)
	require.NotNil(t, ad.IsValid(), "Should have failed invalid Scope")

	ad.Scope = NewRandomString(128)
	require.NotNil(t, ad.IsValid())

	ad.RedirectUri = ""
	require.NotNil(t, ad.IsValid(), "Should have failed Redirect URI not set")

	ad.RedirectUri = NewRandomString(28)
	require.NotNil(t, ad.IsValid(), "Should have failed invalid URL")

	ad.RedirectUri = NewRandomString(257)
	require.NotNil(t, ad.IsValid(), "Should have failed invalid URL")

	ad.RedirectUri = "http://example.com"
	require.Nil(t, ad.IsValid())
}

func TestAuthData_VerifyPKCE_S256_ValidVerifier(t *testing.T) {
	// Test valid PKCE S256 verification
	codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	expectedChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	
	authData := &AuthData{
		CodeChallenge:       expectedChallenge,
		CodeChallengeMethod: PKCECodeChallengeMethodS256,
	}

	// Valid verifier should pass verification
	require.True(t, authData.VerifyPKCE(codeVerifier))
}

func TestAuthData_VerifyPKCE_S256_InvalidVerifier(t *testing.T) {
	// Test invalid PKCE S256 verification
	authData := &AuthData{
		CodeChallenge:       "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		CodeChallengeMethod: PKCECodeChallengeMethodS256,
	}

	// Wrong verifier should fail verification
	require.False(t, authData.VerifyPKCE("wrong_verifier"))

	// Empty verifier should fail verification
	require.False(t, authData.VerifyPKCE(""))

	// Verifier too short should fail verification
	require.False(t, authData.VerifyPKCE("short"))

	// Verifier too long should fail verification
	longVerifier := make([]byte, PKCECodeVerifierMaxLength+1)
	for i := range longVerifier {
		longVerifier[i] = 'a'
	}
	require.False(t, authData.VerifyPKCE(string(longVerifier)))

	// Verifier with invalid characters should fail verification
	require.False(t, authData.VerifyPKCE("invalid@characters#here!"))
}

func TestAuthData_VerifyPKCE_BackwardCompatibility(t *testing.T) {
	// Test backward compatibility - no PKCE challenge stored
	authData := &AuthData{
		// No CodeChallenge or CodeChallengeMethod set
	}

	// Should return true for backward compatibility when no PKCE is stored
	require.True(t, authData.VerifyPKCE("any_verifier"))
	require.True(t, authData.VerifyPKCE(""))
}

func TestAuthData_VerifyPKCE_UnsupportedMethod(t *testing.T) {
	// Test unsupported challenge method
	authData := &AuthData{
		CodeChallenge:       "some_challenge",
		CodeChallengeMethod: "plain", // Unsupported method
	}

	// Should fail verification for unsupported methods
	require.False(t, authData.VerifyPKCE("any_verifier"))
}

func TestValidatePKCEParameters_BothClientTypes(t *testing.T) {
	// Test PKCE parameter validation for both client types
	validChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	validMethod := PKCECodeChallengeMethodS256
	clientId := NewId()

	// Valid PKCE parameters should pass
	require.Nil(t, validatePKCEParameters(validChallenge, validMethod, clientId, "test"))

	// Empty challenge should fail
	require.NotNil(t, validatePKCEParameters("", validMethod, clientId, "test"))

	// Empty method should fail
	require.NotNil(t, validatePKCEParameters(validChallenge, "", clientId, "test"))

	// Invalid method should fail
	require.NotNil(t, validatePKCEParameters(validChallenge, "plain", clientId, "test"))

	// Challenge too short should fail
	require.NotNil(t, validatePKCEParameters("short", validMethod, clientId, "test"))

	// Challenge too long should fail
	longChallenge := make([]byte, PKCECodeChallengeMaxLength+1)
	for i := range longChallenge {
		longChallenge[i] = 'a'
	}
	require.NotNil(t, validatePKCEParameters(string(longChallenge), validMethod, clientId, "test"))
}

func TestAuthorizeRequest_PKCE_RequiredTogether(t *testing.T) {
	// Test that if one PKCE field is present, both must be present
	authRequest := &AuthorizeRequest{
		ResponseType: ResponseTypeCode,
		ClientId:     NewId(),
		RedirectURI:  "https://example.com/callback",
		State:        "test_state",
		Scope:        "user",
	}

	// Valid request without PKCE should pass
	require.Nil(t, authRequest.IsValid())

	// Request with only code_challenge should fail
	authRequest.CodeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	require.NotNil(t, authRequest.IsValid())

	// Request with both PKCE fields should pass
	authRequest.CodeChallengeMethod = PKCECodeChallengeMethodS256
	require.Nil(t, authRequest.IsValid())

	// Request with only code_challenge_method should fail
	authRequest.CodeChallenge = ""
	require.NotNil(t, authRequest.IsValid())
}

func TestAuthorizeRequest_PKCE_ValidationDetails(t *testing.T) {
	// Test detailed PKCE parameter validation in authorize request
	authRequest := &AuthorizeRequest{
		ResponseType:        ResponseTypeCode,
		ClientId:            NewId(),
		RedirectURI:         "https://example.com/callback",
		State:               "test_state",
		Scope:               "user",
		CodeChallenge:       "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		CodeChallengeMethod: PKCECodeChallengeMethodS256,
	}

	// Valid PKCE request should pass
	require.Nil(t, authRequest.IsValid())

	// Invalid challenge method should fail
	authRequest.CodeChallengeMethod = "plain"
	require.NotNil(t, authRequest.IsValid())

	// Reset to valid method
	authRequest.CodeChallengeMethod = PKCECodeChallengeMethodS256

	// Challenge too short should fail
	authRequest.CodeChallenge = "short"
	require.NotNil(t, authRequest.IsValid())

	// Challenge too long should fail
	longChallenge := make([]byte, PKCECodeChallengeMaxLength+1)
	for i := range longChallenge {
		longChallenge[i] = 'a'
	}
	authRequest.CodeChallenge = string(longChallenge)
	require.NotNil(t, authRequest.IsValid())
}
