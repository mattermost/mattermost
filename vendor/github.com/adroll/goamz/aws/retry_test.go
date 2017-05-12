package aws

import (
	"math/rand"
	"net"
	"net/http"
	"testing"
	"time"
)

type testInput struct {
	res        *http.Response
	err        error
	numRetries int
}

type testResult struct {
	shouldRetry bool
	delay       time.Duration
}

type testCase struct {
	input          testInput
	defaultResult  testResult
	dynamoDBResult testResult
}

var testCases = []testCase{
	// Test nil fields
	testCase{
		input: testInput{
			err:        nil,
			res:        nil,
			numRetries: 0,
		},
		defaultResult: testResult{
			shouldRetry: false,
			delay:       300 * time.Millisecond,
		},
		dynamoDBResult: testResult{
			shouldRetry: false,
			delay:       25 * time.Millisecond,
		},
	},
	// Test 3 different throttling exceptions
	testCase{
		input: testInput{
			err: &Error{
				Code: "Throttling",
			},
			numRetries: 0,
		},
		defaultResult: testResult{
			shouldRetry: true,
			delay:       617165505 * time.Nanosecond, // account for randomness with known seed
		},
		dynamoDBResult: testResult{
			shouldRetry: true,
			delay:       25 * time.Millisecond,
		},
	},
	testCase{
		input: testInput{
			err: &Error{
				Code: "ThrottlingException",
			},
			numRetries: 0,
		},
		defaultResult: testResult{
			shouldRetry: true,
			delay:       579393152 * time.Nanosecond, // account for randomness with known seed
		},
		dynamoDBResult: testResult{
			shouldRetry: true,
			delay:       25 * time.Millisecond,
		},
	},
	testCase{
		input: testInput{
			err: &Error{
				Code: "ProvisionedThroughputExceededException",
			},
			numRetries: 1,
		},
		defaultResult: testResult{
			shouldRetry: true,
			delay:       1105991654 * time.Nanosecond, // account for randomness with known seed
		},
		dynamoDBResult: testResult{
			shouldRetry: true,
			delay:       50 * time.Millisecond,
		},
	},
	// Test a fake throttling exception
	testCase{
		input: testInput{
			err: &Error{
				Code: "MyMadeUpThrottlingCode",
			},
			numRetries: 0,
		},
		defaultResult: testResult{
			shouldRetry: false,
			delay:       300 * time.Millisecond,
		},
		dynamoDBResult: testResult{
			shouldRetry: false,
			delay:       25 * time.Millisecond,
		},
	},
	// Test 5xx errors
	testCase{
		input: testInput{
			res: &http.Response{
				StatusCode: http.StatusInternalServerError,
			},
			numRetries: 1,
		},
		defaultResult: testResult{
			shouldRetry: true,
			delay:       600 * time.Millisecond,
		},
		dynamoDBResult: testResult{
			shouldRetry: true,
			delay:       50 * time.Millisecond,
		},
	},
	testCase{
		input: testInput{
			res: &http.Response{
				StatusCode: http.StatusServiceUnavailable,
			},
			numRetries: 1,
		},
		defaultResult: testResult{
			shouldRetry: true,
			delay:       600 * time.Millisecond,
		},
		dynamoDBResult: testResult{
			shouldRetry: true,
			delay:       50 * time.Millisecond,
		},
	},
	// Test a random 400 error
	testCase{
		input: testInput{
			res: &http.Response{
				StatusCode: http.StatusNotFound,
			},
			numRetries: 1,
		},
		defaultResult: testResult{
			shouldRetry: false,
			delay:       600 * time.Millisecond,
		},
		dynamoDBResult: testResult{
			shouldRetry: false,
			delay:       50 * time.Millisecond,
		},
	},
	// Test a temporary net.Error
	testCase{
		input: testInput{
			res: &http.Response{},
			err: &net.DNSError{
				IsTimeout: true,
			},
			numRetries: 2,
		},
		defaultResult: testResult{
			shouldRetry: true,
			delay:       1200 * time.Millisecond,
		},
		dynamoDBResult: testResult{
			shouldRetry: true,
			delay:       100 * time.Millisecond,
		},
	},
	// Test a non-temporary net.Error
	testCase{
		input: testInput{
			res: &http.Response{},
			err: &net.DNSError{
				IsTimeout: false,
			},
			numRetries: 3,
		},
		defaultResult: testResult{
			shouldRetry: false,
			delay:       2400 * time.Millisecond,
		},
		dynamoDBResult: testResult{
			shouldRetry: false,
			delay:       200 * time.Millisecond,
		},
	},
	// Assert failure after hitting max default retries
	testCase{
		input: testInput{
			err: &Error{
				Code: "ProvisionedThroughputExceededException",
			},
			numRetries: defaultMaxRetries,
		},
		defaultResult: testResult{
			shouldRetry: false,
			delay:       4313582352 * time.Nanosecond, // account for randomness with known seed
		},
		dynamoDBResult: testResult{
			shouldRetry: true,
			delay:       200 * time.Millisecond,
		},
	},
	// Assert failure after hitting max DynamoDB retries
	testCase{
		input: testInput{
			err: &Error{
				Code: "ProvisionedThroughputExceededException",
			},
			numRetries: dynamoDBMaxRetries,
		},
		defaultResult: testResult{
			shouldRetry: false,
			delay:       maxDelay,
		},
		dynamoDBResult: testResult{
			shouldRetry: false,
			delay:       maxDelay,
		},
	},
	// Assert we never go over the maxDelay value
	testCase{
		input: testInput{
			numRetries: 25,
		},
		defaultResult: testResult{
			shouldRetry: false,
			delay:       maxDelay,
		},
		dynamoDBResult: testResult{
			shouldRetry: false,
			delay:       maxDelay,
		},
	},
}

