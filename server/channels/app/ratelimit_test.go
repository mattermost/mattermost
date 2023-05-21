// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func genRateLimitSettings(useAuth, useIP bool, header string) *model.RateLimitSettings {
	return &model.RateLimitSettings{
		Enable:           model.NewBool(true),
		PerSec:           model.NewInt(10),
		MaxBurst:         model.NewInt(100),
		MemoryStoreSize:  model.NewInt(10000),
		VaryByRemoteAddr: model.NewBool(useIP),
		VaryByUser:       model.NewBool(useAuth),
		VaryByHeader:     header,
	}
}

func TestNewRateLimiterSuccess(t *testing.T) {
	settings := genRateLimitSettings(false, false, "")
	rateLimiter, err := NewRateLimiter(settings, nil)
	require.NotNil(t, rateLimiter)
	require.NoError(t, err)

	rateLimiter, err = NewRateLimiter(settings, []string{"X-Forwarded-For"})
	require.NotNil(t, rateLimiter)
	require.NoError(t, err)
}

func TestNewRateLimiterFailure(t *testing.T) {
	invalidSettings := genRateLimitSettings(false, false, "")
	invalidSettings.MaxBurst = model.NewInt(-100)
	rateLimiter, err := NewRateLimiter(invalidSettings, nil)
	require.Nil(t, rateLimiter)
	require.Error(t, err)

	rateLimiter, err = NewRateLimiter(invalidSettings, []string{"X-Forwarded-For", "X-Real-Ip"})
	require.Nil(t, rateLimiter)
	require.Error(t, err)
}

func TestGenerateKey(t *testing.T) {
	cases := []struct {
		useAuth         bool
		useIP           bool
		header          string
		authTokenResult string
		ipResult        string
		headerResult    string
		expectedKey     string
	}{
		{false, false, "", "", "", "", ""},
		{true, false, "", "resultkey", "notme", "notme", "resultkey"},
		{false, true, "", "notme", "resultkey", "notme", "resultkey"},
		{false, false, "myheader", "notme", "notme", "resultkey", "resultkey"},
		{true, true, "", "resultkey", "ipaddr", "notme", "resultkey"},
		{true, true, "", "", "ipaddr", "notme", "ipaddr"},
		{true, true, "myheader", "resultkey", "ipaddr", "hadd", "resultkeyhadd"},
		{true, true, "myheader", "", "ipaddr", "hadd", "ipaddrhadd"},
	}

	for testnum, tc := range cases {
		req := httptest.NewRequest("GET", "/", nil)
		if tc.authTokenResult != "" {
			req.AddCookie(&http.Cookie{
				Name:  model.SessionCookieToken,
				Value: tc.authTokenResult,
			})
		}
		req.RemoteAddr = tc.ipResult + ":80"
		if tc.headerResult != "" {
			req.Header.Set(tc.header, tc.headerResult)
		}

		rateLimiter, _ := NewRateLimiter(genRateLimitSettings(tc.useAuth, tc.useIP, tc.header), nil)

		key := rateLimiter.GenerateKey(req)

		require.Equal(t, tc.expectedKey, key, "Wrong key on test "+strconv.Itoa(testnum))
	}
}

func TestGenerateKey_TrustedHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "10.10.10.5:80"
	req.Header.Set("X-Forwarded-For", "10.6.3.1, 10.5.1.2")

	rateLimiter, _ := NewRateLimiter(genRateLimitSettings(true, true, ""), []string{"X-Forwarded-For"})
	key := rateLimiter.GenerateKey(req)
	require.Equal(t, "10.6.3.1", key, "Wrong key on test with allowed trusted proxy header")

	rateLimiter, _ = NewRateLimiter(genRateLimitSettings(true, true, ""), nil)
	key = rateLimiter.GenerateKey(req)
	require.Equal(t, "10.10.10.5", key, "Wrong key on test without allowed trusted proxy header")
}
