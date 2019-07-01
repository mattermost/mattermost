package utils

import (
	"testing"
	"time"

	"github.com/pkg/errors"
)

func TestProgressiveRetryShouldFail(t *testing.T) {
	i := 0
	operationError := errors.New("Operation Failed")
	retryOperation := func() error {
		i++
		return operationError
	}

	err := ProgressiveRetry(retryOperation)

	if err == nil || err != operationError {
		t.Errorf("Expected %v, Got %v", operationError, err)
	}
	if i != 4 {
		t.Errorf("Invalid number of attempts: %d", i)
	}
}

func TestProgressiveRetryShouldSuccessAfterTwoAttempts(t *testing.T) {
	i := 0
	operationError := errors.New("Operation Failed")

	retryOperation := func() error {
		i++
		if i == 2 {
			return nil
		}

		return operationError
	}

	err := ProgressiveRetry(retryOperation)
	if err != nil {
		t.Errorf("Expected %v, Got %v", nil, operationError)
	}
	if i != 2 {
		t.Errorf("Invalid number of attempts: %d", i)
	}
}

func TestNextRetryFallsWithinRange(t *testing.T) {
	var expectedTimes = []time.Duration{128, 256, 512, 1024, 2048, 4096}
	for i, et := range expectedTimes {
		expectedTimes[i] = et * time.Millisecond
	}

	var attempt uint64
	for _, expectedTime := range expectedTimes {
		actualTime := NextRetry(attempt)
		if actualTime != expectedTime {
			t.Errorf("Expected %d, Got %d", expectedTime, actualTime)
		}
		attempt++
	}
}
