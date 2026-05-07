// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func genRateLimitSettings(useAuth, useIP bool, header string) *model.RateLimitSettings {
	return &model.RateLimitSettings{
		Enable:           model.NewPointer(true),
		PerSec:           model.NewPointer(10),
		MaxBurst:         model.NewPointer(100),
		MemoryStoreSize:  model.NewPointer(10000),
		VaryByRemoteAddr: model.NewPointer(useIP),
		VaryByUser:       model.NewPointer(useAuth),
		VaryByHeader:     header,
	}
}

func TestNewRateLimiterSuccess(t *testing.T) {
	mainHelper.Parallel(t)
	settings := genRateLimitSettings(false, false, "")
	rateLimiter, err := NewRateLimiter(settings, nil)
	require.NotNil(t, rateLimiter)
	require.NoError(t, err)

	rateLimiter, err = NewRateLimiter(settings, []string{"X-Forwarded-For"})
	require.NotNil(t, rateLimiter)
	require.NoError(t, err)
}

func TestNewRateLimiterFailure(t *testing.T) {
	mainHelper.Parallel(t)
	invalidSettings := genRateLimitSettings(false, false, "")
	invalidSettings.MaxBurst = model.NewPointer(-100)
	rateLimiter, err := NewRateLimiter(invalidSettings, nil)
	require.Nil(t, rateLimiter)
	require.Error(t, err)

	rateLimiter, err = NewRateLimiter(invalidSettings, []string{"X-Forwarded-For", "X-Real-Ip"})
	require.Nil(t, rateLimiter)
	require.Error(t, err)
}

func TestGenerateKey(t *testing.T) {
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
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

func genRateLimitSettingsWithBurst(useAuth, useIP bool, header string, perSec, maxBurst int) *model.RateLimitSettings {
	return &model.RateLimitSettings{
		Enable:           model.NewPointer(true),
		PerSec:           model.NewPointer(perSec),
		MaxBurst:         model.NewPointer(maxBurst),
		MemoryStoreSize:  model.NewPointer(10000),
		VaryByRemoteAddr: model.NewPointer(useIP),
		VaryByUser:       model.NewPointer(useAuth),
		VaryByHeader:     header,
	}
}

func TestRateLimitWriter(t *testing.T) {
	mainHelper.Parallel(t)

	// PerSec=1, MaxBurst=2 → effective limit of 3 (burst + 1)
	settings := genRateLimitSettingsWithBurst(false, false, "", 1, 2)
	rl, err := NewRateLimiter(settings, nil)
	require.NoError(t, err)

	t.Run("requests within burst succeed", func(t *testing.T) {
		for i := range 3 {
			w := httptest.NewRecorder()
			limited := rl.RateLimitWriter(context.Background(), "test-key", w)
			require.False(t, limited, "request %d should not be rate limited", i)

			assert.Equal(t, "3", w.Header().Get("X-RateLimit-Limit"))
			assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
			assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"))
		}
	})

	t.Run("request exceeding burst is rate limited", func(t *testing.T) {
		w := httptest.NewRecorder()
		limited := rl.RateLimitWriter(context.Background(), "test-key", w)
		require.True(t, limited)

		assert.Equal(t, http.StatusTooManyRequests, w.Code)
		retryAfter, convErr := strconv.Atoi(w.Header().Get("Retry-After"))
		require.NoError(t, convErr)
		assert.Greater(t, retryAfter, 0)

		body, readErr := io.ReadAll(w.Body)
		require.NoError(t, readErr)
		assert.Contains(t, string(body), "limit exceeded")
	})

	t.Run("different keys are independent", func(t *testing.T) {
		w := httptest.NewRecorder()
		limited := rl.RateLimitWriter(context.Background(), "different-key", w)
		require.False(t, limited)
	})
}

func TestUserIdRateLimit(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("useAuth true rate limits by userId", func(t *testing.T) {
		// PerSec=1, MaxBurst=1 → effective limit of 2
		settings := genRateLimitSettingsWithBurst(true, false, "", 1, 1)
		rl, err := NewRateLimiter(settings, nil)
		require.NoError(t, err)

		for i := range 2 {
			w := httptest.NewRecorder()
			limited := rl.UserIdRateLimit(context.Background(), "user-A", w)
			require.False(t, limited, "request %d should not be rate limited", i)
		}

		// 3rd request should be limited
		w := httptest.NewRecorder()
		limited := rl.UserIdRateLimit(context.Background(), "user-A", w)
		require.True(t, limited)
		assert.Equal(t, http.StatusTooManyRequests, w.Code)

		// Different userId should not be limited
		w = httptest.NewRecorder()
		limited = rl.UserIdRateLimit(context.Background(), "user-B", w)
		require.False(t, limited)
	})

	t.Run("useAuth false never rate limits", func(t *testing.T) {
		settings := genRateLimitSettingsWithBurst(false, false, "", 1, 0)
		rl, err := NewRateLimiter(settings, nil)
		require.NoError(t, err)

		for i := range 5 {
			w := httptest.NewRecorder()
			limited := rl.UserIdRateLimit(context.Background(), "any-user", w)
			require.False(t, limited, "call %d should not be rate limited when useAuth=false", i)
		}
	})
}

func TestRateLimitHandler(t *testing.T) {
	mainHelper.Parallel(t)

	// PerSec=1, MaxBurst=1, VaryByRemoteAddr=true → effective limit of 2
	settings := genRateLimitSettingsWithBurst(false, true, "", 1, 1)
	rl, err := NewRateLimiter(settings, nil)
	require.NoError(t, err)

	var handlerCalled bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	})

	handler := rl.RateLimitHandler(inner)

	t.Run("requests within limit call inner handler", func(t *testing.T) {
		for i := range 2 {
			handlerCalled = false
			req := httptest.NewRequest("GET", "/", nil)
			req.RemoteAddr = "192.168.1.1:1234"
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			called := handlerCalled
			require.True(t, called, "inner handler should be called on request %d", i)
			assert.Equal(t, http.StatusOK, w.Code)
		}
	})

	t.Run("exceeding limit blocks inner handler", func(t *testing.T) {
		handlerCalled = false
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "192.168.1.1:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		called := handlerCalled
		require.False(t, called, "inner handler should not be called when rate limited")
		assert.Equal(t, http.StatusTooManyRequests, w.Code)
	})

	t.Run("different IP is independent", func(t *testing.T) {
		handlerCalled = false
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		called := handlerCalled
		require.True(t, called, "inner handler should be called for a different IP")
		assert.Equal(t, http.StatusOK, w.Code)
	})
}
