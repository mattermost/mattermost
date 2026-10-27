// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !requirefips

package mfa

import (
	"crypto/hmac"
	"crypto/sha1"
)

// hmacSHA1 is the non-FIPS implementation: plain crypto/hmac, no cgo.
func hmacSHA1(key, msg []byte) ([]byte, error) {
	if len(key) == 0 {
		return nil, errEmptyKey
	}
	h := hmac.New(sha1.New, key)
	h.Write(msg)
	return h.Sum(nil), nil
}
