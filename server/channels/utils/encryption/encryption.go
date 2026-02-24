// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package encryption provides AES-256-GCM encryption/decryption and SHA-256 hashing
// for application-level data protection. Key is loaded from TECHZEN_ENCRYPTION_KEY env.
//
// Design:
//   - Encrypt() returns "ENC:<base64>" with random nonce per call
//   - Decrypt() detects "ENC:" prefix; if missing, returns input as-is (backward compat)
//   - Hash() returns hex-encoded SHA-256 for deterministic lookups (e.g. session token)
//   - If encryption key is not configured, Encrypt() returns plaintext (graceful degradation)
package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
)

const (
	// EnvKey is the environment variable name for the 32-byte encryption key.
	EnvKey = "TECHZEN_ENCRYPTION_KEY"

	// Prefix marks encrypted data in the database.
	Prefix = "ENC:"

	// KeyLength is the required key length in bytes (AES-256).
	KeyLength = 32
)

var (
	cachedKey  []byte
	keyLoaded  bool
	keyOnce    sync.Once
)

// loadKey reads the encryption key from the environment once.
// Key can be hex-encoded (64 chars) or raw 32 bytes.
func loadKey() {
	keyOnce.Do(func() {
		raw := os.Getenv(EnvKey)
		if raw == "" {
			return
		}

		// Try hex decode first (64 hex chars = 32 bytes)
		if len(raw) == KeyLength*2 {
			if decoded, err := hex.DecodeString(raw); err == nil {
				cachedKey = decoded
				keyLoaded = true
				return
			}
		}

		// Try base64
		if decoded, err := base64.StdEncoding.DecodeString(raw); err == nil && len(decoded) == KeyLength {
			cachedKey = decoded
			keyLoaded = true
			return
		}

		// Raw bytes (e.g. 32-char ASCII passphrase → padded/hashed)
		if len(raw) >= KeyLength {
			cachedKey = []byte(raw)[:KeyLength]
			keyLoaded = true
			return
		}

		// Key too short — hash it to get 32 bytes
		h := sha256.Sum256([]byte(raw))
		cachedKey = h[:]
		keyLoaded = true
	})
}

// Enabled returns true if encryption key is configured.
func Enabled() bool {
	loadKey()
	return keyLoaded
}

// Encrypt encrypts plaintext using AES-256-GCM with a random nonce.
// Returns "ENC:<base64(nonce+ciphertext)>" on success.
// If key is not configured or plaintext is empty, returns plaintext unchanged.
func Encrypt(plaintext string) string {
	if plaintext == "" {
		return plaintext
	}

	loadKey()
	if !keyLoaded {
		return plaintext
	}

	// Already encrypted — don't double-encrypt
	if strings.HasPrefix(plaintext, Prefix) {
		return plaintext
	}

	block, err := aes.NewCipher(cachedKey)
	if err != nil {
		return plaintext
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return plaintext
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return plaintext
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return Prefix + base64.StdEncoding.EncodeToString(ciphertext)
}

// Decrypt decrypts "ENC:<base64>" data back to plaintext.
// If the input doesn't have the "ENC:" prefix, it's treated as legacy plaintext
// and returned as-is (backward compatibility).
// If decryption fails, returns the original input (safe fallback).
func Decrypt(ciphertext string) string {
	if ciphertext == "" {
		return ciphertext
	}

	if !strings.HasPrefix(ciphertext, Prefix) {
		// Legacy plaintext — return as-is
		return ciphertext
	}

	loadKey()
	if !keyLoaded {
		// No key available — can't decrypt, return as-is
		return ciphertext
	}

	encoded := ciphertext[len(Prefix):]
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return ciphertext
	}

	block, err := aes.NewCipher(cachedKey)
	if err != nil {
		return ciphertext
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return ciphertext
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return ciphertext
	}

	nonce, sealed := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		// Decryption failed — might be corrupted or wrong key
		return ciphertext
	}

	return string(plaintext)
}

// Hash returns the hex-encoded SHA-256 hash of the input.
// Used for deterministic lookups (e.g. session token → TokenHash column).
func Hash(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

// IsEncrypted returns true if the string has the encryption prefix.
func IsEncrypted(s string) bool {
	return strings.HasPrefix(s, Prefix)
}

// MustEncrypt is like Encrypt but returns an error if encryption fails.
// This is for cases where encryption is mandatory (not optional).
func MustEncrypt(plaintext string) (string, error) {
	loadKey()
	if !keyLoaded {
		return "", fmt.Errorf("encryption key not configured: set %s environment variable", EnvKey)
	}

	result := Encrypt(plaintext)
	if !strings.HasPrefix(result, Prefix) {
		return "", fmt.Errorf("encryption failed")
	}

	return result, nil
}
