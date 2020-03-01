// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProgressiveRetry(t *testing.T) {
	var retries int
	backoffTimeouts := []time.Duration{
		50 * time.Millisecond, 100 * time.Millisecond, 200 * time.Millisecond,
		200 * time.Millisecond, 400 * time.Millisecond, 400 * time.Millisecond}

	type args struct {
		operation func() error
	}
	tests := []struct {
		name            string
		args            args
		wantErr         bool
		expectedRetries int
	}{
		{
			name: "Should fail and return error",
			args: args{
				operation: func() error {
					retries++
					return errors.New("Operation Failed")
				},
			},
			wantErr:         true,
			expectedRetries: 6,
		},
		{
			name: "Should succeed after two retries",
			args: args{
				operation: func() error {
					retries++
					if retries == 2 {
						return nil
					}

					return errors.New("Operation Failed")
				},
			},
			wantErr:         false,
			expectedRetries: 2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			retries = 0

			err := ProgressiveRetry(tt.args.operation, backoffTimeouts)
			if !tt.wantErr {
				require.Nil(t, err)
			}

			assert.Equal(t, tt.expectedRetries, retries)
		})
	}
}
