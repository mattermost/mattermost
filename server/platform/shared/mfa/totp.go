// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file is derived from github.com/dgryski/dgoogauth (Copyright Damian Gryski, licensed under the
// Apache License, Version 2.0, http://www.apache.org/licenses/LICENSE-2.0), reduced to the time-based
// (TOTP, RFC 6238) code path that Mattermost uses.

package mfa

import (
	"crypto/fips140"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"errors"
	"slices"
	"sort"
	"strconv"
	"time"
)

// TOTP is defined over HMAC-SHA1, which FIPS 140-only enforcement rejects. The Chainguard Go toolchain
// used for FIPS builds panics on it whenever fips140=on. The HMAC computation is therefore the single
// place that lifts that enforcement, for the duration of the call.

// errInvalidCode indicates the supplied one-time code was not well formed.
var errInvalidCode = errors.New("invalid code")

// totpConfig is a time-based one-time-password configuration. It is modified by authenticate, and
// DisallowReuse must be persisted so that a code is only accepted once.
type totpConfig struct {
	Secret        string // base32 encoded string of the user's secret
	WindowSize    int    // number of 30-second steps accepted around the current one
	DisallowReuse []int  // time steps in the current window unavailable for re-use
}

// ComputeCode returns the 6-digit TOTP code of the secret for the given 30-second time step. It returns
// -1 when the secret is not valid base32, which never matches a code.
func ComputeCode(secret string, value int64) int {
	key, err := base32.StdEncoding.DecodeString(secret)
	if err != nil {
		return -1
	}

	var h []byte
	fips140.WithoutEnforcement(func() {
		hash := hmac.New(sha1.New, key)
		// Writing to an HMAC never fails.
		_ = binary.Write(hash, binary.BigEndian, value)
		h = hash.Sum(nil)
	})

	offset := h[19] & 0x0f
	truncated := binary.BigEndian.Uint32(h[offset:offset+4]) & 0x7fffffff

	return int(truncated % 1000000)
}

func (c *totpConfig) checkCode(t0, code int) bool {
	minT := t0 - (c.WindowSize / 2)
	maxT := t0 + (c.WindowSize / 2)
	for t := minT; t <= maxT; t++ {
		if ComputeCode(c.Secret, int64(t)) != code {
			continue
		}

		if c.DisallowReuse != nil {
			if slices.Contains(c.DisallowReuse, t) {
				return false
			}

			// the code hasn't been used before
			c.DisallowReuse = append(c.DisallowReuse, t)

			// remove all time steps outside of the valid window
			sort.Ints(c.DisallowReuse)
			first := 0
			for c.DisallowReuse[first] < minT {
				first++
			}
			c.DisallowReuse = c.DisallowReuse[first:]
		}

		return true
	}

	return false
}

// authenticate checks a one-time password against the configuration. It returns an error if the password
// is not a zero-padded 6-digit number. The 8-digit scratch codes of the original library are not
// supported, so any 8-digit password is rejected.
func (c *totpConfig) authenticate(password string) (bool, error) {
	var scratch bool
	switch {
	case len(password) == 6 && password[0] >= '0' && password[0] <= '9':
	case len(password) == 8 && password[0] >= '1' && password[0] <= '9':
		scratch = true
	default:
		return false, errInvalidCode
	}

	code, err := strconv.Atoi(password)
	if err != nil {
		return false, errInvalidCode
	}

	if scratch {
		return false, nil
	}

	return c.checkCode(int(time.Now().Unix()/30), code), nil
}
