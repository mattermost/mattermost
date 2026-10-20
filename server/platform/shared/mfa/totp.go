// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mfa

import (
	"crypto/fips140"

	"github.com/dgryski/dgoogauth"
)

// TOTP (RFC 6238) is defined over HMAC-SHA1, which FIPS 140-only enforcement rejects. The Chainguard
// Go toolchain used for FIPS builds panics on it whenever fips140=on. All dgoogauth calls therefore
// go through the helpers below, which lift that enforcement for the duration of the call. Do not
// call dgoogauth directly.

// ComputeCode returns the TOTP code of the secret for the given 30-second time step.
func ComputeCode(secret string, value int64) int {
	var code int
	fips140.WithoutEnforcement(func() {
		code = dgoogauth.ComputeCode(secret, value)
	})
	return code
}

func authenticateOTP(otpConfig *dgoogauth.OTPConfig, token string) (bool, error) {
	var (
		ok  bool
		err error
	)
	fips140.WithoutEnforcement(func() {
		ok, err = otpConfig.Authenticate(token)
	})
	return ok, err
}
