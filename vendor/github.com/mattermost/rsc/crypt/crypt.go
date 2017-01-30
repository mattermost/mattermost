// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package crypt provides simple, password-based encryption and decryption of data blobs.
package crypt

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"fmt"
	"io"

	"code.google.com/p/go.crypto/pbkdf2"
)

// This program manipulates encrypted, signed packets with the following format:
//	1 byte version
//	8 byte salt
//	4 byte key hash
//	aes.BlockSize-byte IV
//	aes.BlockSize-byte encryption (maybe longer)
//	sha1.Size-byte HMAC signature

const version = 0

// deriveKey returns the AES key, HMAC-SHA1 key, and key hash for
// the given password, salt combination.
func deriveKey(password string, salt []byte) (aesKey, hmacKey, keyHash []byte) {
	const keySize = 16
	key := pbkdf2.Key([]byte(password), salt, 4096, 2*keySize, sha1.New)
	aesKey = key[:keySize]
	hmacKey = key[keySize:]
	h := sha1.New()
	h.Write(key)
	keyHash = h.Sum(nil)[:4]
	return
}

// Encrypt encrypts the plaintext into an encrypted packet
// using the given password. The password is required for
// decryption.
func Encrypt(password string, plaintext []byte) (encrypted []byte, err error) {
	// Derive key material from password and salt.
	salt := make([]byte, 8)
	_, err = io.ReadFull(rand.Reader, salt)
	if err != nil {
		return nil, err
	}
	aesKey, hmacKey, keyHash := deriveKey(password, salt)

	// Pad.
	n := aes.BlockSize - len(plaintext)%aes.BlockSize
	dec := make([]byte, len(plaintext)+n)
	copy(dec, plaintext)
	for i := len(plaintext); i < len(dec); i++ {
		dec[i] = byte(n)
	}

	// Encrypt.
	iv := make([]byte, aes.BlockSize)
	_, err = io.ReadFull(rand.Reader, iv)
	if err != nil {
		return nil, err
	}
	aesBlock, err := aes.NewCipher(aesKey)
	if err != nil {
		// Cannot happen - key is right size.
		panic("aes: " + err.Error())
	}
	m := cipher.NewCBCEncrypter(aesBlock, iv)
	enc := make([]byte, len(dec))
	m.CryptBlocks(enc, dec)

	// Construct packet.
	var pkt []byte
	pkt = append(pkt, version)
	pkt = append(pkt, salt...)
	pkt = append(pkt, keyHash...)
	pkt = append(pkt, iv...)
	pkt = append(pkt, enc...)

	// Sign.
	h := hmac.New(sha1.New, hmacKey)
	h.Write(pkt)
	pkt = append(pkt, h.Sum(nil)...)

	return pkt, nil
}

// Decrypt decrypts the encrypted packet using the given password.
// It returns the decrypted data.
func Decrypt(password string, encrypted []byte) (plaintext []byte, err error) {
	// Pull apart packet.
	pkt := encrypted
	if len(pkt) < 1+8+4+2*aes.BlockSize+sha1.Size {
		return nil, fmt.Errorf("encrypted packet too short")
	}
	vers, pkt := pkt[:1], pkt[1:]
	salt, pkt := pkt[:8], pkt[8:]
	hash, pkt := pkt[:4], pkt[4:]
	iv, pkt := pkt[:aes.BlockSize], pkt[aes.BlockSize:]
	enc, sig := pkt[:len(pkt)-sha1.Size], pkt[len(pkt)-sha1.Size:]

	if vers[0] != version || len(enc)%aes.BlockSize != 0 {
		return nil, fmt.Errorf("malformed encrypted packet")
	}

	// Derive key and check against hash.
	aesKey, hmacKey, keyHash := deriveKey(password, salt)
	if !bytes.Equal(hash, keyHash) {
		return nil, fmt.Errorf("incorrect password - %x vs %x", hash, keyHash)
	}

	// Verify signature.
	h := hmac.New(sha1.New, hmacKey)
	h.Write(encrypted[:len(encrypted)-len(sig)])
	if !bytes.Equal(sig, h.Sum(nil)) {
		return nil, fmt.Errorf("cannot authenticate encrypted packet")
	}

	// Decrypt.
	aesBlock, err := aes.NewCipher(aesKey)
	if err != nil {
		// Cannot happen - key is right size.
		panic("aes: " + err.Error())
	}
	m := cipher.NewCBCDecrypter(aesBlock, iv)
	dec := make([]byte, len(enc))
	m.CryptBlocks(dec, enc)

	// Unpad.
	pad := dec[len(dec)-1]
	if pad <= 0 || pad > aes.BlockSize {
		return nil, fmt.Errorf("malformed packet padding")
	}
	for _, b := range dec[len(dec)-int(pad):] {
		if b != pad {
			return nil, fmt.Errorf("malformed packet padding")
		}
	}
	dec = dec[:len(dec)-int(pad)]

	// Success!
	return dec, nil
}
