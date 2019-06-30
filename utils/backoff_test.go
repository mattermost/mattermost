package utils

import (
	"testing"
	"time"

	"github.com/pkg/errors"
)

func TestRetryShouldFailAfterMaxAttempts(t *testing.T) {
	backoff := NewBackoff(3)

	operationError := errors.New("Operation Failed")
	retryOperation := func() error {
		return operationError
	}

	err := backoff.Retry(retryOperation)

	if err == nil || err != operationError {
		t.Errorf("Expected %v, Got %v", operationError, err)
	}

	if backoff.attempts != 3 {
		t.Errorf("Expected %d, Got %d", 3, backoff.attempts)
	}
}

func TestRetryShouldSuccessAfterTwoAttempts(t *testing.T) {
	i := 0
	operationError := errors.New("Operation Failed")

	backoff := NewBackoff(3)

	retryOperation := func() error {
		i++
		if i == 2 {
			return nil
		}

		return operationError
	}

	err := backoff.Retry(retryOperation)
	if err != nil {
		t.Errorf("Expected %v, Got %v", nil, operationError)
	}
	if i != 2 {
		t.Errorf("Invalid number of retries: %d", i)
	}
}

func TestNextRetryFallsWithinRange(t *testing.T) {
	backoff := NewBackoff(5)

	var expectedTimes = []time.Duration{128, 256, 512, 1024, 2048, 4096}
	for i, et := range expectedTimes {
		expectedTimes[i] = et * time.Millisecond
	}

	for _, expectedTime := range expectedTimes {
		actualTime := backoff.NextRetry()
		if actualTime != expectedTime {
			t.Errorf("Expected %d, Got %d", expectedTime, actualTime)
		}
		backoff.attempts++
	}
}
