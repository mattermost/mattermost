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
	// UserHandle is the user.id from the creation options CreateResponse last answered, which is what
	// the authenticator returns as the user handle when signing in. Tests may overwrite it.
	UserHandle []byte
	// SignCount is the counter GetAssertion reports.
	SignCount uint32
}

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
	userVerified   bool
	backupEligible bool
}

type SoftAuthenticatorOption func(*softOptions)

func newSoftOptions(opts []SoftAuthenticatorOption) softOptions {
	o := softOptions{userVerified: true}
	for _, opt := range opts {
		opt(&o)
	}
	return o
}

// WithoutUserVerification leaves the user-verified flag out of the response, like an
// authenticator that could not verify the user.
func WithoutUserVerification() SoftAuthenticatorOption {
	return func(o *softOptions) { o.userVerified = false }
}

// WithBackupEligible sets the backup-eligible and backup-state flags, like a passkey that syncs
// between devices. It applies to both CreateResponse and GetAssertion.
func WithBackupEligible() SoftAuthenticatorOption {
	return func(o *softOptions) { o.backupEligible = true }
}

// CreateResponse answers the creation options JSON the server returned from begin ({"publicKey":{…}})
// with a registration response JSON, as a browser's navigator.credentials.create() would, claiming
// the given origin.
func (a *SoftAuthenticator) CreateResponse(options []byte, origin string, opts ...SoftAuthenticatorOption) ([]byte, error) {
	o := newSoftOptions(opts)

	var creation struct {
		PublicKey struct {
			Challenge string `json:"challenge"`
			RP        struct {
				ID string `json:"id"`
			} `json:"rp"`
			User struct {
				ID string `json:"id"`
			} `json:"user"`
		} `json:"publicKey"`
	}
	if err := json.Unmarshal(options, &creation); err != nil {
		return nil, err
	}
	if creation.PublicKey.Challenge == "" || creation.PublicKey.RP.ID == "" {
		return nil, errors.New("creation options lack a challenge or relying party id")
	}

	userHandle, err := base64.RawURLEncoding.DecodeString(creation.PublicKey.User.ID)
	if err != nil {
		return nil, err
	}
	a.UserHandle = userHandle

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
	if o.backupEligible {
		flags |= 0x08 | 0x10
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

// GetAssertion answers the request options JSON the server returned from begin sign-in ({"publicKey":{…}})
// with an assertion JSON, as a browser's navigator.credentials.get() would, claiming the given origin
// and reporting a.SignCount.
func (a *SoftAuthenticator) GetAssertion(options []byte, origin string, opts ...SoftAuthenticatorOption) ([]byte, error) {
	o := newSoftOptions(opts)

	var request struct {
		PublicKey struct {
			Challenge string `json:"challenge"`
			RPID      string `json:"rpId"`
		} `json:"publicKey"`
	}
	if err := json.Unmarshal(options, &request); err != nil {
		return nil, err
	}
	if request.PublicKey.Challenge == "" || request.PublicKey.RPID == "" {
		return nil, errors.New("request options lack a challenge or relying party id")
	}

	clientData, err := json.Marshal(map[string]any{
		"type":        "webauthn.get",
		"challenge":   request.PublicKey.Challenge,
		"origin":      origin,
		"crossOrigin": false,
	})
	if err != nil {
		return nil, err
	}

	flags := byte(0x01) // user present
	if o.userVerified {
		flags |= 0x04
	}
	if o.backupEligible {
		flags |= 0x08 | 0x10
	}
	rpHash := sha256.Sum256([]byte(request.PublicKey.RPID))
	authData := append([]byte{}, rpHash[:]...)
	authData = append(authData, flags)
	authData = binary.BigEndian.AppendUint32(authData, a.SignCount)

	clientHash := sha256.Sum256(clientData)
	digest := sha256.Sum256(append(append([]byte{}, authData...), clientHash[:]...))
	signature, err := ecdsa.SignASN1(rand.Reader, a.key, digest[:])
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
			"authenticatorData": b64(authData),
			"signature":         b64(signature),
			"userHandle":        b64(a.UserHandle),
		},
	})
}
