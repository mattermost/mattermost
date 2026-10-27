// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Test vectors derived from github.com/dgryski/dgoogauth (Apache License, Version 2.0), which in turn
// takes them from the Google Authenticator PAM module.

package mfa

import (
	"encoding/hex"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testSecret is the base32 encoding of the RFC 4226 key, 20 bytes like the secrets that are generated. The FIPS
// provider rejects HMAC keys shorter than 14 bytes.
const testSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

func TestComputeCode(t *testing.T) {
	for _, v := range []struct {
		value int64
		code  int
	}{
		{1, 287082},
		{5, 254676},
		{10000, 918118},
	} {
		assert.Equal(t, v.code, ComputeCode(testSecret, v.value), "value %d", v.value)
	}

	assert.Equal(t, -1, ComputeCode("not base32!", 1))
}

func TestCheckCodeWindow(t *testing.T) {
	cfg := &totpConfig{Secret: testSecret, WindowSize: 5}

	for _, s := range []struct {
		t0     int
		result bool
	}{
		{9997, false},
		{9998, true},
		{9999, true},
		{10000, true},
		{10001, true},
		{10002, true},
		{10003, false},
	} {
		ok, err := cfg.checkCode(s.t0, 918118)
		require.NoError(t, err)
		assert.Equal(t, s.result, ok, "t0 %d", s.t0)
	}
}

func TestCheckCodeDisallowReuse(t *testing.T) {
	cfg := &totpConfig{Secret: testSecret, WindowSize: 5, DisallowReuse: []int{}}

	for i, s := range []struct {
		code       int
		t0         int
		result     bool
		disallowed []int
	}{
		{918118, 9997, false, []int{}},
		{918118, 9998, true, []int{10000}},
		{918118, 9999, false, []int{10000}},
		{492946, 10001, true, []int{10000, 10001}},
		{824428, 10002, true, []int{10000, 10001, 10002}},
		{204412, 10003, true, []int{10001, 10002, 10003}},
	} {
		ok, err := cfg.checkCode(s.t0, s.code)
		require.NoError(t, err)
		assert.Equal(t, s.result, ok, "step %d", i)
		assert.Equal(t, s.disallowed, cfg.DisallowReuse, "step %d", i)
	}
}

func TestAuthenticate(t *testing.T) {
	cfg := &totpConfig{Secret: testSecret, WindowSize: 3}

	for _, bad := range []string{"foobar", "1fooba", "1111111", "", "0123456789"} {
		ok, err := cfg.authenticate(bad)
		require.ErrorIs(t, err, errInvalidCode, bad)
		assert.False(t, ok, bad)
	}

	// 8-digit scratch codes are not supported
	ok, err := cfg.authenticate("11112222")
	require.NoError(t, err)
	assert.False(t, ok)

	code := fmt.Sprintf("%06d", ComputeCode(testSecret, time.Now().Unix()/30))

	// a wrong code of the right length is rejected without an error
	wrong := fmt.Sprintf("%06d", (ComputeCode(testSecret, time.Now().Unix()/30)+1000)%1000000)
	ok, err = cfg.authenticate(wrong)
	require.NoError(t, err)
	assert.False(t, ok)

	ok, err = cfg.authenticate(code + "1")
	require.ErrorIs(t, err, errInvalidCode)
	assert.False(t, ok)

	ok, err = cfg.authenticate(code)
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestHMACSHA1(t *testing.T) {
	// RFC 2202 test case 2, and the RFC 4226 appendix D key.
	for _, v := range []struct {
		key, msg []byte
		mac      string
	}{
		{[]byte("Jefe"), []byte("what do ya want for nothing?"), "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79"},
		{[]byte("12345678901234567890"), []byte{0, 0, 0, 0, 0, 0, 0, 1}, "75a48a19d4cbe100644e8ac1397eea747a2d33ab"},
	} {
		// The FIPS provider rejects keys shorter than 112 bits.
		mac, err := hmacSHA1(v.key, v.msg)
		if len(v.key) < 14 && fipsBuild {
			require.Error(t, err)
			continue
		}
		require.NoError(t, err)
		assert.Equal(t, v.mac, hex.EncodeToString(mac))
	}

	_, err := hmacSHA1(nil, []byte("message"))
	assert.ErrorIs(t, err, errEmptyKey)
}

// RFC 6238 appendix B, HMAC-SHA1 with 8 digits, truncated here to the 6 digits the codes use.
func TestComputeCodeRFC6238(t *testing.T) {
	const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" // base32 of "12345678901234567890"

	for _, v := range []struct {
		unix int64
		code int
	}{
		{59, 287082},
		{1111111109, 81804},
		{1111111111, 50471},
		{1234567890, 5924},
		{2000000000, 279037},
	} {
		assert.Equal(t, v.code, ComputeCode(secret, v.unix/30), "time %d", v.unix)
	}
}

func TestComputeCodeConcurrent(t *testing.T) {
	var wg sync.WaitGroup
	for range 16 {
		wg.Go(func() {
			for range 500 {
				assert.Equal(t, 287082, ComputeCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1))
			}
		})
	}
	wg.Wait()
}
