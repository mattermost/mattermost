// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package encryption

import (
	"os"
	"sync"
	"testing"
)

func resetKeyState() {
	cachedKey = nil
	keyLoaded = false
	keyOnce = sync.Once{}
}

func setTestKey(t *testing.T) {
	t.Helper()
	resetKeyState()
	// 32-byte hex key (64 hex chars)
	os.Setenv(EnvKey, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() {
		os.Unsetenv(EnvKey)
		resetKeyState()
	})
}

func TestEncryptDecrypt(t *testing.T) {
	setTestKey(t)

	tests := []struct {
		name      string
		plaintext string
	}{
		{"simple message", "Hello, World!"},
		{"unicode", "こんにちは世界 🌍"},
		{"long text", "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."},
		{"json", `{"key": "value", "nested": {"a": 1}}`},
		{"empty line preserved", "line1\n\nline3"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted := Encrypt(tt.plaintext)

			if !IsEncrypted(encrypted) {
				t.Errorf("encrypted text should have prefix ENC:, got: %s", encrypted[:20])
			}

			if encrypted == tt.plaintext {
				t.Error("encrypted should differ from plaintext")
			}

			decrypted := Decrypt(encrypted)
			if decrypted != tt.plaintext {
				t.Errorf("decrypted = %q, want %q", decrypted, tt.plaintext)
			}
		})
	}
}

func TestEncryptEmpty(t *testing.T) {
	setTestKey(t)

	result := Encrypt("")
	if result != "" {
		t.Errorf("Encrypt('') should return '', got %q", result)
	}
}

func TestDecryptPlaintext(t *testing.T) {
	setTestKey(t)

	// Legacy plaintext (no ENC: prefix) should be returned as-is
	legacy := "this is old plaintext data"
	result := Decrypt(legacy)
	if result != legacy {
		t.Errorf("Decrypt should return legacy plaintext as-is, got %q", result)
	}
}

func TestNoDoubleEncrypt(t *testing.T) {
	setTestKey(t)

	plain := "test data"
	first := Encrypt(plain)
	second := Encrypt(first)

	if first != second {
		t.Error("double encryption should be prevented")
	}

	decrypted := Decrypt(second)
	if decrypted != plain {
		t.Errorf("decrypted = %q, want %q", decrypted, plain)
	}
}

func TestEncryptWithoutKey(t *testing.T) {
	resetKeyState()
	os.Unsetenv(EnvKey)
	t.Cleanup(func() { resetKeyState() })

	plain := "no key set"
	result := Encrypt(plain)
	if result != plain {
		t.Errorf("without key, Encrypt should return plaintext, got %q", result)
	}
}

func TestRandomNonce(t *testing.T) {
	setTestKey(t)

	plain := "same input"
	enc1 := Encrypt(plain)
	enc2 := Encrypt(plain)

	if enc1 == enc2 {
		t.Error("two encryptions of same plaintext should produce different ciphertext (random nonce)")
	}

	// Both should decrypt to same value
	if Decrypt(enc1) != plain || Decrypt(enc2) != plain {
		t.Error("both ciphertexts should decrypt to original plaintext")
	}
}

func TestHash(t *testing.T) {
	h1 := Hash("test")
	h2 := Hash("test")
	h3 := Hash("other")

	if h1 != h2 {
		t.Error("Hash should be deterministic")
	}
	if h1 == h3 {
		t.Error("different inputs should produce different hashes")
	}
	if len(h1) != 64 {
		t.Errorf("SHA-256 hex should be 64 chars, got %d", len(h1))
	}
}

func TestEnabled(t *testing.T) {
	resetKeyState()
	os.Unsetenv(EnvKey)
	defer resetKeyState()

	if Enabled() {
		t.Error("should not be enabled without key")
	}

	resetKeyState()
	os.Setenv(EnvKey, "short-key-will-be-hashed")
	defer os.Unsetenv(EnvKey)

	if !Enabled() {
		t.Error("should be enabled with any key")
	}
}

func TestMustEncrypt(t *testing.T) {
	// Without key
	resetKeyState()
	os.Unsetenv(EnvKey)

	_, err := MustEncrypt("test")
	if err == nil {
		t.Error("MustEncrypt should error without key")
	}

	// With key
	setTestKey(t)
	result, err := MustEncrypt("test")
	if err != nil {
		t.Errorf("MustEncrypt should succeed with key: %v", err)
	}
	if !IsEncrypted(result) {
		t.Error("MustEncrypt result should be encrypted")
	}
}
