// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

const (
	PreferenceCategoryEncryption = "encryption"
	PreferenceNamePublicKey      = "public_key"
)

// EncryptionPublicKey represents a user's public encryption key.
type EncryptionPublicKey struct {
	UserId    string `json:"user_id"`
	PublicKey string `json:"public_key"` // JWK format
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
	Enabled    bool `json:"enabled"`     // Whether encryption is enabled in config
	CanEncrypt bool `json:"can_encrypt"` // Whether current user can encrypt (admin check if AdminModeOnly)
	HasKey     bool `json:"has_key"`     // Whether current user has registered a public key
}

func (r *EncryptionPublicKeyRequest) IsValid() *AppError {
	if r.PublicKey == "" {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key.app_error", nil, "", http.StatusBadRequest)
	}
	// Basic validation - JWK should be JSON
	if len(r.PublicKey) < 10 || r.PublicKey[0] != '{' {
		return NewAppError("EncryptionPublicKeyRequest.IsValid", "model.encryption_key.is_valid.public_key_format.app_error", nil, "", http.StatusBadRequest)
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
