// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file is derived from github.com/dgryski/dgoogauth (Copyright Damian Gryski, licensed under the
// Apache License, Version 2.0, http://www.apache.org/licenses/LICENSE-2.0), reduced to the time-based
// (TOTP, RFC 6238) code path that Mattermost uses.

package mfa

import (
	"encoding/base32"
	"encoding/binary"
	"errors"
	"slices"
	"sort"
	"strconv"
	"time"
)

// errInvalidCode indicates the supplied one-time code was not well formed.
var errInvalidCode = errors.New("invalid code")

var errEmptyKey = errors.New("empty HMAC key")

// totpConfig is a time-based one-time-password configuration. It is modified by authenticate, and
// DisallowReuse must be persisted so that a code is only accepted once.
type totpConfig struct {
	Secret        string // base32 encoded string of the user's secret
	WindowSize    int    // number of 30-second steps accepted around the current one
	DisallowReuse []int  // time steps in the current window unavailable for re-use
}

// computeCode returns the 6-digit TOTP code (RFC 4226 and RFC 6238) of the secret for the given 30-second
// time step. The HMAC-SHA1 is computed by hmacSHA1, which FIPS builds run in the OpenSSL FIPS provider.
func computeCode(secret string, value int64) (int, error) {
	key, err := base32.StdEncoding.DecodeString(secret)
	if err != nil {
		return 0, errors.New("invalid base32 secret")
	}

	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(value))

	h, err := hmacSHA1(key, msg[:])
	if err != nil {
		return 0, err
	}

	offset := h[len(h)-1] & 0x0f
	truncated := binary.BigEndian.Uint32(h[offset:offset+4]) & 0x7fffffff

	return int(truncated % 1000000), nil
}

// ComputeCode returns the TOTP code of the secret for the given 30-second time step, or -1 when it cannot
// be computed, which never matches a code. It is meant for tests.
func ComputeCode(secret string, value int64) int {
	code, err := computeCode(secret, value)
	if err != nil {
		return -1
	}
	return code
}

func (c *totpConfig) checkCode(t0, code int) (bool, error) {
	minT := t0 - (c.WindowSize / 2)
	maxT := t0 + (c.WindowSize / 2)
	for t := minT; t <= maxT; t++ {
		candidate, err := computeCode(c.Secret, int64(t))
		if err != nil {
			return false, err
		}
		if candidate != code {
			continue
		}

		if c.DisallowReuse != nil {
			if slices.Contains(c.DisallowReuse, t) {
				return false, nil
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

		return true, nil
	}

	return false, nil
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

	return c.checkCode(int(time.Now().Unix()/30), code)
}
