// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/sha256"
	"encoding/base64"
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

func TestValidateResourceParameter(t *testing.T) {
	clientId := NewId()
	caller := "TestValidateResourceParameter"

	t.Run("Valid resource URIs should pass", func(t *testing.T) {
		validResources := []string{
			"https://api.example.com",
			"https://api.example.com/resource",
			"https://api.example.com:8080/resource",
			"http://localhost:3000/api",
			"https://sub.domain.example.com/path",
			"https://example.com/api/v1/resource?param=value",
		}

		for _, resource := range validResources {
			require.Nil(t, ValidateResourceParameter(resource, clientId, caller),
				"Expected valid resource '%s' to pass validation", resource)
		}
	})

	t.Run("Invalid resource URIs should fail", func(t *testing.T) {
		invalidResources := []string{
			"not-a-uri",                         // Not a URI
			"relative/path",                     // Relative URI
			"/absolute/path",                    // Absolute path but not URI
			"https://example.com/path#fragment", // Contains fragment
			"malformed://[invalid",              // Malformed URI
		}

		for _, resource := range invalidResources {
			require.NotNil(t, ValidateResourceParameter(resource, clientId, caller),
				"Expected invalid resource '%s' to fail validation", resource)
		}
	})

	t.Run("Empty resource should pass", func(t *testing.T) {
		// Empty resource parameter should be allowed (means no resource specified)
		require.Nil(t, ValidateResourceParameter("", clientId, caller),
			"Expected empty resource to pass validation")
	})

	t.Run("Resource URI too long should fail", func(t *testing.T) {
		// Create a resource URI longer than 512 characters
		longPath := make([]byte, 500) // Base path will push us over 512
		for i := range longPath {
			longPath[i] = 'a'
		}
		longResource := "https://example.com/" + string(longPath)

		require.NotNil(t, ValidateResourceParameter(longResource, clientId, caller),
			"Expected resource URI longer than 512 characters to fail validation")
	})

	t.Run("Fragment in URI should fail", func(t *testing.T) {
		resourceWithFragment := "https://example.com/api#section1"
		require.NotNil(t, ValidateResourceParameter(resourceWithFragment, clientId, caller),
			"Expected resource URI with fragment to fail validation")
	})

	t.Run("Query parameters are allowed", func(t *testing.T) {
		resourceWithQuery := "https://example.com/api?param1=value1&param2=value2"
		require.Nil(t, ValidateResourceParameter(resourceWithQuery, clientId, caller),
			"Expected resource URI with query parameters to pass validation")
	})

	t.Run("Different schemes should pass if valid", func(t *testing.T) {
		validSchemes := []string{
			"https://example.com/api",
			"http://example.com/api",
		}

		for _, resource := range validSchemes {
			require.Nil(t, ValidateResourceParameter(resource, clientId, caller),
				"Expected resource with scheme '%s' to pass validation", resource)
		}
	})
}

func TestAuthData_ResourceValidation(t *testing.T) {
	authData := &AuthData{
		ClientId:    NewId(),
		UserId:      NewId(),
		Code:        NewId(),
		ExpiresIn:   300,
		CreateAt:    GetMillis(),
		RedirectUri: "https://example.com/callback",
		State:       "test_state",
		Scope:       "user",
	}

	t.Run("Valid AuthData without resource should pass", func(t *testing.T) {
		require.Nil(t, authData.IsValid())
	})

	t.Run("Valid AuthData with valid resource should pass", func(t *testing.T) {
		authData.Resource = "https://api.example.com"
		require.Nil(t, authData.IsValid())
	})

	t.Run("AuthData with invalid resource should fail", func(t *testing.T) {
		authData.Resource = "invalid-uri"
		require.NotNil(t, authData.IsValid())
	})

	t.Run("AuthData with resource containing fragment should fail", func(t *testing.T) {
		authData.Resource = "https://api.example.com#fragment"
		require.NotNil(t, authData.IsValid())
	})

	t.Run("AuthData with empty resource should pass", func(t *testing.T) {
		authData.Resource = ""
		require.Nil(t, authData.IsValid())
	})
}

func TestAuthorizeRequest_ResourceValidation(t *testing.T) {
	authRequest := &AuthorizeRequest{
		ResponseType: ResponseTypeCode,
		ClientId:     NewId(),
		RedirectURI:  "https://example.com/callback",
		State:        "test_state",
		Scope:        "user",
	}

	t.Run("Valid AuthorizeRequest without resource should pass", func(t *testing.T) {
		require.Nil(t, authRequest.IsValid())
	})

	t.Run("Valid AuthorizeRequest with valid resource should pass", func(t *testing.T) {
		authRequest.Resource = "https://api.example.com"
		require.Nil(t, authRequest.IsValid())
	})

	t.Run("AuthorizeRequest with invalid resource should fail", func(t *testing.T) {
		authRequest.Resource = "not-a-valid-uri"
		require.NotNil(t, authRequest.IsValid())
	})

	t.Run("AuthorizeRequest with resource too long should fail", func(t *testing.T) {
		// Create a resource URI longer than 512 characters
		longPath := make([]byte, 500)
		for i := range longPath {
			longPath[i] = 'a'
		}
		authRequest.Resource = "https://example.com/" + string(longPath)
		require.NotNil(t, authRequest.IsValid())
	})

	t.Run("AuthorizeRequest with empty resource should pass", func(t *testing.T) {
		authRequest.Resource = ""
		require.Nil(t, authRequest.IsValid())
	})
}

