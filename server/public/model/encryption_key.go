// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

const (
	PreferenceCategoryEncryption = "encryption"
	PreferenceNamePublicKey      = "public_key"
	EncryptionPublicKeyMaxSize   = 10 * 1024
)

// EncryptionSessionKey represents a public encryption key tied to a specific session.
// Each user can have multiple keys (one per active session/device).
type EncryptionSessionKey struct {
	SessionId string `json:"session_id" db:"sessionid"` // Primary key, references Sessions.Id
	UserId    string `json:"user_id" db:"userid"`       // For quick lookup
	PublicKey string `json:"public_key" db:"publickey"` // JWK format
	CreateAt  int64  `json:"create_at" db:"createat"`
}

// EncryptionPublicKey represents a user's public encryption key (API response format).
// When a user has multiple sessions, multiple keys will be returned for that user.
type EncryptionPublicKey struct {
	UserId    string `json:"user_id"`
	SessionId string `json:"session_id,omitempty"` // Session this key belongs to
	PublicKey string `json:"public_key"`           // JWK format
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
}

// EncryptionPublicKeyRequest is the request body for registering a public key.
type EncryptionPublicKeyRequest struct {
	PublicKey string `json:"public_key"`
}

// EncryptionPublicKeysRequest is the request body for bulk fetching public keys.
type EncryptionPublicKeysRequest struct {
	UserIds []string `json:"user_ids"`
}

// EncryptionStatus represents the encryption status for the current user.
type EncryptionStatus struct {
	Enabled    bool   `json:"enabled"`     // Whether encryption is enabled in config
	CanEncrypt bool   `json:"can_encrypt"` // Whether current user can encrypt
	HasKey     bool   `json:"has_key"`     // Whether current session has a registered key
	SessionId  string `json:"session_id"`  // Current Mattermost session ID (for key storage)
}

// PreSave prepares the EncryptionSessionKey for saving.
func (k *EncryptionSessionKey) PreSave() {
	if k.CreateAt == 0 {
		k.CreateAt = GetMillis()
	}
}

// IsValid validates the EncryptionSessionKey.
func (k *EncryptionSessionKey) IsValid() *AppError {
	if !IsValidId(k.SessionId) {
		return NewAppError("EncryptionSessionKey.IsValid", "model.encryption_key.is_valid.session_id.app_error", nil, "", http.StatusBadRequest)
	}
	if !IsValidId(k.UserId) {
		return NewAppError("EncryptionSessionKey.IsValid", "model.encryption_key.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}
	if k.PublicKey == "" {
		return NewAppError("EncryptionSessionKey.IsValid", "model.encryption_key.is_valid.public_key.app_error", nil, "", http.StatusBadRequest)
	}
	// Basic validation - JWK should be JSON
	if len(k.PublicKey) < 10 || k.PublicKey[0] != '{' {
		return NewAppError("EncryptionSessionKey.IsValid", "model.encryption_key.is_valid.public_key_format.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func (r *EncryptionPublicKeyRequest) IsValid() *AppError {
	if r.PublicKey == "" {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key.app_error", nil, "", http.StatusBadRequest)
	}

	if len(r.PublicKey) > EncryptionPublicKeyMaxSize {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key_too_large.app_error", nil, "", http.StatusBadRequest)
	}

	// Basic validation - JWK should be JSON
	if len(r.PublicKey) < 10 || r.PublicKey[0] != '{' {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key_format.app_error", nil, "", http.StatusBadRequest)
	}

	var jwk map[string]interface{}
	if err := json.Unmarshal([]byte(r.PublicKey), &jwk); err != nil {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key_parse.app_error", nil, "", http.StatusBadRequest)
	}

	kty, ok := jwk["kty"].(string)
	if !ok {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key_kty_missing.app_error", nil, "", http.StatusBadRequest)
	}

	if kty != "RSA" && kty != "EC" && kty != "OKP" {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key_kty_invalid.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (r *EncryptionPublicKeysRequest) IsValid() *AppError {
	if len(r.UserIds) == 0 {
		return NewAppError("EncryptionPublicKeysRequest.IsValid", "model.encryption_key.is_valid.user_ids.app_error", nil, "", http.StatusBadRequest)
	}
	if len(r.UserIds) > 200 {
		return NewAppError("EncryptionPublicKeysRequest.IsValid", "model.encryption_key.is_valid.user_ids_too_many.app_error", nil, "", http.StatusBadRequest)
	}
	for _, userId := range r.UserIds {
		if !IsValidId(userId) {
			return NewAppError("EncryptionPublicKeysRequest.IsValid", "model.encryption_key.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
		}
	}
	return nil
}

// EncryptionSessionKeyWithUser extends EncryptionSessionKey with user info for admin display.
type EncryptionSessionKeyWithUser struct {
	SessionId        string `json:"session_id" db:"sessionid"`
	UserId           string `json:"user_id" db:"userid"`
	Username         string `json:"username" db:"username"`
	PublicKey        string `json:"public_key" db:"publickey"`
	CreateAt         int64  `json:"create_at" db:"createat"`
	LastActivityAt   int64  `json:"last_activity_at" db:"lastactivityat"`     // From sessions table
	SessionExpiresAt int64  `json:"session_expires_at" db:"sessionexpiresat"` // From sessions table
	Platform         string `json:"platform" db:"platform"`                   // From sessions.props
	OS               string `json:"os" db:"os"`                               // From sessions.props
	Browser          string `json:"browser" db:"browser"`                     // From sessions.props
	DeviceId         string `json:"device_id" db:"deviceid"`                  // From sessions table
	SessionActive    bool   `json:"session_active"`                           // Whether session still exists
}

// EncryptionKeyStats contains statistics about encryption keys.
type EncryptionKeyStats struct {
	TotalKeys  int `json:"total_keys"`
	TotalUsers int `json:"total_users"`
}

// EncryptionKeysResponse is the admin response containing keys and stats.
type EncryptionKeysResponse struct {
	Keys  []*EncryptionSessionKeyWithUser `json:"keys"`
	Stats *EncryptionKeyStats             `json:"stats"`
}
