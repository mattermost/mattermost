// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestRateLimitingMiddleware(t *testing.T) {
	mainHelper.Parallel(t)

	// Enable=true, PerSec=1, MaxBurst=2, VaryByRemoteAddr=true
	// Effective limit: MaxBurst + 1 = 3
	th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
		*cfg.RateLimitSettings.Enable = true
		*cfg.RateLimitSettings.PerSec = 1
		*cfg.RateLimitSettings.MaxBurst = 2
		*cfg.RateLimitSettings.VaryByRemoteAddr = true
		*cfg.RateLimitSettings.VaryByUser = false
		cfg.RateLimitSettings.VaryByHeader = ""
	})
	licenseStore := storemocks.LicenseStore{}
	licenseStore.On("Get", "").Return(&model.LicenseRecord{}, nil)
	th.App.Srv().Store().(*storemocks.Store).On("License").Return(&licenseStore)

	port := th.App.Srv().ListenAddr.Port
	url := fmt.Sprintf("http://localhost:%v/api/v4/system/ping", port)
	client := &http.Client{}

	t.Run("requests within burst succeed", func(t *testing.T) {
		for i := range 3 {
			req, err := http.NewRequest("GET", url, nil)
			require.NoError(t, err)

			resp, err := client.Do(req)
			require.NoError(t, err)
			resp.Body.Close()

			assert.Equal(t, http.StatusOK, resp.StatusCode, "request %d should succeed", i)
			assert.Equal(t, "3", resp.Header.Get("X-RateLimit-Limit"))
			assert.NotEmpty(t, resp.Header.Get("X-RateLimit-Remaining"))
			assert.NotEmpty(t, resp.Header.Get("X-RateLimit-Reset"))
		}
	})

	t.Run("exceeding burst returns 429", func(t *testing.T) {
		req, err := http.NewRequest("GET", url, nil)
		require.NoError(t, err)

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)

		retryAfter, convErr := strconv.Atoi(resp.Header.Get("Retry-After"))
		require.NoError(t, convErr)
		assert.Greater(t, retryAfter, 0)

		body, readErr := io.ReadAll(resp.Body)
		require.NoError(t, readErr)
		assert.Contains(t, string(body), "limit exceeded")
	})
}

func TestRateLimitingVaryByHeader(t *testing.T) {
	mainHelper.Parallel(t)

	// VaryByRemoteAddr=false, VaryByUser=false, VaryByHeader="X-Custom-Key"
	// PerSec=1, MaxBurst=1 → effective limit of 2
	th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
		*cfg.RateLimitSettings.Enable = true
		*cfg.RateLimitSettings.PerSec = 1
		*cfg.RateLimitSettings.MaxBurst = 1
		*cfg.RateLimitSettings.VaryByRemoteAddr = false
		*cfg.RateLimitSettings.VaryByUser = false
		cfg.RateLimitSettings.VaryByHeader = "X-Custom-Key"
	})
	licenseStore := storemocks.LicenseStore{}
	licenseStore.On("Get", "").Return(&model.LicenseRecord{}, nil)
	th.App.Srv().Store().(*storemocks.Store).On("License").Return(&licenseStore)

	port := th.App.Srv().ListenAddr.Port
	url := fmt.Sprintf("http://localhost:%v/api/v4/system/ping", port)
	client := &http.Client{}

	// 2 requests with client-A should succeed
	for i := range 2 {
		req, err := http.NewRequest("GET", url, nil)
		require.NoError(t, err)
		req.Header.Set("X-Custom-Key", "client-A")

		resp, err := client.Do(req)
		require.NoError(t, err)
		resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode, "client-A request %d should succeed", i)
	}

	// 3rd request with client-A should be rate limited
	t.Run("same header value is rate limited", func(t *testing.T) {
		req, err := http.NewRequest("GET", url, nil)
		require.NoError(t, err)
		req.Header.Set("X-Custom-Key", "client-A")

		resp, err := client.Do(req)
		require.NoError(t, err)
		resp.Body.Close()

		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	})

	// Request with client-B should succeed (separate bucket)
	t.Run("different header value is independent", func(t *testing.T) {
		req, err := http.NewRequest("GET", url, nil)
		require.NoError(t, err)
		req.Header.Set("X-Custom-Key", "client-B")

		resp, err := client.Do(req)
		require.NoError(t, err)
		resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestRateLimitingVaryByUser(t *testing.T) {
	mainHelper.Parallel(t)

	// Use real database so sessions resolve to real user IDs.
	// Setup starts with rate limiting disabled, so InitLogin succeeds.
	th := Setup(t)

	// Install a rate limiter after setup: VaryByUser=true, PerSec=1, MaxBurst=1 → limit of 2
	rl, err := app.NewRateLimiter(&model.RateLimitSettings{
		Enable:           model.NewPointer(true),
		PerSec:           model.NewPointer(1),
		MaxBurst:         model.NewPointer(1),
		MemoryStoreSize:  model.NewPointer(10000),
		VaryByRemoteAddr: model.NewPointer(false),
		VaryByUser:       model.NewPointer(true),
		VaryByHeader:     "",
	}, nil)
	require.NoError(t, err)
	th.App.Srv().RateLimiter = rl

	port := th.App.Srv().ListenAddr.Port
	url := fmt.Sprintf("http://localhost:%v/api/v4/system/ping", port)
	client := &http.Client{}

	userAToken := th.Client.AuthToken
	userBToken := th.SystemAdminClient.AuthToken
	require.NotEmpty(t, userAToken)
	require.NotEmpty(t, userBToken)
	require.NotEqual(t, userAToken, userBToken)

	// 2 requests with user-A token should succeed (limit=2)
	for i := range 2 {
		req, err := http.NewRequest("GET", url, nil)
		require.NoError(t, err)
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+userAToken)

		resp, err := client.Do(req)
		require.NoError(t, err)
		resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode, "user-A request %d should succeed", i)
	}

	// 3rd request with user-A token should be rate limited
	t.Run("same user is rate limited", func(t *testing.T) {
		req, err := http.NewRequest("GET", url, nil)
		require.NoError(t, err)
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+userAToken)

		resp, err := client.Do(req)
		require.NoError(t, err)
		resp.Body.Close()

		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	})

	// Request with user-B token should succeed (separate bucket)
	t.Run("different user is independent", func(t *testing.T) {
		req, err := http.NewRequest("GET", url, nil)
		require.NoError(t, err)
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+userBToken)

		resp, err := client.Do(req)
		require.NoError(t, err)
		resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
