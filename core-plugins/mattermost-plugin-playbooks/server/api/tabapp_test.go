// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MicahParks/jwkset"
	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	keyID           = "my-key-id"
	keyWithoutAlgID = "SjE4tvzAwAoo6GB32-g1QAdgIck"
)

// TestValidateToken was inspired by https://github.com/MicahParks/keyfunc/blob/main/keyfunc_test.go.
func TestValidateToken(t *testing.T) {
	makeRequest := func(t *testing.T, token *string) *http.Request {
		request, err := http.NewRequest("GET", "/test", nil)
		require.NoError(t, err)

		if token != nil {
			request.Header.Add("Authorization", *token)
		}

		return request
	}

	makeKeySet := func(t *testing.T) (*rsa.PublicKey, *rsa.PrivateKey, keyfunc.Keyfunc) {
		serverStore := jwkset.NewMemoryStorage()

		// Make a public/private key that has the alg property set.
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		require.NoError(t, err)
		pub := &priv.PublicKey

		jwk, err := jwkset.NewJWKFromKey(priv, jwkset.JWKOptions{
			Metadata: jwkset.JWKMetadataOptions{
				KID: keyID,
				USE: jwkset.UseSig,
			},
		})
		require.NoError(t, err)

		err = serverStore.KeyWrite(context.TODO(), jwk)
		require.NoError(t, err)

		// Make a public/private key that is missing the alg property.
		jwk2, err := jwkset.NewJWKFromRawJSON(
			json.RawMessage(`
				{
					"kty": "RSA",
					"use": "sig",
					"kid": "SjE4tvzAwAoo6GB32-g1QAdgIck",
					"x5t": "SjE4tvzAwAoo6GB32-g1QAdgIck",
					"n": "ul88fCCUH0e4sqPqWOFj9BWGIctw2JJhoBO2aOykMvbjgr3Sn0ZbitaJTi5L8HFISLmwdSGvj76SOe7qNV0Jb0PuOb5DWTB_f4hXXPqZLfh5Bn7uyuTRapbaRczDESR1BuubTodJyhYapb1B19F4EbMbmvce2kXRRWZ5OFJA_FR7ZMU2mwLD5yzuWo_gr_52FwZZSBX1fkPbmDLriJoEIl8IVMMK11hlyK-m0LYsT-Tz_AHX3eT2bct-4xQSZAKsiWj68q4a6ek5LO5oM1MrkoFhErCDMWz-N8v7mM1qyy_kUQ417ZBBNGg5IvoIuM8yYQLMsH7R3i24UpT_kkJE6w",
					"e": "AQAB",
					"x5c": [
						"MIIC/TCCAeWgAwIBAgIIDlcb6PCgUSgwDQYJKoZIhvcNAQELBQAwLTErMCkGA1UEAxMiYWNjb3VudHMuYWNjZXNzY29udHJvbC53aW5kb3dzLm5ldDAeFw0yNDA4MDQxNjA1NTFaFw0yOTA4MDQxNjA1NTFaMC0xKzApBgNVBAMTImFjY291bnRzLmFjY2Vzc2NvbnRyb2wud2luZG93cy5uZXQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC6Xzx8IJQfR7iyo+pY4WP0FYYhy3DYkmGgE7Zo7KQy9uOCvdKfRluK1olOLkvwcUhIubB1Ia+PvpI57uo1XQlvQ+45vkNZMH9/iFdc+pkt+HkGfu7K5NFqltpFzMMRJHUG65tOh0nKFhqlvUHX0XgRsxua9x7aRdFFZnk4UkD8VHtkxTabAsPnLO5aj+Cv/nYXBllIFfV+Q9uYMuuImgQiXwhUwwrXWGXIr6bQtixP5PP8Adfd5PZty37jFBJkAqyJaPryrhrp6Tks7mgzUyuSgWESsIMxbP43y/uYzWrLL+RRDjXtkEE0aDki+gi4zzJhAsywftHeLbhSlP+SQkTrAgMBAAGjITAfMB0GA1UdDgQWBBS+wOJGOC8r3kutKW7UjRnXV2QlBjANBgkqhkiG9w0BAQsFAAOCAQEAtGOU0QsTPGFSteuIf1N9gM+qiONQqgfb66+FT/eXvuacFMa4pgXpUN0/AuKMxBg5kDRcms2PibWzefZ7RrRfLosKtViwVqkkKK+oyuSYXVArz+8u/v+jEgBh3BoMPqB3ukvCpGTB0rHX+QV1zNBac7hVQs/4kEGcr2/Nsa1g/uVRh2N7LQo9YRImmeOk/JrxgaSbkioW1xsQKMv7ZJLSLaSLXhAvA3HUU2kHMJCXE2VkNrs/naA47dWkMa9Af1GeqOe8uH+EJu88xz78kwKk2EiZt41ZaTY57fXYCxlnNQzhRdvm1KmJ8OfMUa/pqtXKWzrPWL/vs2oDsZJz9DzERw=="
					],
					"issuer": "https://login.microsoftonline.com/{tenantid}/v2.0"
				}
			`),
			jwkset.JWKMarshalOptions{
				Private: true,
			},
			jwkset.JWKValidateOptions{},
		)
		require.NoError(t, err)

		err = serverStore.KeyWrite(context.TODO(), jwk2)
		require.NoError(t, err)

		// Finally, setup the keyfunc backed by the above memory store.
		options := keyfunc.Options{
			Ctx:          context.TODO(),
			Storage:      serverStore,
			UseWhitelist: []jwkset.USE{jwkset.UseSig},
		}
		k, err := keyfunc.New(options)
		if err != nil {
			t.Fatalf("Failed to create Keyfunc. Error: %s", err)
		}

		return pub, priv, k
	}

	newRawToken := func(token string) *string {
		return &token
	}

	newToken := func(t *testing.T, priv *rsa.PrivateKey, mapClaims jwt.MapClaims) *string {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, mapClaims)
		token.Header[jwkset.HeaderKID] = keyID
		signed, err := token.SignedString(priv)
		if err != nil {
			t.Fatalf("Failed to sign JWT. Error: %s", err)
		}

		return &signed
	}

	past := func() int64 {
		return time.Now().Add(-60 * time.Second).Unix()
	}

	future := func() int64 {
		return time.Now().Add(60 * time.Second).Unix()
	}

	type parameters struct {
		EnableDeveloperAndTesting bool
	}

	runPermutations(t, parameters{}, func(t *testing.T, params parameters) {
		t.Run("no authorization header", func(t *testing.T) {
			_, _, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, nil)
			expectedTenantIDs := []string{}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			if params.EnableDeveloperAndTesting {
				assert.Nil(t, validationErr)
			} else {
				require.NotNil(t, validationErr)
				assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
			}
		})

		t.Run("empty authorization header", func(t *testing.T) {
			_, _, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newRawToken(""))
			expectedTenantIDs := []string{}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			if params.EnableDeveloperAndTesting {
				assert.Nil(t, validationErr)
			} else {
				require.NotNil(t, validationErr)
				assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
			}
		})

		t.Run("nil keyfunc", func(t *testing.T) {
			var jwtKeyFunc keyfunc.Keyfunc
			r := makeRequest(t, newRawToken("invalid"))
			expectedTenantIDs := []string{}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusInternalServerError, validationErr.StatusCode)
		})

		t.Run("failed to parse authorization header", func(t *testing.T) {
			_, _, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newRawToken("invalid"))
			expectedTenantIDs := []string{}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, missing claims", func(t *testing.T) {
			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, nil))
			expectedTenantIDs := []string{}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("hmac key pretending to be rsa", func(t *testing.T) {
			tid := uuid.NewString()

			_, _, jwtKeyFunc := makeKeySet(t)

			token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": tid,
			})
			token.Header[jwkset.HeaderKID] = keyWithoutAlgID
			signed, err := token.SignedString([]byte("hmac-secret-key"))
			require.NoError(t, err)

			r := makeRequest(t, &signed)
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, missing iat claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": tid,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, invalid iat claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": "invalid",
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": tid,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, future iat claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": future(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": tid,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, missing exp claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"nbf": past(),
				"tid": tid,
				"aud": ExpectedAudience,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, invalid exp claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": "invalid",
				"nbf": past(),
				"tid": tid,
				"aud": ExpectedAudience,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, expired exp claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": past(),
				"nbf": past(),
				"tid": tid,
				"aud": ExpectedAudience,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, missing nbf claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"tid": tid,
				"aud": ExpectedAudience,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, invalid nbf claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": "invalid",
				"tid": tid,
				"aud": ExpectedAudience,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, future nbf claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": future(),
				"tid": tid,
				"aud": ExpectedAudience,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, wrong aud claim", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"tid": tid,
				"aud": "unexpected-app",
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			if params.EnableDeveloperAndTesting {
				assert.Nil(t, validationErr)
			} else {
				require.NotNil(t, validationErr)
				assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
			}
		})

		t.Run("signed token, no tenants configured", func(t *testing.T) {
			wrongTid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": wrongTid,
			}))
			expectedTenantIDs := []string{}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, not matching single configured tenant", func(t *testing.T) {
			wrongTid := uuid.NewString()
			expectedTid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": wrongTid,
			}))
			expectedTenantIDs := []string{expectedTid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, not matching multiple configured tenants", func(t *testing.T) {
			wrongTid := uuid.NewString()
			expectedTid1 := uuid.NewString()
			expectedTid2 := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": wrongTid,
			}))
			expectedTenantIDs := []string{expectedTid1, expectedTid2}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			require.NotNil(t, validationErr)
			assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
		})

		t.Run("signed token, matching single configured tenant", func(t *testing.T) {
			tid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": tid,
			}))
			expectedTenantIDs := []string{tid}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			assert.Nil(t, validationErr)
		})

		t.Run("signed token, matching one of multiple configured tenants", func(t *testing.T) {
			expectedTid1 := uuid.NewString()
			expectedTid2 := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": expectedTid1,
			}))
			expectedTenantIDs := []string{expectedTid1, expectedTid2}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			assert.Nil(t, validationErr)
		})

		t.Run("signed token, wildcard tenant", func(t *testing.T) {
			developerTid := uuid.NewString()

			_, priv, jwtKeyFunc := makeKeySet(t)
			r := makeRequest(t, newToken(t, priv, jwt.MapClaims{
				"iat": past(),
				"exp": future(),
				"nbf": past(),
				"aud": ExpectedAudience,
				"tid": developerTid,
			}))
			expectedTenantIDs := []string{"*"}

			validationErr := validateToken(jwtKeyFunc, r, expectedTenantIDs, params.EnableDeveloperAndTesting)
			if params.EnableDeveloperAndTesting {
				assert.Nil(t, validationErr)
			} else {
				require.NotNil(t, validationErr)
				assert.Equal(t, http.StatusUnauthorized, validationErr.StatusCode)
			}
		})
	})
}