func TestValidatePKCEForClientType(t *testing.T) {
	codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	hash := sha256.Sum256([]byte(codeVerifier))
	challenge := base64.RawURLEncoding.EncodeToString(hash[:])

	withChallenge := func() *AuthData {
		return &AuthData{ClientId: NewId(), CodeChallenge: challenge, CodeChallengeMethod: PKCECodeChallengeMethodS256}
	}
	withoutChallenge := func() *AuthData {
		return &AuthData{ClientId: NewId()}
	}

	t.Run("PKCE required", func(t *testing.T) {
		t.Run("without code challenge fails", func(t *testing.T) {
			appErr := withoutChallenge().ValidatePKCEForClientType(true, codeVerifier)
			require.NotNil(t, appErr)
			require.Equal(t, "model.authorize.validate_pkce.public_client_required.app_error", appErr.Id)
		})

		t.Run("without code verifier fails", func(t *testing.T) {
			appErr := withChallenge().ValidatePKCEForClientType(true, "")
			require.NotNil(t, appErr)
			require.Equal(t, "model.authorize.validate_pkce.verifier_required.app_error", appErr.Id)
		})

		t.Run("with wrong code verifier fails", func(t *testing.T) {
			appErr := withChallenge().ValidatePKCEForClientType(true, "wrong_verifier_that_is_long_enough_to_be_valid_0123456789")
			require.NotNil(t, appErr)
			require.Equal(t, "model.authorize.validate_pkce.verification_failed.app_error", appErr.Id)
		})

		t.Run("with valid code verifier passes", func(t *testing.T) {
			require.Nil(t, withChallenge().ValidatePKCEForClientType(true, codeVerifier))
		})
	})

	t.Run("PKCE optional", func(t *testing.T) {
		t.Run("without PKCE passes", func(t *testing.T) {
			require.Nil(t, withoutChallenge().ValidatePKCEForClientType(false, ""))
		})

		t.Run("verifier without challenge fails", func(t *testing.T) {
			appErr := withoutChallenge().ValidatePKCEForClientType(false, codeVerifier)
			require.NotNil(t, appErr)
			require.Equal(t, "model.authorize.validate_pkce.not_used_in_auth.app_error", appErr.Id)
		})

		t.Run("challenge without verifier fails", func(t *testing.T) {
			appErr := withChallenge().ValidatePKCEForClientType(false, "")
			require.NotNil(t, appErr)
			require.Equal(t, "model.authorize.validate_pkce.verifier_required.app_error", appErr.Id)
		})

		t.Run("challenge with wrong verifier fails", func(t *testing.T) {
			appErr := withChallenge().ValidatePKCEForClientType(false, "wrong_verifier_that_is_long_enough_to_be_valid_0123456789")
			require.NotNil(t, appErr)
			require.Equal(t, "model.authorize.validate_pkce.verification_failed.app_error", appErr.Id)
		})

		t.Run("challenge with valid verifier passes", func(t *testing.T) {
			require.Nil(t, withChallenge().ValidatePKCEForClientType(false, codeVerifier))
		})
	})
}

func TestRedirectURISchemeValidation(t *testing.T) {
	newAuthData := func(redirectURI string) *AuthData {
		ad := &AuthData{
			ClientId:    NewId(),
			UserId:      NewId(),
			Code:        NewId(),
			ExpiresIn:   AuthCodeExpireTime,
			CreateAt:    GetMillis(),
			RedirectUri: redirectURI,
		}
		return ad
	}
	newAccessData := func(redirectURI string) *AccessData {
		return &AccessData{
			ClientId:    NewId(),
			UserId:      NewId(),
			Token:       NewId(),
			RedirectUri: redirectURI,
		}
	}
	newAuthorizeRequest := func(redirectURI string) *AuthorizeRequest {
		return &AuthorizeRequest{
			ResponseType: ResponseTypeCode,
			ClientId:     NewId(),
			RedirectURI:  redirectURI,
			State:        "state",
			Scope:        "user",
		}
	}

	for _, uri := range []string{"https://example.com/cb", "com.example.app://cb"} {
		require.Nil(t, newAuthData(uri).IsValid(), uri)
		require.Nil(t, newAccessData(uri).IsValid(), uri)
		require.Nil(t, newAuthorizeRequest(uri).IsValid(), uri)
	}

	for _, uri := range []string{"javascript://x", "javascript:alert(1)", "data://x/y"} {
		require.NotNil(t, newAuthData(uri).IsValid(), uri)
		require.NotNil(t, newAccessData(uri).IsValid(), uri)
		require.NotNil(t, newAuthorizeRequest(uri).IsValid(), uri)
	}
}
