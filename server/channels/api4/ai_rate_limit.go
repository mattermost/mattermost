// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"math"
	"net/http"
	"strconv"
	"sync"

	"github.com/throttled/throttled/v2"
	"github.com/throttled/throttled/v2/store/memstore"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// aiPerUserRateLimiter throttles AI-backed endpoints (page image extraction,
// thread summarization) on a per-user basis so a single authenticated user
// cannot burst thousands of LLM/vision calls at zero cost to them but
// non-trivial cost to the operator. Default: 60 requests/min, burst 10.
//
// The limiter is package-scoped rather than per-request so the token bucket
// persists across handler invocations. It is lazily initialized on first use.
// In an HA cluster every node runs its own in-memory limiter independently;
// the effective steady-state rate is aiRateLimitPerMinute × node_count and
// the effective burst is aiRateLimitMaxBurst × node_count. If cost attacks
// from burst multiplication become a concern, replace memstore with Redis.
var (
	aiPerUserRateLimiter     *throttled.GCRARateLimiterCtx
	aiPerUserRateLimiterOnce sync.Once
	aiPerUserRateLimiterErr  error
)

const (
	aiRateLimitPerMinute = 60
	aiRateLimitMaxBurst  = 10
	// aiRateLimitMemSize is the LRU cap (entries, not users); old buckets
	// evict automatically so unused users do not accumulate forever.
	aiRateLimitMemSize = 65536
)

// AIEndpoint identifies an AI-backed endpoint for per-user rate limiting.
// Using a distinct type prevents accidental key collisions with free-form strings.
type AIEndpoint string

const (
	AIEndpointExtractPageImageText  AIEndpoint = "extract_page_image_text"
	AIEndpointSummarizeThreadToPage AIEndpoint = "summarize_thread_to_page"
)

func aiRateLimitBucketKey(endpoint AIEndpoint, userID string) string {
	return string(endpoint) + ":" + userID
}

func getAIPerUserRateLimiter() (*throttled.GCRARateLimiterCtx, error) {
	// sync.Once permanently seals any init failure: if memstore or GCRA setup
	// fails, all subsequent calls return nil+err and checkAIRateLimit fails open
	// (allows the request). This is intentional — a broken rate-limiter should
	// not take down the feature for the lifetime of the process.
	aiPerUserRateLimiterOnce.Do(func() {
		store, err := memstore.NewCtx(aiRateLimitMemSize)
		if err != nil {
			aiPerUserRateLimiterErr = err
			mlog.Error("Failed to initialize AI rate limiter store", mlog.Err(err))
			return
		}
		quota := throttled.RateQuota{
			MaxRate:  throttled.PerMin(aiRateLimitPerMinute),
			MaxBurst: aiRateLimitMaxBurst,
		}
		aiPerUserRateLimiter, aiPerUserRateLimiterErr = throttled.NewGCRARateLimiterCtx(store, quota)
		if aiPerUserRateLimiterErr != nil {
			mlog.Error("Failed to initialize AI rate limiter", mlog.Err(aiPerUserRateLimiterErr))
		}
	})
	return aiPerUserRateLimiter, aiPerUserRateLimiterErr
}

// checkAIRateLimit returns true if the request should proceed, false if the
// caller has exceeded their AI-endpoint quota. On limit hit, sets c.Err with a
// 429 and populates Retry-After.
func checkAIRateLimit(c *Context, w http.ResponseWriter, userID string, endpoint AIEndpoint) bool {
	limiter, err := getAIPerUserRateLimiter()
	if err != nil || limiter == nil {
		// Rate limiter init failure is not a reason to deny the request;
		// fail open so a broken memstore doesn't take down the feature.
		c.Logger.Error("AI rate limiter unavailable, allowing request")
		return true
	}
	key := aiRateLimitBucketKey(endpoint, userID)
	limited, result, rlErr := limiter.RateLimitCtx(c.AppContext.Context(), key, 1)
	if rlErr != nil {
		c.Logger.Warn("AI rate limiter check failed, allowing request", mlog.Err(rlErr))
		return true
	}
	if limited {
		if result.RetryAfter > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(result.RetryAfter.Seconds()))))
		}
		c.Err = model.NewAppError("aiRateLimit", "api.wiki.ai.rate_limited.app_error",
			nil, "", http.StatusTooManyRequests)
		return false
	}
	return true
}