func TestDefaultRetryPolicy(t *testing.T) {
	rand.Seed(0)
	var policy RetryPolicy
	policy = &DefaultRetryPolicy{}
	for _, test := range testCases {
		res := test.input.res
		err := test.input.err
		numRetries := test.input.numRetries

		shouldRetry := policy.ShouldRetry("", res, err, numRetries)
		if shouldRetry != test.defaultResult.shouldRetry {
			t.Errorf("ShouldRetry returned %v, expected %v res=%#v err=%#v numRetries=%d", shouldRetry, test.defaultResult.shouldRetry, res, err, numRetries)
		}
		delay := policy.Delay("", res, err, numRetries)
		if delay != test.defaultResult.delay {
			t.Errorf("Delay returned %v, expected %v res=%#v err=%#v numRetries=%d", delay, test.defaultResult.delay, res, err, numRetries)
		}
	}
}

func TestDynamoDBRetryPolicy(t *testing.T) {
	var policy RetryPolicy
	policy = &DynamoDBRetryPolicy{}
	for _, test := range testCases {
		res := test.input.res
		err := test.input.err
		numRetries := test.input.numRetries

		shouldRetry := policy.ShouldRetry("", res, err, numRetries)
		if shouldRetry != test.dynamoDBResult.shouldRetry {
			t.Errorf("ShouldRetry returned %v, expected %v res=%#v err=%#v numRetries=%d", shouldRetry, test.dynamoDBResult.shouldRetry, res, err, numRetries)
		}
		delay := policy.Delay("", res, err, numRetries)
		if delay != test.dynamoDBResult.delay {
			t.Errorf("Delay returned %v, expected %v res=%#v err=%#v numRetries=%d", delay, test.dynamoDBResult.delay, res, err, numRetries)
		}
	}
}

func TestNeverRetryPolicy(t *testing.T) {
	var policy RetryPolicy
	policy = &NeverRetryPolicy{}
	for _, test := range testCases {
		res := test.input.res
		err := test.input.err
		numRetries := test.input.numRetries

		shouldRetry := policy.ShouldRetry("", res, err, numRetries)
		if shouldRetry {
			t.Errorf("ShouldRetry returned %v, expected %v res=%#v err=%#v numRetries=%d", shouldRetry, false, res, err, numRetries)
		}
		delay := policy.Delay("", res, err, numRetries)
		if delay != time.Duration(0) {
			t.Errorf("Delay returned %v, expected %v res=%#v err=%#v numRetries=%d", delay, time.Duration(0), res, err, numRetries)
		}
	}
}
