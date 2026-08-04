// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
)

// SignSamlRelayState signs relayProps with key and returns an opaque, tamper-evident RelayState
// string safe to round-trip through the IdP.
func SignSamlRelayState(key []byte, relayProps map[string]string) string {
	payload := []byte(MapToJSON(relayProps))

	mac := hmac.New(sha256.New, key)
	mac.Write(payload)

	return base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// VerifySamlRelayState verifies a RelayState produced by SignSamlRelayState and returns the
// original relayProps if, and only if, the signature is valid.
func VerifySamlRelayState(key []byte, relayState string) (map[string]string, error) {
	payloadPart, sigPart, ok := strings.Cut(relayState, ".")
	if !ok {
		return nil, errors.New("malformed relay state")
	}

	payload, err := base64.RawURLEncoding.DecodeString(payloadPart)
	if err != nil {
		return nil, errors.New("malformed relay state payload")
	}
	sig, err := base64.RawURLEncoding.DecodeString(sigPart)
	if err != nil {
		return nil, errors.New("malformed relay state signature")
	}

	mac := hmac.New(sha256.New, key)
	mac.Write(payload)
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return nil, errors.New("invalid relay state signature")
	}

	return MapFromJSON(bytes.NewReader(payload)), nil
}
