// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testSamlRelayStateKey(t *testing.T) []byte {
	t.Helper()
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)
	return key
}

func TestSignAndVerifySamlRelayStateRoundTrip(t *testing.T) {
	key := testSamlRelayStateKey(t)
	relayProps := map[string]string{
		"action":    OAuthActionSignup,
		"invite_id": "some-invite-id",
	}

	relayState := SignSamlRelayState(key, relayProps)
	require.NotEmpty(t, relayState)

	got, err := VerifySamlRelayState(key, relayState)
	require.NoError(t, err)
	assert.Equal(t, OAuthActionSignup, got["action"])
	assert.Equal(t, "some-invite-id", got["invite_id"])
	// The expiry field is internal bookkeeping and must not leak into the caller's relayProps.
	_, hasExp := got["exp"]
	assert.False(t, hasExp)
}

func TestSignSamlRelayStateDoesNotMutateInput(t *testing.T) {
	key := testSamlRelayStateKey(t)
	relayProps := map[string]string{"action": OAuthActionLogin}

	SignSamlRelayState(key, relayProps)

	assert.Equal(t, map[string]string{"action": OAuthActionLogin}, relayProps)
}

func TestVerifySamlRelayStateRejectsTamperedPayload(t *testing.T) {
	key := testSamlRelayStateKey(t)
	relayState := SignSamlRelayState(key, map[string]string{"action": OAuthActionSignup, "team_id": "legit-team"})

	payloadPart, sigPart, ok := strings.Cut(relayState, ".")
	require.True(t, ok)

	payload, err := base64.RawURLEncoding.DecodeString(payloadPart)
	require.NoError(t, err)

	tampered := strings.Replace(string(payload), "legit-team", "forged-team", 1)
	require.NotEqual(t, string(payload), tampered, "test payload must actually contain the substring being tampered")

	forgedRelayState := base64.RawURLEncoding.EncodeToString([]byte(tampered)) + "." + sigPart

	_, err = VerifySamlRelayState(key, forgedRelayState)
	assert.Error(t, err)
}

func TestVerifySamlRelayStateRejectsTamperedSignature(t *testing.T) {
	key := testSamlRelayStateKey(t)
	relayState := SignSamlRelayState(key, map[string]string{"action": OAuthActionSignup})

	payloadPart, sigPart, ok := strings.Cut(relayState, ".")
	require.True(t, ok)

	sig, err := base64.RawURLEncoding.DecodeString(sigPart)
	require.NoError(t, err)
	sig[0] ^= 0xFF
	forgedRelayState := payloadPart + "." + base64.RawURLEncoding.EncodeToString(sig)

	_, err = VerifySamlRelayState(key, forgedRelayState)
	assert.Error(t, err)
}

func TestVerifySamlRelayStateRejectsWrongKey(t *testing.T) {
	signingKey := testSamlRelayStateKey(t)
	verifyingKey := testSamlRelayStateKey(t)
	relayState := SignSamlRelayState(signingKey, map[string]string{"action": OAuthActionSignup})

	_, err := VerifySamlRelayState(verifyingKey, relayState)
	assert.Error(t, err)
}

func TestVerifySamlRelayStateRejectsMalformedInput(t *testing.T) {
	key := testSamlRelayStateKey(t)

	testCases := []string{
		"",
		"not-a-real-relay-state",
		"missing-separator-entirely",
		"!!!invalid-base64!!!." + base64.RawURLEncoding.EncodeToString([]byte("sig")),
		base64.RawURLEncoding.EncodeToString([]byte("{}")) + ".!!!invalid-base64!!!",
	}

	for _, tc := range testCases {
		_, err := VerifySamlRelayState(key, tc)
		assert.Error(t, err, "expected rejection for input: %q", tc)
	}
}

func TestVerifySamlRelayStateRejectsExpired(t *testing.T) {
	key := testSamlRelayStateKey(t)

	// Hand-construct a relay state with a backdated expiry, using the same wire format as
	// SignSamlRelayState, since that function always embeds a fresh (non-expired) expiry.
	expiredProps := map[string]string{
		"action": OAuthActionSignup,
		"exp":    strconv.FormatInt(GetMillis()-1000, 10),
	}
	payload := []byte(MapToJSON(expiredProps))
	mac := hmac.New(sha256.New, key)
	mac.Write(payload)
	relayState := base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	_, err := VerifySamlRelayState(key, relayState)
	assert.Error(t, err)
}

func TestVerifySamlRelayStateRejectsLegacyBase64Blob(t *testing.T) {
	key := testSamlRelayStateKey(t)

	// The pre-fix RelayState format: plain base64(JSON), no signature at all. Confirms the
	// old wire format (and thus the MM-69889 forged team_id/invite_id attack shape) is rejected.
	legacy := base64.StdEncoding.EncodeToString([]byte(MapToJSON(map[string]string{
		"action":  OAuthActionSignup,
		"team_id": "forged-team-id",
	})))

	_, err := VerifySamlRelayState(key, legacy)
	assert.Error(t, err)
}
