// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"

	"github.com/fxamacker/cbor/v2"
)

// SoftAuthenticator is a software WebAuthn authenticator for tests: it answers the creation options
// the server hands out with a response the server's WebAuthn library accepts.
type SoftAuthenticator struct {
	key          *ecdsa.PrivateKey
	CredentialID []byte
	AAGUID       []byte
}

// NewSoftAuthenticator returns an authenticator with a fresh P-256 key and credential id.
func NewSoftAuthenticator() (*SoftAuthenticator, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	credID := make([]byte, 32)
	aaguid := make([]byte, 16)
	if _, err = rand.Read(credID); err != nil {
		return nil, err
	}
	if _, err = rand.Read(aaguid); err != nil {
		return nil, err
	}
	return &SoftAuthenticator{key: key, CredentialID: credID, AAGUID: aaguid}, nil
}

type softOptions struct {
	userVerified bool
}

// SoftAuthenticatorOption changes how a SoftAuthenticator answers a ceremony.
type SoftAuthenticatorOption func(*softOptions)

// WithoutUserVerification leaves the user-verified flag out of the response, like an
// authenticator that could not verify the user.
func WithoutUserVerification() SoftAuthenticatorOption {
	return func(o *softOptions) { o.userVerified = false }
}

// CreateResponse answers the creation options JSON the server returned from begin ({"publicKey":{…}})
// with a registration response JSON, as a browser's navigator.credentials.create() would, claiming
// the given origin.
func (a *SoftAuthenticator) CreateResponse(options []byte, origin string, opts ...SoftAuthenticatorOption) ([]byte, error) {
	o := softOptions{userVerified: true}
	for _, opt := range opts {
		opt(&o)
	}

	var creation struct {
		PublicKey struct {
			Challenge string `json:"challenge"`
			RP        struct {
				ID string `json:"id"`
			} `json:"rp"`
		} `json:"publicKey"`
	}
	if err := json.Unmarshal(options, &creation); err != nil {
		return nil, err
	}
	if creation.PublicKey.Challenge == "" || creation.PublicKey.RP.ID == "" {
		return nil, errors.New("creation options lack a challenge or relying party id")
	}

	clientData, err := json.Marshal(map[string]any{
		"type":        "webauthn.create",
		"challenge":   creation.PublicKey.Challenge,
		"origin":      origin,
		"crossOrigin": false,
	})
	if err != nil {
		return nil, err
	}

	// Uncompressed point: 0x04 ‖ x ‖ y.
	point, err := a.key.PublicKey.Bytes()
	if err != nil {
		return nil, err
	}
	coseKey, err := cbor.Marshal(map[int]any{1: 2, 3: -7, -1: 1, -2: point[1:33], -3: point[33:65]})
	if err != nil {
		return nil, err
	}

	flags := byte(0x01 | 0x40) // user present, attested credential data
	if o.userVerified {
		flags |= 0x04
	}
	rpHash := sha256.Sum256([]byte(creation.PublicKey.RP.ID))
	authData := append([]byte{}, rpHash[:]...)
	authData = append(authData, flags)
	authData = binary.BigEndian.AppendUint32(authData, 0) // sign count
	authData = append(authData, a.AAGUID...)
	authData = binary.BigEndian.AppendUint16(authData, uint16(len(a.CredentialID)))
	authData = append(authData, a.CredentialID...)
	authData = append(authData, coseKey...)

	attestation, err := cbor.Marshal(map[string]any{"fmt": "none", "attStmt": map[string]any{}, "authData": authData})
	if err != nil {
		return nil, err
	}

	b64 := base64.RawURLEncoding.EncodeToString
	return json.Marshal(map[string]any{
		"id":    b64(a.CredentialID),
		"rawId": b64(a.CredentialID),
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64(clientData),
			"attestationObject": b64(attestation),
			"transports":        []string{"internal"},
		},
	})
}
