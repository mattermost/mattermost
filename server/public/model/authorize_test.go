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

func TestAuthDataVerifyPKCE(t *testing.T) {
	t.Run("S256_ValidVerifier", func(t *testing.T) {
		codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
		expectedChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

		authData := &AuthData{
			CodeChallenge:       expectedChallenge,
			CodeChallengeMethod: PKCECodeChallengeMethodS256,
		}

		require.True(t, authData.VerifyPKCE(codeVerifier))
	})

	t.Run("S256_InvalidVerifier", func(t *testing.T) {
		authData := &AuthData{
			CodeChallenge:       "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
			CodeChallengeMethod: PKCECodeChallengeMethodS256,
		}

		require.False(t, authData.VerifyPKCE("wrong_verifier"))
		require.False(t, authData.VerifyPKCE(""))
		require.False(t, authData.VerifyPKCE("short"))

		longVerifier := make([]byte, PKCECodeVerifierMaxLength+1)
		for i := range longVerifier {
			longVerifier[i] = 'a'
		}
		require.False(t, authData.VerifyPKCE(string(longVerifier)))

		require.False(t, authData.VerifyPKCE("invalid@characters#here!"))
	})

	t.Run("BackwardCompatibility", func(t *testing.T) {
		authData := &AuthData{}

		require.True(t, authData.VerifyPKCE("any_verifier"))
		require.True(t, authData.VerifyPKCE(""))
	})

	t.Run("UnsupportedMethod", func(t *testing.T) {
		authData := &AuthData{
			CodeChallenge:       "some_challenge",
			CodeChallengeMethod: "plain",
		}

		require.False(t, authData.VerifyPKCE("any_verifier"))
	})
}

func TestValidatePKCEParameters(t *testing.T) {
	validChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	validMethod := PKCECodeChallengeMethodS256
	clientId := NewId()

	t.Run("ValidParameters", func(t *testing.T) {
		require.Nil(t, validatePKCEParameters(validChallenge, validMethod, clientId, "test"))
	})

	t.Run("EmptyChallenge", func(t *testing.T) {
		require.NotNil(t, validatePKCEParameters("", validMethod, clientId, "test"))
	})

	t.Run("EmptyMethod", func(t *testing.T) {
		require.NotNil(t, validatePKCEParameters(validChallenge, "", clientId, "test"))
	})

	t.Run("InvalidMethod", func(t *testing.T) {
		require.NotNil(t, validatePKCEParameters(validChallenge, "plain", clientId, "test"))
	})

	t.Run("ChallengeTooShort", func(t *testing.T) {
		require.NotNil(t, validatePKCEParameters("short", validMethod, clientId, "test"))
	})

	t.Run("ChallengeTooLong", func(t *testing.T) {
		longChallenge := make([]byte, PKCECodeChallengeMaxLength+1)
		for i := range longChallenge {
			longChallenge[i] = 'a'
		}
		require.NotNil(t, validatePKCEParameters(string(longChallenge), validMethod, clientId, "test"))
	})
}

func TestAuthorizeRequestPKCE(t *testing.T) {
	t.Run("RequiredTogether", func(t *testing.T) {
		authRequest := &AuthorizeRequest{
			ResponseType: ResponseTypeCode,
			ClientId:     NewId(),
			RedirectURI:  "https://example.com/callback",
			State:        "test_state",
			Scope:        "user",
		}

		require.Nil(t, authRequest.IsValid())

		authRequest.CodeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
		require.NotNil(t, authRequest.IsValid())

		authRequest.CodeChallengeMethod = PKCECodeChallengeMethodS256
		require.Nil(t, authRequest.IsValid())

		authRequest.CodeChallenge = ""
		require.NotNil(t, authRequest.IsValid())
	})

	t.Run("ValidationDetails", func(t *testing.T) {
		authRequest := &AuthorizeRequest{
			ResponseType:        ResponseTypeCode,
			ClientId:            NewId(),
			RedirectURI:         "https://example.com/callback",
			State:               "test_state",
			Scope:               "user",
			CodeChallenge:       "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
			CodeChallengeMethod: PKCECodeChallengeMethodS256,
		}

		require.Nil(t, authRequest.IsValid())

		authRequest.CodeChallengeMethod = "plain"
		require.NotNil(t, authRequest.IsValid())

		authRequest.CodeChallengeMethod = PKCECodeChallengeMethodS256

		authRequest.CodeChallenge = "short"
		require.NotNil(t, authRequest.IsValid())

		longChallenge := make([]byte, PKCECodeChallengeMaxLength+1)
		for i := range longChallenge {
			longChallenge[i] = 'a'
		}
		authRequest.CodeChallenge = string(longChallenge)
		require.NotNil(t, authRequest.IsValid())
	})
}
