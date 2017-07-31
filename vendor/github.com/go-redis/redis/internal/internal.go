package internal

import (
	"math/rand"
	"time"
)

const retryBackoff = 8 * time.Millisecond

// Retry backoff with jitter sleep to prevent overloaded conditions during intervals
// https://www.awsarchitectureblog.com/2015/03/backoff.html
func RetryBackoff(retry int, maxRetryBackoff time.Duration) time.Duration {
	if retry < 0 {
		retry = 0
	}

	backoff := retryBackoff << uint(retry)
	if backoff > maxRetryBackoff {
		backoff = maxRetryBackoff
	}

	return time.Duration(rand.Int63n(int64(backoff)))
}
