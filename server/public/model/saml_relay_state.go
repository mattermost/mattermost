// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
)

// SamlRelayStateExpiryTime bounds how long a signed RelayState is valid for. It only needs to
// survive a single SAML login round-trip, so this is intentionally short.
const SamlRelayStateExpiryTime = 1000 * 60 * 5 // 5 minutes

const samlRelayStateExpKey = "exp"

// SignSamlRelayState signs relayProps with key and returns an opaque, tamper-evident RelayState
// string safe to round-trip through the IdP. relayProps itself is not modified.
func SignSamlRelayState(key []byte, relayProps map[string]string) string {
	signed := make(map[string]string, len(relayProps)+1)
	for k, v := range relayProps {
		signed[k] = v
	}
	signed[samlRelayStateExpKey] = strconv.FormatInt(GetMillis()+SamlRelayStateExpiryTime, 10)

	payload := []byte(MapToJSON(signed))

	mac := hmac.New(sha256.New, key)
	mac.Write(payload)

	return base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// VerifySamlRelayState verifies a RelayState produced by SignSamlRelayState. It returns the
// original relayProps (with the expiry field stripped) if, and only if, the signature is valid
// and the embedded expiry has not passed.
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

	relayProps := MapFromJSON(bytes.NewReader(payload))

	expStr, ok := relayProps[samlRelayStateExpKey]
	if !ok {
		return nil, errors.New("relay state missing expiry")
	}
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil {
		return nil, errors.New("relay state has invalid expiry")
	}
	if GetMillis() > exp {
		return nil, errors.New("relay state expired")
	}
	delete(relayProps, samlRelayStateExpKey)

	return relayProps, nil
}
