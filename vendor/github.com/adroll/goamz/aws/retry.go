package aws

import (
	"math/rand"
	"net"
	"net/http"
	"time"
)

const (
	maxDelay             = 20 * time.Second
	defaultScale         = 300 * time.Millisecond
	throttlingScale      = 500 * time.Millisecond
	throttlingScaleRange = throttlingScale / 4
	defaultMaxRetries    = 3
	dynamoDBScale        = 25 * time.Millisecond
	dynamoDBMaxRetries   = 10
)

// A RetryPolicy encapsulates a strategy for implementing client retries.
//
// Default implementations are provided which match the AWS SDKs.
type RetryPolicy interface {
	// ShouldRetry returns whether a client should retry a failed request.
	ShouldRetry(target string, r *http.Response, err error, numRetries int) bool

	// Delay returns the time a client should wait before issuing a retry.
	Delay(target string, r *http.Response, err error, numRetries int) time.Duration
}

// DefaultRetryPolicy implements the AWS SDK default retry policy.
//
// It will retry up to 3 times, and uses an exponential backoff with a scale
// factor of 300ms (300ms, 600ms, 1200ms). If the retry is because of
// throttling, the delay will also include some randomness.
//
// See https://github.com/aws/aws-sdk-java/blob/master/aws-java-sdk-core/src/main/java/com/amazonaws/retry/PredefinedRetryPolicies.java#L90.
type DefaultRetryPolicy struct {
}

// ShouldRetry implements the RetryPolicy ShouldRetry method.
func (policy DefaultRetryPolicy) ShouldRetry(target string, r *http.Response, err error, numRetries int) bool {
	return shouldRetry(r, err, numRetries, defaultMaxRetries)
}

// Delay implements the RetryPolicy Delay method.
func (policy DefaultRetryPolicy) Delay(target string, r *http.Response, err error, numRetries int) time.Duration {
	scale := defaultScale
	if err, ok := err.(*Error); ok && isThrottlingException(err) {
		scale = throttlingScale + time.Duration(rand.Int63n(int64(throttlingScaleRange)))
	}
	return exponentialBackoff(numRetries, scale)
}

// DynamoDBRetryPolicy implements the AWS SDK DynamoDB retry policy.
//
// It will retry up to 10 times, and uses an exponential backoff with a scale
// factor of 25ms (25ms, 50ms, 100ms, ...).
//
// See https://github.com/aws/aws-sdk-java/blob/master/aws-java-sdk-core/src/main/java/com/amazonaws/retry/PredefinedRetryPolicies.java#L103.
type DynamoDBRetryPolicy struct {
}

// ShouldRetry implements the RetryPolicy ShouldRetry method.
func (policy DynamoDBRetryPolicy) ShouldRetry(target string, r *http.Response, err error, numRetries int) bool {
	return shouldRetry(r, err, numRetries, dynamoDBMaxRetries)
}

// Delay implements the RetryPolicy Delay method.
func (policy DynamoDBRetryPolicy) Delay(target string, r *http.Response, err error, numRetries int) time.Duration {
	return exponentialBackoff(numRetries, dynamoDBScale)
}

// NeverRetryPolicy never retries requests and returns immediately on failure.
type NeverRetryPolicy struct {
}

// ShouldRetry implements the RetryPolicy ShouldRetry method.
func (policy NeverRetryPolicy) ShouldRetry(target string, r *http.Response, err error, numRetries int) bool {
	return false
}

// Delay implements the RetryPolicy Delay method.
func (policy NeverRetryPolicy) Delay(target string, r *http.Response, err error, numRetries int) time.Duration {
	return time.Duration(0)
}

// shouldRetry determines if we should retry the request.
//
// See http://docs.aws.amazon.com/general/latest/gr/api-retries.html.
func shouldRetry(r *http.Response, err error, numRetries int, maxRetries int) bool {
	// Once we've exceeded the max retry attempts, game over.
	if numRetries >= maxRetries {
		return false
	}

	// Always retry temporary network errors.
	if err, ok := err.(net.Error); ok && err.Temporary() {
		return true
	}

	// Always retry 5xx responses.
	if r != nil && r.StatusCode >= 500 {
		return true
	}

	// Always retry throttling exceptions.
	if err, ok := err.(ServiceError); ok && isThrottlingException(err) {
		return true
	}

	// Other classes of failures indicate a problem with the request. Retrying
	// won't help.
	return false
}

func exponentialBackoff(numRetries int, scale time.Duration) time.Duration {
	if numRetries < 0 {
		return time.Duration(0)
	}

	delay := (1 << uint(numRetries)) * scale
	if delay > maxDelay {
		return maxDelay
	}
	return delay
}

func isThrottlingException(err ServiceError) bool {
	switch err.ErrorCode() {
	case "Throttling", "ThrottlingException", "ProvisionedThroughputExceededException":
		return true
	default:
		return false
	}
}
