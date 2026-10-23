// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mfa

import (
	"crypto/fips140"

	"github.com/dgryski/dgoogauth"
)

// TOTP (RFC 6238) is HMAC-SHA1, which Go's FIPS 140-only mode rejects. The Chainguard toolchain also
// enforces that under fips140=on (the Microsoft fork only does under fips140=only), so it panics. All
// dgoogauth calls go through the helpers below, which lift the enforcement for the call and so use Go's
// own crypto instead of OpenSSL. Do not call dgoogauth directly.

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
