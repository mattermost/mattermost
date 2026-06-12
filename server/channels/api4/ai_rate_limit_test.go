// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// newRateLimitTestContext builds a minimal *Context wrapper around an
// EmptyContext so checkAIRateLimit can run without the full API setup.
func newRateLimitTestContext(t *testing.T) *Context {
	t.Helper()
	return &Context{
		AppContext: request.EmptyContext(mlog.CreateConsoleTestLogger(t)),
	}
}

func TestCheckAIRateLimit_AllowsUnderBurst(t *testing.T) {
	c := newRateLimitTestContext(t)
	w := httptest.NewRecorder()
	// Unique user/endpoint key per test so the package-level limiter state
	// doesn't leak between tests in the same run.
	user := fmt.Sprintf("user-%s", t.Name())

	endpoint := AIEndpoint(t.Name())
	for i := range aiRateLimitMaxBurst {
		ok := checkAIRateLimit(c, w, user, endpoint)
		require.True(t, ok, "request %d within burst should be allowed", i+1)
		require.Nil(t, c.Err, "no error on allowed request")
	}
}

func TestCheckAIRateLimit_BlocksOverBurst(t *testing.T) {
	user := fmt.Sprintf("user-%s", t.Name())
	endpoint := AIEndpoint(t.Name())

	var blocked bool
	var blockedAttempt int
	for i := range aiRateLimitMaxBurst * 2 {
		c := newRateLimitTestContext(t)
		w := httptest.NewRecorder()
		ok := checkAIRateLimit(c, w, user, endpoint)
		if !ok {
			blocked = true
			blockedAttempt = i + 1
			require.NotNil(t, c.Err, "blocked request must populate c.Err")
			assert.Equal(t, 429, c.Err.StatusCode)
			assert.Equal(t, "api.wiki.ai.rate_limited.app_error", c.Err.Id)
			assert.NotEmpty(t, w.Header().Get("Retry-After"), "Retry-After header must be set when limited")
			break
		}
	}
	require.True(t, blocked, "limiter should block at least one request within 2x burst")
	assert.LessOrEqual(t, blockedAttempt, aiRateLimitMaxBurst*2)
}

func TestCheckAIRateLimit_IsolatedPerUser(t *testing.T) {
	endpoint := AIEndpoint(t.Name())
	userA := "A-" + t.Name()
	userB := "B-" + t.Name()

	// Exhaust userA's burst.
	for range aiRateLimitMaxBurst * 2 {
		c := newRateLimitTestContext(t)
		w := httptest.NewRecorder()
		if !checkAIRateLimit(c, w, userA, endpoint) {
			break
		}
	}

	// userB should still be admitted immediately on first call.
	c := newRateLimitTestContext(t)
	w := httptest.NewRecorder()
	ok := checkAIRateLimit(c, w, userB, endpoint)
	assert.True(t, ok, "userB must not share userA's bucket")
	assert.Nil(t, c.Err)
}
