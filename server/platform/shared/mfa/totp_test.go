// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Test vectors derived from github.com/dgryski/dgoogauth (Apache License, Version 2.0), which in turn
// takes them from the Google Authenticator PAM module.

package mfa

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSecret = "2SH3V3GDW7ZNMGYE"

func TestComputeCode(t *testing.T) {
	for _, v := range []struct {
		value int64
		code  int
	}{
		{1, 293240},
		{5, 932068},
		{10000, 50548},
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
		assert.Equal(t, s.result, cfg.checkCode(s.t0, 50548), "t0 %d", s.t0)
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
		{50548, 9997, false, []int{}},
		{50548, 9998, true, []int{10000}},
		{50548, 9999, false, []int{10000}},
		{478726, 10001, true, []int{10000, 10001}},
		{646986, 10002, true, []int{10000, 10001, 10002}},
		{842639, 10003, true, []int{10001, 10002, 10003}},
	} {
		assert.Equal(t, s.result, cfg.checkCode(s.t0, s.code), "step %d", i)
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
