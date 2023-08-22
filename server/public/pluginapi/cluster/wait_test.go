package cluster

import (
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
)

func TestNextWaitInterval(t *testing.T) {
	testCases := []struct {
		Description      string
		lastWaitInterval time.Duration
		err              error
		expectedRange    [2]time.Duration
	}{
		{
			"0, no error",
			0,
			nil,
			[2]time.Duration{
				1*time.Second - jitterWaitInterval/2,
				1*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"0, error",
			0,
			errors.New("test"),
			[2]time.Duration{
				2*time.Second - jitterWaitInterval/2,
				2*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"negative, no error",
			-100 * time.Second,
			nil,
			[2]time.Duration{
				1*time.Second - jitterWaitInterval/2,
				1*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"negative, error",
			-100 * time.Second,
			errors.New("test"),
			[2]time.Duration{
				2*time.Second - jitterWaitInterval/2,
				2*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"1 second, no error",
			1 * time.Second,
			nil,
			[2]time.Duration{
				1*time.Second - jitterWaitInterval/2,
				1*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"1 second, error",
			1 * time.Second,
			errors.New("test"),
			[2]time.Duration{
				2*time.Second - jitterWaitInterval/2,
				2*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"10 seconds, no error",
			10 * time.Second,
			nil,
			[2]time.Duration{
				1*time.Second - jitterWaitInterval/2,
				1*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"10 second, error",
			10 * time.Second,
			errors.New("test"),
			[2]time.Duration{
				20*time.Second - jitterWaitInterval/2,
				20*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"4 minutes, no error",
			4 * time.Minute,
			nil,
			[2]time.Duration{
				1*time.Second - jitterWaitInterval/2,
				1*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"4 minutes, error",
			4 * time.Minute,
			errors.New("test"),
			[2]time.Duration{
				5*time.Minute - jitterWaitInterval/2,
				5*time.Minute + jitterWaitInterval/2,
			},
		},
		{
			"5 minutes, no error",
			5 * time.Minute,
			nil,
			[2]time.Duration{
				1*time.Second - jitterWaitInterval/2,
				1*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"5 minutes, error",
			5 * time.Minute,
			errors.New("test"),
			[2]time.Duration{
				5*time.Minute - jitterWaitInterval/2,
				5*time.Minute + jitterWaitInterval/2,
			},
		},
		{
			"10minutes, no error",
			10 * time.Minute,
			nil,
			[2]time.Duration{
				1*time.Second - jitterWaitInterval/2,
				1*time.Second + jitterWaitInterval/2,
			},
		},
		{
			"10minutes, error",
			10 * time.Minute,
			errors.New("test"),
			[2]time.Duration{
				5*time.Minute - jitterWaitInterval/2,
				5*time.Minute + jitterWaitInterval/2,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			actualWaitInterval := nextWaitInterval(
				testCase.lastWaitInterval,
				testCase.err,
			)
			assert.GreaterOrEqual(t, int64(actualWaitInterval), int64(testCase.expectedRange[0]))
			assert.LessOrEqual(t, int64(actualWaitInterval), int64(testCase.expectedRange[1]))
		})
	}
}
