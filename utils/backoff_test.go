package utils

import (
	"testing"

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
	if i != 6 {
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
